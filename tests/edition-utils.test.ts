import { describe, expect, it } from "vitest";
import { buildChapter, parseIndex } from "../scripts/edition-utils";
import { localPathForImage, PLATE_IMAGE_ASSETS } from "../scripts/plate-assets";

describe("parseIndex", () => {
  it("extracts Sacred Texts chapter links with book and section context", () => {
    const entries = parseIndex(`
Markdown Content:
### The Magus, Book I
[Title Page](https://www.sacred-texts.com/grim/magus/ma100.htm)
### The First Principles of Natural Magic: Book the First
[Chapter I: Natural Magic Defined...](https://www.sacred-texts.com/grim/magus/ma106.htm)
`);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({ title: "Title Page", book: "Book I", section: "Front Matter" });
    expect(entries[1]).toMatchObject({ section: "The First Principles of Natural Magic: Book the First" });
  });
});

describe("buildChapter", () => {
  it("removes reader navigation and preserves page markers", () => {
    const chapter = buildChapter(`
Markdown Content:
[![Image 1](https://www.sacred-texts.com/cdshop/cdinfo.jpg)](https://www.sacred-texts.com/cdshop/index.htm)
[Sacred Texts](https://www.sacred-texts.com/index.htm)[Index](https://www.sacred-texts.com/grim/magus/index.htm)
* * *
# SAMPLE

[p. 10](https://www.sacred-texts.com/grim/magus/ma100.htm)

Text body.

* * *
[Next: Other](https://www.sacred-texts.com/grim/magus/ma101.htm)
`, {
      title: "Sample",
      sourceUrl: "https://www.sacred-texts.com/grim/magus/ma100.htm",
      book: "Book I",
      section: "Front Matter",
      isAppendix: false
    }, 1);

    expect(chapter.pageMarkers).toEqual(["10"]);
    expect(chapter.html).toContain("page-marker");
    expect(chapter.plainText).toContain("Text body");
    expect(chapter.plainText).not.toContain("Sacred Texts");
  });

  it("replaces discovered Sacred Texts image references with local plate images", () => {
    const chapter = buildChapter(`
Markdown Content:
* * *
# SAMPLE

[![Image 1](https://www.sacred-texts.com/grim/magus/tn/pl22.jpg) Click to view](https://www.sacred-texts.com/grim/magus/img/pl22.jpg)
`, {
      title: "Sample",
      sourceUrl: "https://www.sacred-texts.com/grim/magus/ma248.htm",
      book: "Book II",
      section: "Front Matter",
      isAppendix: false
    }, 1);

    expect(chapter.images[0]).toMatchObject({
      sourceUrl: "https://www.sacred-texts.com/grim/magus/img/pl22.jpg",
      localPath: "/assets/plates/pl22.jpg",
      caption: "PL22"
    });
    expect(chapter.html).toContain('src="/assets/plates/pl22.jpg"');
    expect(chapter.html).not.toContain("plate-reference");
  });
});

describe("plate assets", () => {
  it("maps every known Sacred Texts image to a local static path", () => {
    expect(PLATE_IMAGE_ASSETS).toHaveLength(30);
    for (const asset of PLATE_IMAGE_ASSETS) {
      expect(localPathForImage(asset.sourceUrl)).toBe(asset.localPath);
    }
  });
});
