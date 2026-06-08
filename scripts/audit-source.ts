import { readFile } from "node:fs/promises";
import path from "node:path";
import type { EditionChapter } from "../src/lib/types";
import {
  cleanSourceMarkdown,
  collectImages,
  collectPageMarkers,
  findStructuredLineBlocks
} from "./edition-utils";

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const chapters = await readJson<EditionChapter[]>("data/edition/chapters.json");
  const failures: string[] = [];
  let structuredBlockCount = 0;

  for (const chapter of chapters) {
    const rawPath = path.resolve("data/raw", `${chapter.id}.md`);
    const raw = await readFile(rawPath, "utf8");
    const cleaned = cleanSourceMarkdown(raw, chapter.sourceUrl);
    const expectedPageMarkers = collectPageMarkers(cleaned);
    const expectedImages = collectImages(cleaned, chapter.slug);
    const expectedStructuredBlocks = findStructuredLineBlocks(cleaned);
    const actualStructuredBlocks = [...chapter.html.matchAll(/data-source-lines="true"/g)];
    const expectedStructuredRows = expectedStructuredBlocks
      .flatMap((block) => block.lines)
      .filter((line) => !/^\[p\.\s*[^[]+\]\(/i.test(line));
    const actualStructuredRows = [...chapter.html.matchAll(/<div class="[^"]*\bsource-line\b/g)];

    for (const pageMarker of expectedPageMarkers) {
      if (!chapter.pageMarkers.includes(pageMarker)) {
        failures.push(`${chapter.id} is missing page marker ${pageMarker}`);
      }
    }

    for (const image of expectedImages) {
      if (!chapter.images.some((candidate) => candidate.sourceUrl === image.sourceUrl)) {
        failures.push(`${chapter.id} is missing source image ${image.sourceUrl}`);
      }
    }

    if (actualStructuredBlocks.length !== expectedStructuredBlocks.length) {
      failures.push(`${chapter.id} expected ${expectedStructuredBlocks.length} source line block(s), found ${actualStructuredBlocks.length}`);
    }

    if (actualStructuredRows.length !== expectedStructuredRows.length) {
      failures.push(`${chapter.id} expected ${expectedStructuredRows.length} source line row(s), found ${actualStructuredRows.length}`);
    }

    structuredBlockCount += expectedStructuredBlocks.length;
  }

  assert(failures.length === 0, `Source audit failed:\n${failures.join("\n")}`);

  process.stdout.write(`Source audit OK: ${chapters.length} chapters, ${structuredBlockCount} structured source line blocks.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
