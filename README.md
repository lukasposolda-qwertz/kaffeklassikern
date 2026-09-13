# Kaffeklassikern

Discover Sweden's roasteries and keep a personal record of the coffees you taste. An independent hobby project with 80 active roasters, supplied images, regional progress and 10/20/50 milestones.

## Run and check

Requires Node.js 22 or later. No dependencies to install.

```sh
npm start
npm test
npm run check
```

Open http://127.0.0.1:4173/. The directly authored static site is in `dist/`; `npm run build` validates it. Personal progress and notes stay in browser storage. Export makes a local backup. There are no accounts or analytics.

## Publish

Use **kaffeklassikern** as the GitHub repository name. This folder is the repository root; publish only this folder, not its parent workspace. Private originals and working material are kept outside it.

The included Pages workflow is manually triggered. Contact uses Formspree with the recipient configured privately in that service; the site contains only an opaque form URL. Contact is disabled until configured, and the release workflow refuses to deploy without that configuration. Repository links are filled from the actual GitHub repository during release.

Follow [deployment setup](docs/DEPLOYMENT.md), including the remaining release issues. No public deployment is implied by this source tree.

## Maintenance

- `dist/data/catalog.json`: canonical catalogue with stable roaster IDs.
- `dist/data/map-attribution.json`: map sources and licence status.
- `dist/site-config.json` and `dist/contact.js`: contact configuration and submission.
- `docs/CATALOGUE.md`: catalogue maintenance rules.
- `docs/ASSETS.md` and `docs/asset-manifest.json`: supplied image records.
- `tests/`: collection, storage and contact regression tests.

The legacy storage key `rosteriklassikern.collection.v1` and backup format `rosteriklassikern-collection` remain unchanged to preserve existing progress. There is no import option in the interface. Changing the site address creates a separate browser-storage origin.

## Licensing

Application code is MIT-licensed. This does not cover roastery photographs, logos, trademarks or map data. Image reuse permission has not been obtained. See [third-party notices](THIRD_PARTY_NOTICES.md) for OpenStreetMap ODbL credit and the county-shape licence status.
