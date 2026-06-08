import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import manifest from "../data/edition/manifest.json" with { type: "json" };

const BASE_URL = (process.env.MAGUS_BASE_URL ?? "http://127.0.0.1:4328/magus-book").replace(/\/$/, "");
const OUT_DIR = path.resolve("test-results/site");

function pageUrl(pathname: string): string {
  return `${BASE_URL}${pathname}`;
}

async function assertText(page: Page, text: string) {
  const count = await page.getByText(text, { exact: false }).count();
  if (count === 0) throw new Error(`Missing expected text: ${text}`);
}

async function assertNoText(page: Page, text: string) {
  const count = await page.getByText(text, { exact: false }).count();
  if (count > 0) throw new Error(`Unexpected text found: ${text}`);
}

async function assertImageLoaded(page: Page, selector: string) {
  const images = page.locator(selector);
  const count = await images.count();
  if (count === 0) throw new Error(`Missing image: ${selector}`);

  const loaded = await images.first().evaluate((node) => {
    const image = node as HTMLImageElement;
    return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
  });
  if (!loaded) throw new Error(`Image did not load: ${selector}`);
}

async function assertAllImagesLoaded(page: Page, selector: string, expectedCount: number) {
  const images = page.locator(selector);
  const count = await images.count();
  if (count !== expectedCount) {
    throw new Error(`Expected ${expectedCount} images for ${selector}, found ${count}`);
  }

  for (let index = 0; index < count; index += 1) {
    const loaded = await images.nth(index).evaluate((node) => {
      const image = node as HTMLImageElement;
      return image.complete && image.naturalWidth > 0 && image.naturalHeight > 0;
    });
    if (!loaded) throw new Error(`Image ${index + 1} did not load for ${selector}`);
  }
}

async function assertAstroStylesheetLoaded(page: Page) {
  const basePath = new URL(BASE_URL).pathname.replace(/\/$/, "");
  const stylesheetHrefs = await page.locator('link[rel="stylesheet"]').evaluateAll((links) => {
    return links.map((link) => (link as HTMLLinkElement).href);
  });
  const hasBasePathStylesheet = stylesheetHrefs.some((href) => {
    return new URL(href).pathname.startsWith(`${basePath}/_astro/`);
  });

  if (!hasBasePathStylesheet) {
    throw new Error(`Expected an Astro stylesheet under ${basePath}/_astro/`);
  }

  const loadedStylesheetCount = await page.evaluate(() => document.styleSheets.length);
  if (loadedStylesheetCount === 0) throw new Error("No stylesheets loaded");
}

async function assertInternalLinkUsesBase(page: Page, selector: string, expectedPath: string) {
  const href = await page.locator(selector).first().getAttribute("href");
  if (!href) throw new Error(`Missing href for ${selector}`);
  const expectedHref = pageUrl(expectedPath);
  if (new URL(href, BASE_URL).href !== expectedHref) {
    throw new Error(`Expected ${selector} to link to ${expectedHref}, found ${href}`);
  }
}

async function assertDownloadAvailable(page: Page, pathname: string) {
  const response = await page.request.get(pageUrl(pathname));
  if (!response.ok()) {
    throw new Error(`Download failed for ${pathname}: ${response.status()}`);
  }
  const body = await response.body();
  if (body.length < 1024) {
    throw new Error(`Download was unexpectedly small for ${pathname}: ${body.length} bytes`);
  }
}

async function assertPathNotFound(page: Page, pathname: string) {
  const response = await page.request.get(pageUrl(pathname));
  if (response.status() !== 404) {
    throw new Error(`Expected ${pathname} to be removed, got ${response.status()}`);
  }
}

async function assertNoInternalContentsLinks(page: Page) {
  const hrefs = await page.locator("a[href]").evaluateAll((links) => links.map((link) => (link as HTMLAnchorElement).href));
  const contentsLinks = hrefs.filter((href) => new URL(href).pathname.endsWith("/contents/"));
  if (contentsLinks.length > 0) {
    throw new Error(`Unexpected /contents/ links found:\n${contentsLinks.join("\n")}`);
  }
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(pageUrl("/"), { waitUntil: "networkidle" });
  await assertAstroStylesheetLoaded(page);
  await assertText(page, "The Magus");
  await assertText(page, "Contents");
  await assertText(page, "Downloads");
  await assertText(page, "Plates");
  await assertText(page, "The First Principles of Natural Magic");
  await page.getByLabel("Search contents").fill("Cabala");
  await assertText(page, "Of The Cabala");
  await assertNoText(page, "Readable, sourced, complete");
  await assertNoText(page, "Ten structured sections");
  await assertNoText(page, "plate references");
  await assertNoText(page, "Downloads page");
  await assertNoText(page, "Open plate index");
  await assertInternalLinkUsesBase(page, ".primary-nav a:first-child", "/");
  await assertInternalLinkUsesBase(page, '.toc-entry a[href*="/read/"]', "/read/ma100-title-page/");
  await assertNoInternalContentsLinks(page);
  await page.screenshot({ path: path.join(OUT_DIR, "home.png"), fullPage: true });

  await assertPathNotFound(page, "/contents/");

  await page.goto(pageUrl("/read/ma100-title-page/"), { waitUntil: "networkidle" });
  await assertText(page, "Cabalistic Art");
  await assertInternalLinkUsesBase(page, ".toc-home", "/");
  await assertNoInternalContentsLinks(page);
  await page.getByLabel("Increase text size").click();
  await page.getByLabel("Toggle dark reading theme").click();
  await page.screenshot({ path: path.join(OUT_DIR, "reader-title-page.png"), fullPage: true });

  await page.goto(pageUrl("/read/ma102-table-of-contents/"), { waitUntil: "networkidle" });
  await assertText(page, "The Use and Abuse of Astrology");
  const ma102LineCount = await page.locator(".source-lines .source-line").count();
  if (ma102LineCount < 150) throw new Error(`Expected ma102 source lines to render, found ${ma102LineCount}`);
  await page.screenshot({ path: path.join(OUT_DIR, "reader-source-lines-toc.png"), fullPage: true });

  await page.goto(pageUrl("/read/ma103-directions-for-placing-the-plates/"), { waitUntil: "networkidle" });
  await assertText(page, "Magic Tables, Plate I. to front");
  const ma103LineCount = await page.locator(".source-lines .source-line").count();
  if (ma103LineCount < 18) throw new Error(`Expected ma103 source lines to render, found ${ma103LineCount}`);
  await page.screenshot({ path: path.join(OUT_DIR, "reader-source-lines-plates.png"), fullPage: true });

  await page.goto(pageUrl("/read/ma150-chapter-xxviii-the-magic-tables-of-the-planets/"), { waitUntil: "networkidle" });
  await assertText(page, "THE MAGIC TABLES OF THE PLANETS");
  await assertImageLoaded(page, ".plate-figure img");
  await page.screenshot({ path: path.join(OUT_DIR, "reader-plate.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(pageUrl("/read/ma101-preface/"), { waitUntil: "networkidle" });
  await assertText(page, "Preface");
  await page.screenshot({ path: path.join(OUT_DIR, "reader-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(pageUrl("/plates/"), { waitUntil: "networkidle" });
  await assertText(page, "Plate Catalog");
  await assertImageLoaded(page, ".plate-feature img");
  await assertAllImagesLoaded(page, ".plate-card img", manifest.plates.length);
  const placeholderCount = await page.locator(".plate-placeholder").count();
  if (placeholderCount > 0) {
    throw new Error(`Plate catalog still has ${placeholderCount} placeholder cards`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "plates.png"), fullPage: true });

  await page.goto(pageUrl("/downloads/"), { waitUntil: "networkidle" });
  await assertText(page, "Trade-book PDF");
  await assertText(page, "Reflowable EPUB");
  await assertDownloadAvailable(page, "/downloads/the-magus-francis-barrett.pdf");
  await assertDownloadAvailable(page, "/downloads/the-magus-francis-barrett.epub");
  await page.screenshot({ path: path.join(OUT_DIR, "downloads.png"), fullPage: true });

  await browser.close();

  if (consoleErrors.length > 0) {
    throw new Error(`Console errors detected:\n${consoleErrors.join("\n")}`);
  }

  process.stdout.write(`Site verification screenshots written to ${OUT_DIR}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
