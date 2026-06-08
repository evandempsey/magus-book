import { marked } from "marked";
import type {
  EditionChapter,
  EditionChapterSummary,
  EditionCorrection,
  EditionImage,
  EditionSection
} from "../src/lib/types";
import { localPathForImage } from "./plate-assets";

export const CANONICAL_BASE = "https://www.sacred-texts.com/grim/magus/";
export const CANONICAL_INDEX = `${CANONICAL_BASE}index.htm`;
export const READER_PREFIX = "https://r.jina.ai/http://";

marked.use({
  gfm: true,
  breaks: false
});

export const TEXT_CORRECTIONS: EditionCorrection[] = [
  {
    id: "ma100-long-s-cabaliftic",
    chapterId: "ma100",
    before: "Cabaliftic",
    after: "Cabalistic",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-celeftial",
    chapterId: "ma100",
    before: "Celeftial",
    after: "Celestial",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-fhewing",
    chapterId: "ma100",
    before: "fhewing",
    after: "shewing",
    reason: "Corrects a long-s OCR artefact while preserving Barrett's period spelling."
  },
  {
    id: "ma100-long-s-fupernatural",
    chapterId: "ma100",
    before: "fupernatural",
    after: "supernatural",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-conftruction",
    chapterId: "ma100",
    before: "Conftruction",
    after: "Construction",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-compofition",
    chapterId: "ma100",
    before: "Compofition",
    after: "Composition",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-glaffes",
    chapterId: "ma100",
    before: "Glaffes",
    after: "Glasses",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-secret",
    chapterId: "ma100",
    before: "fecret",
    after: "secret",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-mysteries",
    chapterId: "ma100",
    before: "Myfteries",
    after: "Mysteries",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  },
  {
    id: "ma100-long-s-use",
    chapterId: "ma100",
    before: "Ufe",
    after: "Use",
    reason: "Corrects a long-s OCR artefact on the 1801 title page."
  }
];

export function readerUrl(url: string): string {
  return `${READER_PREFIX}${url}`;
}

export function slugify(input: string): string {
  return input
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-")
    .slice(0, 80);
}

export function sourceId(url: string): string {
  const match = url.match(/\/(ma\d+)\.htm$/);
  if (!match) {
    throw new Error(`Could not derive source id from ${url}`);
  }
  return match[1];
}

export function markdownContent(readerResponse: string): string {
  const marker = "Markdown Content:";
  const markerIndex = readerResponse.indexOf(marker);
  const content = markerIndex >= 0
    ? readerResponse.slice(markerIndex + marker.length)
    : readerResponse;

  return content
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function parseIndex(indexMarkdown: string) {
  const lines = markdownContent(indexMarkdown).split("\n");
  const entries: Array<{
    title: string;
    sourceUrl: string;
    book: string;
    section: string;
    isAppendix: boolean;
  }> = [];

  let book = "The Magus";
  let section = "Front Matter";

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith("### ")) {
      const heading = line.replace(/^###\s+/, "").trim();
      if (/^by Francis Barrett$/i.test(heading)) continue;
      if (/^The Magus, Book I$/i.test(heading)) {
        book = "Book I";
        section = "Front Matter";
        continue;
      }
      if (/^The Magus, Book II$/i.test(heading)) {
        book = "Book II";
        section = "Magnetism";
        continue;
      }
      section = heading;
      continue;
    }

    const match = line.match(/^\[(.+?)\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/ma\d+\.htm)\)$/);
    if (!match) continue;

    entries.push({
      title: match[1].trim(),
      sourceUrl: match[2].replace("https://sacred-texts.com", "https://www.sacred-texts.com"),
      book,
      section,
      isAppendix: section === "Biographia Antiqua"
    });
  }

  return entries;
}

function trimDecorativeRules(lines: string[]) {
  let trimmed = [...lines];
  while (trimmed[0]?.trim() === "* * *") trimmed = trimmed.slice(1);
  while (trimmed.at(-1)?.trim() === "* * *") trimmed = trimmed.slice(0, -1);
  return trimmed;
}

function removeReaderChrome(markdown: string, sourceUrl: string): string {
  let lines = markdownContent(markdown).split("\n");
  const firstRule = lines.findIndex((line) => line.trim() === "* * *");
  if (firstRule >= 0) lines = lines.slice(firstRule + 1);

  const sourcePattern = sourceUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const emptyAnchor = new RegExp(`\\[\\]\\(${sourcePattern}\\)`, "g");

  lines = lines
    .map((line) => line.replace(emptyAnchor, ""))
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) return true;
      if (/cdshop\/cdinfo\.jpg/.test(trimmed)) return false;
      if (/^\[Sacred Texts\]/.test(trimmed)) return false;
      if (/^\[(Next|Previous|Index|Grimoires|Sacred Texts):?/.test(trimmed)) return false;
      if (/^Scanned at sacred-texts\.com/i.test(trimmed)) return false;
      return true;
    });

  lines = trimDecorativeRules(lines);

  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function collectPageMarkers(markdown: string): string[] {
  return [...markdown.matchAll(/\[p\.\s*([ivxlcdm\d]+)\]\([^)]+\)/gi)]
    .map((match) => match[1])
    .filter((value, index, all) => all.indexOf(value) === index);
}

function captionForImageUrl(sourceUrl: string): string {
  const filename = sourceUrl.split("/").at(-1) ?? "source-image.jpg";
  return filename.replace(/\.[a-z0-9]+$/i, "").replace(/[-_]/g, " ").toUpperCase();
}

function collectImages(markdown: string, chapterSlug: string): EditionImage[] {
  const bySource = new Map<string, EditionImage>();

  for (const match of markdown.matchAll(/\[!\[(Image\s+\d+)\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/tn\/[^)]+)\)\s*Click to view\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/img\/[^)]+)\)/g)) {
    bySource.set(match[3], {
      id: `${chapterSlug}-image-${bySource.size + 1}`,
      chapterSlug,
      sourceUrl: match[3],
      thumbUrl: match[2],
      localPath: localPathForImage(match[3]),
      caption: captionForImageUrl(match[3])
    });
  }

  for (const match of markdown.matchAll(/!\[(Image\s+\d+)\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/img\/[^)]+)\)/g)) {
    if (bySource.has(match[2])) continue;
    bySource.set(match[2], {
      id: `${chapterSlug}-image-${bySource.size + 1}`,
      chapterSlug,
      sourceUrl: match[2],
      localPath: localPathForImage(match[2]),
      caption: captionForImageUrl(match[2])
    });
  }

  return [...bySource.values()];
}

function normalizeSourceArtifacts(markdown: string, images: EditionImage[]): string {
  let output = markdown;

  output = output.replace(/\[p\.\s*([ivxlcdm\d]+)\]\([^)]+\)/gi, (_match, page) => {
    const id = `page-${String(page).toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    return `<span class="page-marker" id="${id}">p. ${page}</span>`;
  });

  output = output.replace(
    /\[!\[(Image\s+\d+)\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/tn\/[^)]+)\)\s*Click to view\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/img\/([^)]+))\)/g,
    (_match, label: string, _thumb: string, sourceUrl: string) => {
      const image = images.find((candidate) => candidate.sourceUrl === sourceUrl);
      if (image?.localPath) {
        return `<figure class="plate-figure"><img src="${image.localPath}" alt="${image.caption}" loading="lazy"><figcaption>${image.caption}</figcaption></figure>`;
      }
      return `<figure class="plate-reference"><figcaption>${label}: <a href="${sourceUrl}">${image?.caption ?? "Source plate"}</a></figcaption></figure>`;
    }
  );

  output = output.replace(/!\[(Image\s+\d+)\]\((https:\/\/(?:www\.)?sacred-texts\.com\/grim\/magus\/img\/[^)]+)\)/g, (_match, label: string, sourceUrl: string) => {
    const image = images.find((candidate) => candidate.sourceUrl === sourceUrl);
    if (image?.localPath) {
      return `<figure class="plate-figure"><img src="${image.localPath}" alt="${image.caption}" loading="lazy"><figcaption>${image.caption}</figcaption></figure>`;
    }
    return `<figure class="plate-reference"><figcaption>${label}: <a href="${sourceUrl}">${image?.caption ?? "Source image"}</a></figcaption></figure>`;
  });

  output = output.replace(/\[\]\([^)]+\)/g, "");
  return output.replace(/\n{3,}/g, "\n\n").trim();
}

function applyTextCorrections(markdown: string, chapterId: string): string {
  return TEXT_CORRECTIONS
    .filter((correction) => correction.chapterId === chapterId)
    .reduce((current, correction) => {
      return current.replaceAll(correction.before, correction.after);
    }, markdown);
}

function toPlainText(markdown: string): string {
  return markdown
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)]\([^)]+\)/g, "$1")
    .replace(/[#*_`~>|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderMarkdown(markdown: string): string {
  return String(marked.parse(markdown))
    .replace(/<a href="https:\/\/www\.sacred-texts\.com\/grim\/magus\/(ma\d+)\.htm[^"]*">([^<]+)<\/a>/g, "<span>$2</span>")
    .replace(/<p>\s*(<span class="page-marker"[^>]+>[^<]+<\/span>)\s*<\/p>/g, "$1");
}

export function buildChapter(
  rawMarkdown: string,
  entry: ReturnType<typeof parseIndex>[number],
  order: number
): EditionChapter {
  const id = sourceId(entry.sourceUrl);
  const slug = `${id}-${slugify(entry.title)}`;
  const cleaned = removeReaderChrome(rawMarkdown, entry.sourceUrl);
  const pageMarkers = collectPageMarkers(cleaned);
  const images = collectImages(cleaned, slug);
  const corrected = applyTextCorrections(cleaned, id);
  const markdown = normalizeSourceArtifacts(corrected, images);
  const plainText = toPlainText(markdown);
  const html = renderMarkdown(markdown);

  return {
    id,
    slug,
    title: entry.title,
    book: entry.book,
    section: entry.section,
    sourceUrl: entry.sourceUrl,
    order,
    isAppendix: entry.isAppendix,
    wordCount: plainText ? plainText.split(/\s+/).length : 0,
    pageMarkers,
    images,
    markdown,
    html,
    plainText
  };
}

export function summarizeChapter(chapter: EditionChapter): EditionChapterSummary {
  const {
    markdown: _markdown,
    html: _html,
    plainText: _plainText,
    ...summary
  } = chapter;
  return summary;
}

export function buildSections(chapters: EditionChapter[]): EditionSection[] {
  const sections = new Map<string, EditionSection>();

  for (const chapter of chapters) {
    const id = slugify(`${chapter.book}-${chapter.section}`);
    if (!sections.has(id)) {
      sections.set(id, {
        id,
        title: chapter.section,
        book: chapter.book,
        order: sections.size + 1,
        chapterSlugs: []
      });
    }
    sections.get(id)?.chapterSlugs.push(chapter.slug);
  }

  return [...sections.values()];
}
