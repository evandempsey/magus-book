import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  buildChapter,
  buildSections,
  CANONICAL_INDEX,
  parseIndex,
  readerUrl,
  sourceId,
  summarizeChapter,
  TEXT_CORRECTIONS
} from "./edition-utils";
import type { EditionChapter, EditionManifest } from "../src/lib/types";

const RAW_DIR = path.resolve("data/raw");
const EDITION_DIR = path.resolve("data/edition");
const FETCH_DELAY_MS = Number(process.env.MAGUS_DELAY_MS ?? 900);
const MAX_FETCH_ATTEMPTS = 6;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithCache(url: string, cacheName: string): Promise<string> {
  const cachePath = path.join(RAW_DIR, cacheName);
  if (!process.env.MAGUS_REFRESH) {
    try {
      return await readFile(cachePath, "utf8");
    } catch {
      // Cache miss; fetch below.
    }
  }

  let lastError: Error | undefined;
  for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
    if (FETCH_DELAY_MS > 0) await sleep(FETCH_DELAY_MS);

    const response = await fetch(readerUrl(url), {
      headers: {
        "User-Agent": "magus-book-edition/0.1"
      }
    });

    if (response.ok) {
      const text = await response.text();
      if (/Just a moment|Cloudflare|Enable JavaScript/i.test(text)) {
        throw new Error(`Reader fallback returned blocked content for ${url}`);
      }

      await writeFile(cachePath, text);
      return text;
    }

    lastError = new Error(`Failed to fetch ${url}: ${response.status} ${response.statusText}`);
    if (![408, 425, 429, 500, 502, 503, 504].includes(response.status)) break;
    const retryAfter = Number(response.headers.get("retry-after"));
    const backoff = Number.isFinite(retryAfter) && retryAfter > 0
      ? retryAfter * 1000
      : Math.min(45000, 1500 * attempt ** 2);
    process.stdout.write(`Retrying ${sourceId(url)} after ${Math.round(backoff / 1000)}s (${attempt}/${MAX_FETCH_ATTEMPTS})\n`);
    await sleep(backoff);
  }

  throw lastError ?? new Error(`Failed to fetch ${url}`);
}

async function main() {
  await mkdir(RAW_DIR, { recursive: true });
  await mkdir(EDITION_DIR, { recursive: true });

  const indexMarkdown = await fetchWithCache(CANONICAL_INDEX, "index.md");
  const entries = parseIndex(indexMarkdown);

  if (entries.length < 120) {
    throw new Error(`Expected at least 120 chapters from the index, found ${entries.length}`);
  }

  const chapters: EditionChapter[] = [];
  for (const [index, entry] of entries.entries()) {
    const id = sourceId(entry.sourceUrl);
    const raw = await fetchWithCache(entry.sourceUrl, `${id}.md`);
    const chapter = buildChapter(raw, entry, index + 1);
    chapters.push(chapter);
    process.stdout.write(`Scraped ${String(index + 1).padStart(3, " ")} / ${entries.length}: ${chapter.title}\n`);
  }

  for (const [index, chapter] of chapters.entries()) {
    chapter.previousSlug = chapters[index - 1]?.slug;
    chapter.nextSlug = chapters[index + 1]?.slug;
  }

  const plates = chapters.flatMap((chapter) => chapter.images);
  const manifest: EditionManifest = {
    title: "The Magus",
    subtitle: "Or Celestial Intelligencer",
    author: "Francis Barrett",
    publicationYear: 1801,
    generatedAt: new Date().toISOString(),
    source: {
      label: "Internet Sacred Text Archive",
      url: CANONICAL_INDEX,
      readerFallback: readerUrl(CANONICAL_INDEX)
    },
    totalChapters: chapters.length,
    totalWords: chapters.reduce((sum, chapter) => sum + chapter.wordCount, 0),
    sections: buildSections(chapters),
    chapters: chapters.map(summarizeChapter),
    plates
  };

  await writeFile(path.join(EDITION_DIR, "chapters.json"), `${JSON.stringify(chapters, null, 2)}\n`);
  await writeFile(path.join(EDITION_DIR, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await writeFile(path.join(EDITION_DIR, "corrections.json"), `${JSON.stringify(TEXT_CORRECTIONS, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
