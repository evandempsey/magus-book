# The Magus Digital Edition

A readable digital edition of Francis Barrett's public-domain *The Magus*.

Deployed site: <https://evandempsey.github.io/magus-book/>

The project generates three outputs from one canonical data set:

- Static website reader
- Trade-book PDF
- EPUB

## Workflow

```sh
npm install
npm run scrape
npm run build
npm run export:epub
npm run export:pdf
```

Local preview is served with the same base path as GitHub Pages:

```sh
npm run dev
# open http://localhost:4321/magus-book/
```

GitHub Pages deployment uses the workflow in `.github/workflows/deploy.yml`. In the GitHub repository settings, set Pages → Build and deployment → Source to GitHub Actions.

`npm run scrape` reads the Sacred Texts edition through a reader fallback when direct Sacred Texts requests are blocked. The generated edition data lives in `data/edition`.

## Notes

The edition preserves Barrett's wording and historical spelling while fixing only obvious layout and source artefacts. Any text-level correction should be recorded in `data/edition/corrections.json`.
