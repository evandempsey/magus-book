import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { PLATE_IMAGE_ASSETS, type PlateImageAsset } from "./plate-assets";

const OUTPUT_DIR = path.resolve("public/assets/plates");
const REFRESH = process.env.MAGUS_REFRESH_PLATES === "1";
const MIN_IMAGE_BYTES = 1024;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function imageType(buffer: Buffer): string | undefined {
  if (buffer.length >= 4 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "jpeg";
  if (buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buffer.length >= 6 && /GIF8[79]a/.test(buffer.subarray(0, 6).toString("ascii"))) return "gif";
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") return "webp";
  return undefined;
}

function assertValidImage(buffer: Buffer, label: string) {
  const type = imageType(buffer);
  if (!type || buffer.length < MIN_IMAGE_BYTES) {
    throw new Error(`${label} is not a valid image (${buffer.length} bytes)`);
  }
}

async function existingValidImage(filePath: string): Promise<boolean> {
  try {
    assertValidImage(await readFile(filePath), filePath);
    return true;
  } catch {
    return false;
  }
}

async function fetchBytes(url: string): Promise<Buffer | undefined> {
  const response = await fetch(url, {
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "User-Agent": "magus-book-edition/0.1"
    },
    redirect: "follow"
  });

  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok || !contentType.startsWith("image/")) {
    return undefined;
  }

  return Buffer.from(await response.arrayBuffer());
}

async function downloadAsset(asset: PlateImageAsset) {
  const outputPath = path.join(OUTPUT_DIR, asset.filename);

  if (!REFRESH && await existingValidImage(outputPath)) {
    process.stdout.write(`Plate asset exists: ${asset.filename}\n`);
    return;
  }

  const candidates = [
    { label: "Sacred Texts", url: asset.sourceUrl },
    { label: "Internet Archive snapshot", url: asset.archiveUrl }
  ];

  for (const candidate of candidates) {
    const buffer = await fetchBytes(candidate.url);
    if (!buffer) continue;

    assertValidImage(buffer, `${asset.filename} from ${candidate.label}`);
    await writeFile(outputPath, buffer);
    process.stdout.write(`Fetched ${asset.filename} from ${candidate.label} (${buffer.length.toLocaleString()} bytes)\n`);
    return;
  }

  throw new Error(`Could not fetch ${asset.filename} from Sacred Texts or its archived snapshot`);
}

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true });

  for (const asset of PLATE_IMAGE_ASSETS) {
    await downloadAsset(asset);
    await sleep(150);
  }

  process.stdout.write(`Plate assets ready: ${PLATE_IMAGE_ASSETS.length} images in ${OUTPUT_DIR}\n`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
