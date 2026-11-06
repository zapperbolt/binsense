# BinSense

BinSense is a photo-assisted waste sorting guide for Singapore. It helps people identify common household items, learn how to sort them, and find nearby collection points for selected waste categories.

The app is built with React and JavaScript. Vite runs the website during development and creates the production front end. A small Node.js server provides API endpoints for Gemini and collection-point data.

## Features

- **Photo scan with item tagging:** choose or take a photo; each recognised object gets a numbered box on the photo and a matching numbered result, so you can tell which object is which.
- **Not-recyclable warnings:** each result is badged Recyclable, Not recyclable (general waste), E-waste or Textile. A banner warns when items can't go in any recycling bin, and filter chips narrow the list.
- **Condition warnings:** when Gemini can see liquid inside or food on a recyclable, the item says to empty or rinse it first.
- **"Wrong item?" corrections:** fix a wrong match in one tap. The result updates immediately and the correction is saved on the server (`pnpm corrections:summary` lists the most common mistakes).
- **Four languages + read aloud:** English, 中文, Bahasa Melayu and தமிழ். The whole interface and item guide are translated, Gemini labels and chat replies follow the chosen language, and guidance can be read aloud where the device has a voice for that language.
- **Report a bin:** flag overflowing, contaminated, damaged or missing bins with a map pin, a note and an optional photo. Reports from the last 30 days are public on a map.
- **Sorting guide:** browse item-specific advice for recycling, general waste, e-waste, and other categories.
- **Nearby collection points:** view supported collection locations on a map and optionally use your device location.
- **Gemini image analysis and chat:** use Gemini to inspect photos or answer sorting questions. The Gemini API key stays on the Node.js server; it is not placed in the browser code.

Sorting depends on the material and condition of an item. A photo may not show whether something is clean, empty, or made from a specific material. Check the item guidance when uncertain. Collection listings can change, so confirm a location accepts your item before travelling.

## How photo analysis works

The browser shrinks the photo and sends it to the local Node.js API, which calls Google's Gemini API. Gemini must answer in a fixed JSON schema: for each object, a catalog item ID, a short label (for example "clear bottle, left side") and a bounding box. The server drops unknown IDs and malformed boxes before anything reaches the browser. An item with a bad box is still listed, just without a marker on the photo.

Gemini needs internet access and an API key. Response time and availability depend on the model and the API service. Treat results as suggestions when the material or condition is unclear.

## Run locally

### Requirements

- Node.js installed on your computer
- pnpm, the package manager used by this project
- Internet access to install packages and use Gemini or live collection-point data

### 1. Get the project

If you already downloaded or cloned the repository, open Terminal and go to the project folder. To clone it from GitHub, run:

```sh
git clone https://github.com/zapperbolt/binsense.git
cd binsense
```

### 2. Install dependencies

From inside the project folder, run:

```sh
pnpm install
```

This installs the packages listed by the project. You normally only need to do it the first time, or after dependencies change.

### 3. Configure Gemini (optional)

To enable Gemini image analysis and chat, create your private local environment file from the example:

```sh
cp .env.example .env
```

Open the new .env file in a text editor. Replace the placeholder value for `GEMINI_API_KEY` with your Google AI Studio key. The example also sets `GEMINI_MODEL`; you can leave that value as it is.

Keep your real key in .env. Do not put it in `src/`, commit it to GitHub, or share it publicly. Git ignores .env; .env.example is the safe template. Without a key, the guide, map and manual item picker still work, but photo analysis and chat are unavailable.

### 4. Start the Node.js server

In a Terminal window, from the project folder, run:

```sh
pnpm run server
```

Leave this window open. The server reads .env from the project folder (or, if not found there, its parent folder) and provides the app's API endpoints.

### 5. Start the website

Open a second Terminal window, go to the same project folder, and run:

```sh
pnpm run dev
```

Vite prints a local address, usually http://localhost:5173. Open that address in your browser. Keep both Terminal windows running while using the app. To stop either process, focus its Terminal window and press `Ctrl+C`.

## Run the tests

```sh
pnpm test
```

Vitest runs the unit and API tests in `test/`. The API tests start the real Express app with a fake Gemini, so they need no API key or internet.

## Translations

UI text lives in `src/i18n/{en,zh,ms,ta}.js`; translated item guidance in `src/data/i18n/{zh,ms,ta}.json`. English is the source: `pnpm test` fails if another language is missing a key, a placeholder like `{count}` or an item field. The Chinese, Malay and Tamil text was machine-translated and should be reviewed by native speakers before real use.

## Production build

```sh
pnpm run build
pnpm start
```

`pnpm run build` writes the optimised website to `dist/`; `pnpm start` runs the Node server, which serves `dist/` and the API together on one address.

## Deploy a public link (Render)

The repo includes `render.yaml`, a Render Blueprint:

1. Push the repo to GitHub.
2. On render.com: **New → Blueprint**, pick the repo. Render reads `render.yaml`.
3. When asked, paste your `GEMINI_API_KEY`. It is stored by Render, not in the code.
4. Render builds and gives you a public `https://….onrender.com` link.

Server settings (environment variables):

| Variable | Default | Purpose |
| --- | --- | --- |
| `GEMINI_API_KEY` | – | Enables photo analysis and chat |
| `GEMINI_MODEL` | `gemini-3.8-flash` | Gemini model name |
| `HOST` / `PORT` | `127.0.0.1` / `5051` | Where the server listens (Render sets these) |
| `TRUST_PROXY` | `0` | Number of proxies in front of the app (`1` on Render) so rate limits see real visitor IPs |
| `DATA_DIR` | `./data` | Where reports, corrections and report photos are stored |

Public-use protections: per-IP rate limits (photo analysis 20 per 10 minutes, reports 10 per hour), request size limits, security headers with a Content-Security-Policy, and validation of every stored field.

Important: Render's free plan has no persistent disk, so reports and corrections are wiped on each redeploy or restart. For lasting data, use a paid plan with a disk (see the comment in `render.yaml`) or move `server/store.js` to a database.

## Project layout

- `src/App.jsx` — app shell: header, navigation, language picker, footer.
- `src/pages/` — one component per tab: Scan, Nearby, Report a bin, Quick guide, Community.
- `src/hooks/` — state that survives switching tabs: photo scan, nearby search, location, chat.
- `src/components/` — photo boxes and results, item guide (with read aloud), shared map.
- `src/i18n/` — language loading and UI text in four languages.
- `src/lib/` — small helpers: disposal grouping, API calls, speech, distance, safe localStorage, photo resizing.
- `src/data/items.json` — the curated item guide; the single source of truth for item IDs.
- `src/data/i18n/` — item guide translations.
- `server.js` — entry point: reads settings and `.env`, starts the server.
- `server/app.js` — Express routes, rate limits, security headers.
- `server/gemini.js` — photo prompt, response schema, validation of Gemini's answer.
- `server/reports.js`, `server/corrections.js` — validation for community reports and corrections.
- `server/store.js` — small JSON-file store used for reports and corrections.
- `server/catalog.js`, `server/locations.js` — catalog for Gemini; NEA GeoJSON parsing.
- `scripts/corrections-summary.js` — prints the most common corrections.
- `test/` — Vitest unit and API tests (no API key or internet needed).
- `render.yaml` — Render deployment blueprint.

## Current limitations

- Reports and corrections have no user accounts; rate limits reduce spam but can't stop a determined abuser. There is no moderation screen yet.
- Read aloud depends on the voices installed on each device; Malay and Tamil voices are often missing.
- Bounding boxes come from Gemini and can be loose or slightly off, especially for overlapping objects.
- Gemini needs a valid key and internet access, and can be slower or temporarily unavailable due to API limits.
- Images cannot reliably show every material, cleanliness, or contents. Use the guide and ask for clarification when needed.
- Collection-point data comes from public datasets and may be incomplete or out of date.

For current recycling rules, consult the relevant official Singapore agency guidance and the instructions at the collection point.
