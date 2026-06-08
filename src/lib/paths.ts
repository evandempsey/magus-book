const BASE_URL = import.meta.env.BASE_URL ?? "/";
const BASE_PATH = BASE_URL.replace(/\/$/, "");

export function sitePath(path = "/"): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(path) || path.startsWith("#")) return path;
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${BASE_PATH}${normalizedPath}` || "/";
}

export function localAssetPath(path: string | undefined): string | undefined {
  return path ? sitePath(path) : undefined;
}

export function rewriteLocalHtmlPaths(html: string): string {
  return html.replace(/((?:src|href)=["'])\/(assets\/[^"']+)(["'])/g, `$1${BASE_PATH}/$2$3`);
}
