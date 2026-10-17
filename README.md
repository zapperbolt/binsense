# BinSense React / JavaScript migration

This is the new React + JavaScript version, kept beside the existing `index.html` and `server.py` while the migration is in progress. The original app remains available and unchanged.

## Current first slice

- React scan, guide, nearby collection points, and local community screens.
- The 15 existing item guides are carried over, with 10 additional presets for plastic bags, shampoo bottles, magazines, egg trays, foil, empty aerosol cans, light bulbs, laptops, power banks and ceramic/Pyrex cookware. New guidance follows [NEA's Recycling Guide v6](https://www.nea.gov.sg/docs/default-source/our-services/waste-management/recycling-guide_v6.pdf); ambiguous material or condition stays explicit.
- MobileNet runs in the browser as a speed baseline. Its standard model uses general ImageNet labels, not waste categories; use Gemini for disposal suggestions and treat MobileNet output as rough labels only.
- Optional Gemini photo and chat routes run through Node. The API key stays on the Node side.
- The Node endpoint fetches and caches NEA location datasets for six hours.

## Run locally

Requirements: Node.js 20+ and an internet connection. From this directory:

```sh
pnpm install
pnpm run server
```

Then in a second Terminal window:

```sh
pnpm run dev
```

Open the Vite URL shown in Terminal. The Node server reads the existing `../.env` file. `GEMINI_API_KEY` is optional for MobileNet and location lookup, but required for hosted Gemini analysis and chat. Do not put API keys in `src/` or browser code.

To build a production bundle, run `pnpm run build`, then `pnpm run server`; Node serves `dist/` and the API from the same origin.

## Current limitations and next work

- Standard MobileNet is not a waste-trained model and does not detect multiple objects. The label-to-item bridge is intentionally a weak baseline, not a trusted classification result.
- The nearby page carries over the Leaflet map, uses browser location when granted, and sorts collection-point cards by distance.
- The current catalog contains 25 items. Continue expanding it only with matching Singapore-specific guidance.
- The existing `server.py` and root `index.html` remain intact during migration and can be used as a fallback.
