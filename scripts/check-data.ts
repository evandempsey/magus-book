import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { EditionChapter, EditionManifest } from "../src/lib/types";
import { PLATE_IMAGE_ASSETS } from "./plate-assets";

async function readJson<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(path, "utf8")) as T;
}

async function main() {
  const manifest = await readJson<EditionManifest>("data/edition/manifest.json");
  const chapters = await readJson<EditionChapter[]>("data/edition/chapters.json");
  const expectedPlatePaths = new Set(PLATE_IMAGE_ASSETS.map((asset) => asset.localPath));

  if (manifest.totalChapters !== chapters.length) {
    throw new Error(`Manifest count ${manifest.totalChapters} does not match chapters ${chapters.length}`);
  }

  if (chapters.length < 120) {
    throw new Error(`Expected a complete edition, found only ${chapters.length} chapters`);
  }

  const slugs = new Set(chapters.map((chapter) => chapter.slug));
  if (slugs.size !== chapters.length) {
    throw new Error("Chapter slugs are not unique");
  }

  for (const chapter of chapters) {
    if (!chapter.html.trim()) throw new Error(`${chapter.slug} has empty HTML`);
    if (!chapter.plainText.trim()) throw new Error(`${chapter.slug} has empty plain text`);
    if (chapter.previousSlug && !slugs.has(chapter.previousSlug)) {
      throw new Error(`${chapter.slug} points to missing previous chapter`);
    }
    if (chapter.nextSlug && !slugs.has(chapter.nextSlug)) {
      throw new Error(`${chapter.slug} points to missing next chapter`);
    }
  }

  if (!chapters.some((chapter) => chapter.isAppendix)) {
    throw new Error("Biographia Antiqua appendix was not detected");
  }

  if (manifest.plates.length !== PLATE_IMAGE_ASSETS.length) {
    throw new Error(`Expected ${PLATE_IMAGE_ASSETS.length} plate image references, found ${manifest.plates.length}`);
  }

  for (const plate of manifest.plates) {
    if (!plate.localPath) throw new Error(`${plate.id} is missing a localPath`);
    if (!expectedPlatePaths.has(plate.localPath)) {
      throw new Error(`${plate.id} points to unexpected local asset ${plate.localPath}`);
    }

    const assetPath = path.resolve("public", plate.localPath.replace(/^\//, ""));
    try {
      const asset = await stat(assetPath);
      if (!asset.isFile() || asset.size < 1024) throw new Error("missing or empty");
    } catch {
      throw new Error(`${plate.id} local asset is missing: ${assetPath}`);
    }
  }

  process.stdout.write(`Edition data OK: ${chapters.length} chapters, ${manifest.totalWords.toLocaleString()} words, ${manifest.plates.length} local images.\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
