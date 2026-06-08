const SACRED_TEXTS_IMAGE_BASE = "https://www.sacred-texts.com/grim/magus/img/";
const LOCAL_PLATE_BASE = "/assets/plates/";

export const PLATE_IMAGE_FILENAMES = [
  "front.jpg",
  "13300.jpg",
  "14100.jpg",
  "14101.jpg",
  "14102.jpg",
  "14200.jpg",
  "pl01.jpg",
  "pl02.jpg",
  "pl03.jpg",
  "pl04.jpg",
  "pl05.jpg",
  "16500.jpg",
  "pl06.jpg",
  "pl07.jpg",
  "pl08.jpg",
  "pl09.jpg",
  "pl10.jpg",
  "pl11.jpg",
  "pl12.jpg",
  "pl13.jpg",
  "pl14.jpg",
  "pl15.jpg",
  "pl16.jpg",
  "pl17.jpg",
  "pl18.jpg",
  "pl19.jpg",
  "pl20.jpg",
  "pl21.jpg",
  "pl22.jpg",
  "13500.jpg"
] as const;

export type PlateImageFilename = typeof PLATE_IMAGE_FILENAMES[number];

export interface PlateImageAsset {
  filename: PlateImageFilename;
  sourceUrl: string;
  archiveUrl: string;
  localPath: string;
}

const PLATE_IMAGE_FILENAME_SET = new Set<string>(PLATE_IMAGE_FILENAMES);

export function canonicalImageUrl(filename: PlateImageFilename): string {
  return `${SACRED_TEXTS_IMAGE_BASE}${filename}`;
}

export function archiveImageUrl(sourceUrl: string): string {
  return `https://web.archive.org/web/0if_/${sourceUrl}`;
}

export function localPathForPlateFilename(filename: string): string | undefined {
  return PLATE_IMAGE_FILENAME_SET.has(filename) ? `${LOCAL_PLATE_BASE}${filename}` : undefined;
}

export function localPathForImage(sourceUrl: string): string | undefined {
  const filename = sourceUrl.split("/").at(-1);
  return filename ? localPathForPlateFilename(filename) : undefined;
}

export const PLATE_IMAGE_ASSETS: PlateImageAsset[] = PLATE_IMAGE_FILENAMES.map((filename) => {
  const sourceUrl = canonicalImageUrl(filename);
  return {
    filename,
    sourceUrl,
    archiveUrl: archiveImageUrl(sourceUrl),
    localPath: `${LOCAL_PLATE_BASE}${filename}`
  };
});
