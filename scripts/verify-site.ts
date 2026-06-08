import { mkdir } from "node:fs/promises";
import path from "node:path";
import { chromium, type Page } from "playwright";
import manifest from "../data/edition/manifest.json" with { type: "json" };

const BASE_URL = process.env.MAGUS_BASE_URL ?? "http://127.0.0.1:4328";
const OUT_DIR = path.resolve("test-results/site");

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

async function main() {
  await mkdir(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const consoleErrors: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });
  await assertText(page, "The Magus");
  await assertText(page, "Contents");
  await assertText(page, "Downloads");
  await assertText(page, "Plates");
  await assertText(page, "The First Principles of Natural Magic");
  await assertNoText(page, "Readable, sourced, complete");
  await assertNoText(page, "Ten structured sections");
  await assertNoText(page, "plate references");
  await page.screenshot({ path: path.join(OUT_DIR, "home.png"), fullPage: true });

  await page.goto(`${BASE_URL}/contents/`, { waitUntil: "networkidle" });
  await assertText(page, "The First Principles of Natural Magic");
  await page.getByLabel("Search contents").fill("Cabala");
  await assertText(page, "Of The Cabala");
  await page.screenshot({ path: path.join(OUT_DIR, "contents-search.png"), fullPage: true });

  await page.goto(`${BASE_URL}/read/ma100-title-page/`, { waitUntil: "networkidle" });
  await assertText(page, "Cabalistic Art");
  await page.getByLabel("Increase text size").click();
  await page.getByLabel("Toggle dark reading theme").click();
  await page.screenshot({ path: path.join(OUT_DIR, "reader-title-page.png"), fullPage: true });

  await page.goto(`${BASE_URL}/read/ma150-chapter-xxviii-the-magic-tables-of-the-planets/`, { waitUntil: "networkidle" });
  await assertText(page, "THE MAGIC TABLES OF THE PLANETS");
  await assertImageLoaded(page, ".plate-figure img");
  await page.screenshot({ path: path.join(OUT_DIR, "reader-plate.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE_URL}/read/ma101-preface/`, { waitUntil: "networkidle" });
  await assertText(page, "Preface");
  await page.screenshot({ path: path.join(OUT_DIR, "reader-mobile.png"), fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${BASE_URL}/plates/`, { waitUntil: "networkidle" });
  await assertText(page, "Plate Catalog");
  await assertImageLoaded(page, ".plate-feature img");
  await assertAllImagesLoaded(page, ".plate-card img", manifest.plates.length);
  const placeholderCount = await page.locator(".plate-placeholder").count();
  if (placeholderCount > 0) {
    throw new Error(`Plate catalog still has ${placeholderCount} placeholder cards`);
  }
  await page.screenshot({ path: path.join(OUT_DIR, "plates.png"), fullPage: true });

  await page.goto(`${BASE_URL}/downloads/`, { waitUntil: "networkidle" });
  await assertText(page, "Trade-book PDF");
  await assertText(page, "Reflowable EPUB");
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
