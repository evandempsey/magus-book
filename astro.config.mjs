import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://evandempsey.github.io",
  base: "/magus-book",
  integrations: [sitemap()],
  build: {
    format: "directory"
  },
  vite: {
    server: {
      fs: {
        allow: ["."]
      }
    }
  }
});
