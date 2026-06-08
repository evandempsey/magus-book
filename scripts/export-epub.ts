import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import JSZip from "jszip";
import type { EditionChapter, EditionImage, EditionManifest } from "../src/lib/types";

const OUTPUT_NAME = "the-magus-francis-barrett.epub";
const PUBLIC_OUTPUT = path.resolve("public/downloads", OUTPUT_NAME);
const DIST_OUTPUT = path.resolve("dist/downloads", OUTPUT_NAME);

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function escapeXml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function toXhtml(html: string): string {
  return html
    .replace(/&nbsp;/g, "&#160;")
    .replace(/ loading="lazy"/g, "")
    .replace(/ src="\/assets\/plates\/([^"]+)"/g, ' src="../images/$1"')
    .replace(/<hr>/g, "<hr />")
    .replace(/<br>/g, "<br />")
    .replace(/<img([^>]*?)(?<!\/)>/g, "<img$1 />");
}

function uniqueLocalImages(manifest: EditionManifest): EditionImage[] {
  const seen = new Set<string>();
  return manifest.plates.filter((plate) => {
    if (!plate.localPath || seen.has(plate.localPath)) return false;
    seen.add(plate.localPath);
    return true;
  });
}

function imageFilename(localPath: string): string {
  return path.basename(localPath);
}

function imageId(localPath: string): string {
  return `image-${imageFilename(localPath).replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "").toLowerCase()}`;
}

function imageMediaType(localPath: string): string {
  const extension = path.extname(localPath).toLowerCase();
  if (extension === ".jpg" || extension === ".jpeg") return "image/jpeg";
  if (extension === ".png") return "image/png";
  if (extension === ".gif") return "image/gif";
  if (extension === ".webp") return "image/webp";
  throw new Error(`Unsupported EPUB image extension: ${localPath}`);
}

function chapterDocument(chapter: EditionChapter): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <title>${escapeXml(chapter.title)}</title>
    <link rel="stylesheet" type="text/css" href="../styles/edition.css" />
  </head>
  <body>
    <section class="chapter" id="${chapter.slug}">
      <header>
        <p class="kicker">${escapeXml(chapter.book)} · ${escapeXml(chapter.section)}</p>
        <h1>${escapeXml(chapter.title)}</h1>
      </header>
      ${toXhtml(chapter.html)}
    </section>
  </body>
</html>`;
}

function navDocument(manifest: EditionManifest): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="en">
  <head>
    <title>Contents</title>
    <link rel="stylesheet" type="text/css" href="styles/edition.css" />
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>Contents</h1>
      <ol>
        ${manifest.chapters.map((chapter) => `<li><a href="text/${chapter.slug}.xhtml">${escapeXml(chapter.title)}</a></li>`).join("\n        ")}
      </ol>
    </nav>
  </body>
</html>`;
}

function packageDocument(manifest: EditionManifest, modified: string, images: EditionImage[], coverImage: EditionImage): string {
  const items = manifest.chapters
    .map((chapter) => `<item id="${chapter.id}" href="text/${chapter.slug}.xhtml" media-type="application/xhtml+xml" />`)
    .join("\n    ");
  const imageItems = images
    .map((image) => {
      const isCover = image.localPath === coverImage.localPath;
      const id = isCover ? "cover-image" : imageId(image.localPath ?? "");
      const properties = isCover ? ' properties="cover-image"' : "";
      return `<item id="${id}" href="images/${imageFilename(image.localPath ?? "")}" media-type="${imageMediaType(image.localPath ?? "")}"${properties} />`;
    })
    .join("\n    ");
  const spine = manifest.chapters
    .map((chapter) => `<itemref idref="${chapter.id}" />`)
    .join("\n    ");

  return `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" unique-identifier="book-id" version="3.0">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="book-id">urn:public-domain:francis-barrett:the-magus:1801</dc:identifier>
    <dc:title>${escapeXml(manifest.title)}</dc:title>
    <dc:creator>${escapeXml(manifest.author)}</dc:creator>
    <dc:language>en</dc:language>
    <dc:publisher>Local digital edition</dc:publisher>
    <dc:date>${manifest.publicationYear}</dc:date>
    <meta property="dcterms:modified">${modified}</meta>
    <meta name="cover" content="cover-image" />
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="cover" href="cover.xhtml" media-type="application/xhtml+xml" />
    <item id="style" href="styles/edition.css" media-type="text/css" />
    ${imageItems}
    ${items}
  </manifest>
  <spine>
    <itemref idref="cover" />
    ${spine}
  </spine>
</package>`;
}

function coverDocument(manifest: EditionManifest, coverImage: EditionImage): string {
  const localPath = coverImage.localPath;
  if (!localPath) throw new Error("EPUB cover image is missing a localPath");

  return `<?xml version="1.0" encoding="utf-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" lang="en">
  <head>
    <title>${escapeXml(manifest.title)}</title>
    <link rel="stylesheet" type="text/css" href="styles/edition.css" />
  </head>
  <body class="cover">
    <section>
      <img src="images/${imageFilename(localPath)}" alt="${escapeXml(coverImage.caption)}" />
      <h1>${escapeXml(manifest.title)}</h1>
      <p>${escapeXml(manifest.subtitle)}</p>
      <p>by ${escapeXml(manifest.author)}</p>
    </section>
  </body>
</html>`;
}

async function writeBoth(buffer: Buffer) {
  await mkdir(path.dirname(PUBLIC_OUTPUT), { recursive: true });
  await writeFile(PUBLIC_OUTPUT, buffer);

  try {
    await mkdir(path.dirname(DIST_OUTPUT), { recursive: true });
    await writeFile(DIST_OUTPUT, buffer);
  } catch {
    // The dist directory may not exist before a site build.
  }
}

async function main() {
  const manifest = await readJson<EditionManifest>("data/edition/manifest.json");
  const chapters = await readJson<EditionChapter[]>("data/edition/chapters.json");
  const zip = new JSZip();
  const modified = new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
  const images = uniqueLocalImages(manifest);
  const coverImage = images.find((image) => image.sourceUrl.endsWith("/pl01.jpg")) ?? images[0];

  if (!coverImage?.localPath) {
    throw new Error("No local plate image available for EPUB cover");
  }

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });
  zip.file("META-INF/container.xml", `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/package.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>`);

  zip.file("OEBPS/package.opf", packageDocument(manifest, modified, images, coverImage));
  zip.file("OEBPS/nav.xhtml", navDocument(manifest));
  zip.file("OEBPS/cover.xhtml", coverDocument(manifest, coverImage));
  zip.file("OEBPS/styles/edition.css", `body{font-family:Georgia,serif;line-height:1.55;color:#171c18;background:#fffdf8}h1,h2,h3{font-weight:500;line-height:1.08}.kicker{font-family:sans-serif;text-transform:uppercase;letter-spacing:.12em;color:#7b4d2f;font-size:.78em}.source-lines{margin:1.3em 0;line-height:1.35}.source-line{display:block;margin:.2em 0;padding-left:1.2em;text-indent:-1.2em}.source-line-heading{color:#7b4d2f;font-family:sans-serif;font-size:.86em;font-weight:700;text-transform:uppercase}.source-line-with-reference{display:table;width:100%;padding-left:0;text-indent:0}.source-line-text{display:table-cell}.source-line-reference{display:table-cell;width:3em;color:#6b665b;font-family:sans-serif;font-size:.82em;text-align:right}.page-marker{display:block;text-align:right;color:#6b665b;font-family:sans-serif;font-size:.78em}.plate-figure,.plate-reference{border:1px solid #d8ccba;padding:.75em;margin:1.5em 0}.plate-figure img{max-width:100%}.cover{text-align:center}.cover img{max-width:80%;margin:2em auto;display:block}`);

  for (const image of images) {
    if (!image.localPath) continue;
    zip.file(`OEBPS/images/${imageFilename(image.localPath)}`, await readFile(path.resolve("public", image.localPath.replace(/^\//, ""))));
  }

  for (const chapter of chapters) {
    zip.file(`OEBPS/text/${chapter.slug}.xhtml`, chapterDocument(chapter));
  }

  const buffer = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    mimeType: "application/epub+zip"
  });

  await writeBoth(buffer);
  process.stdout.write(`EPUB written to ${PUBLIC_OUTPUT}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
