import sitemap from "@astrojs/sitemap";
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "https://example.com",
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
