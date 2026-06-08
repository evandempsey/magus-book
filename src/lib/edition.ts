import chaptersData from "../../data/edition/chapters.json";
import manifestData from "../../data/edition/manifest.json";
import type { EditionChapter, EditionManifest } from "./types";

export const manifest = manifestData as EditionManifest;
export const chapters = chaptersData as EditionChapter[];

export function getChapter(slug: string): EditionChapter | undefined {
  return chapters.find((chapter) => chapter.slug === slug);
}

export function getFirstChapter(): EditionChapter {
  const chapter = chapters[0];
  if (!chapter) {
    throw new Error("Edition data is empty. Run `npm run scrape` first.");
  }
  return chapter;
}

export function getGroupedChapters() {
  return manifest.sections.map((section) => ({
    ...section,
    chapters: section.chapterSlugs
      .map((slug) => getChapter(slug))
      .filter((chapter): chapter is EditionChapter => Boolean(chapter))
  }));
}

export function readingMinutes(wordCount: number): number {
  return Math.max(1, Math.round(wordCount / 210));
}
