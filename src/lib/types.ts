export interface EditionImage {
  id: string;
  chapterSlug: string;
  sourceUrl: string;
  thumbUrl?: string;
  localPath?: string;
  caption: string;
}

export interface EditionChapterSummary {
  id: string;
  slug: string;
  title: string;
  book: string;
  section: string;
  sourceUrl: string;
  order: number;
  isAppendix: boolean;
  wordCount: number;
  pageMarkers: string[];
  images: EditionImage[];
  previousSlug?: string;
  nextSlug?: string;
}

export interface EditionChapter extends EditionChapterSummary {
  markdown: string;
  html: string;
  plainText: string;
}

export interface EditionSection {
  id: string;
  title: string;
  book: string;
  order: number;
  chapterSlugs: string[];
}

export interface EditionCorrection {
  id: string;
  chapterId: string;
  before: string;
  after: string;
  reason: string;
}

export interface EditionManifest {
  title: string;
  subtitle: string;
  author: string;
  publicationYear: number;
  generatedAt: string;
  source: {
    label: string;
    url: string;
    readerFallback: string;
  };
  totalChapters: number;
  totalWords: number;
  sections: EditionSection[];
  chapters: EditionChapterSummary[];
  plates: EditionImage[];
}
