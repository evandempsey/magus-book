import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { chromium } from "playwright";

const PORT = Number(process.env.MAGUS_PREVIEW_PORT ?? 4327);
const BASE_PATH = (process.env.MAGUS_BASE_PATH ?? "/magus-book").replace(/\/$/, "");
const URL = `http://127.0.0.1:${PORT}${BASE_PATH}/print/pdf/`;
const OUTPUT_NAME = "the-magus-francis-barrett.pdf";
const PUBLIC_OUTPUT = path.resolve("public/downloads", OUTPUT_NAME);
const DIST_OUTPUT = path.resolve("dist/downloads", OUTPUT_NAME);

function startPreview(): ChildProcessWithoutNullStreams {
  const astroBin = path.resolve("node_modules/.bin/astro");
  return spawn(astroBin, ["preview", "--host", "127.0.0.1", "--port", String(PORT)], {
    stdio: "pipe",
    env: process.env
  });
}

async function waitForPreview(processHandle: ChildProcessWithoutNullStreams) {
  const startedAt = Date.now();
  let log = "";

  processHandle.stdout.on("data", (chunk) => {
    log += chunk.toString();
  });
  processHandle.stderr.on("data", (chunk) => {
    log += chunk.toString();
  });

  while (Date.now() - startedAt < 30000) {
    try {
      const response = await fetch(URL);
      if (response.ok) return;
    } catch {
      // Server is not ready yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 300));
  }

  throw new Error(`Astro preview did not start in time.\n${log}`);
}

async function mirrorToDist(pdf: Buffer) {
  await mkdir(path.dirname(PUBLIC_OUTPUT), { recursive: true });
  await writeFile(PUBLIC_OUTPUT, pdf);

  try {
    await mkdir(path.dirname(DIST_OUTPUT), { recursive: true });
    await writeFile(DIST_OUTPUT, pdf);
  } catch {
    // The dist directory may not exist if the script is run standalone.
  }
}

async function main() {
  const preview = startPreview();

  try {
    await waitForPreview(preview);
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto(URL, { waitUntil: "networkidle" });
    const pdf = await page.pdf({
      path: PUBLIC_OUTPUT,
      printBackground: true,
      preferCSSPageSize: true,
      margin: {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0"
      }
    });
    await browser.close();
    await mirrorToDist(pdf);
    process.stdout.write(`PDF written to ${PUBLIC_OUTPUT}\n`);
  } catch (error) {
    if (error instanceof Error && /Executable doesn't exist|browserType.launch/.test(error.message)) {
      console.error("Playwright Chromium is not installed. Run `npm exec playwright install chromium` and retry.");
    }
    throw error;
  } finally {
    preview.kill("SIGTERM");
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
