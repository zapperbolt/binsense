# BinSense

BinSense is a photo-assisted waste sorting guide for Singapore. It helps people identify common household items, learn how to sort them, and find nearby collection points for selected waste categories.

The app is built with React and JavaScript. Vite runs the website during development and creates the production front end. A small Node.js server provides API endpoints for Gemini and collection-point data. TensorFlow.js MobileNet can classify images directly in the browser as a fast, on-device option.

## Features

- **Photo scan:** choose or take a photo and get possible matches from BinSense's curated item guide.
- **Sorting guide:** browse item-specific advice for recycling, general waste, e-waste, and other categories.
- **Nearby collection points:** view supported collection locations on a map and optionally use your device location.
- **MobileNet image labels:** run a general image classifier in the browser without sending the image to Gemini.
- **Gemini image analysis and chat:** use Gemini to inspect photos or answer sorting questions. The Gemini API key stays on the Node.js server; it is not placed in the browser code.

Sorting depends on the material and condition of an item. A photo may not show whether something is clean, empty, or made from a specific material. Check the item guidance when uncertain. Collection listings can change, so confirm a location accepts your item before travelling.

## How the image options differ

### MobileNet in your browser

TensorFlow.js loads a general-purpose MobileNet model in the browser. This can feel fast and works without a Gemini API key. However, MobileNet was trained to recognize broad everyday image labels, not Singapore waste categories. BinSense maps some labels to its own catalog, so the suggested waste match can be inaccurate, especially for unfamiliar items or images with multiple objects.

### Gemini through the Node.js server

The browser sends the selected image to the local Node.js API, which calls Google's Gemini API. Gemini can use more visual context, but it requires internet access and an API key. Response time and availability depend on the model and the API service.

Neither option should be treated as certain when the material or condition is unclear.

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

Keep your real key in .env. Do not put it in `src/`, commit it to GitHub, or share it publicly. Git ignores .env; .env.example is the safe template. Without a key, the app can still use the on-device MobileNet option, but Gemini features will be unavailable.

### 4. Start the Node.js server

In a Terminal window, from the project folder, run:

```sh
pnpm run server
```

Leave this window open. The server reads .env from the project root and provides the app's API endpoints.

### 5. Start the website

Open a second Terminal window, go to the same project folder, and run:

```sh
pnpm run dev
```

Vite prints a local address, usually http://localhost:5173. Open that address in your browser. Keep both Terminal windows running while using the app. To stop either process, focus its Terminal window and press `Ctrl+C`.

## Production build

To create an optimized front-end build, run:

```sh
pnpm run build
```

The generated files go into `dist/`. The Node.js server can serve that build and the API together when started with `pnpm run server`. A public deployment needs a host that can run the Node.js server and securely provide the Gemini environment variable; uploading only the front-end files to a static host will not provide the API.

## Project layout

- `src/App.jsx` — main React application and its screens and interactions.
- `src/main.jsx` — starts the React app in the browser and loads shared styles.
- `src/styles.css` — application styling.
- `src/data/items.json` — curated item guide data used by the interface.
- `server.js` — Node.js API for Gemini analysis/chat and collection-point data.
- `index.html` — page Vite loads to start the React app.
- `vite.config.js` — Vite development and build configuration.
- `package.json` — project scripts and direct dependencies.
- `pnpm-lock.yaml` — exact dependency versions used by pnpm.
- `pnpm-workspace.yaml` — pnpm workspace configuration.
- `.env.example` — safe template for local environment settings.
- `.gitignore` — tells Git to ignore local secrets, installed packages, and generated files.

## Current limitations

- MobileNet is a general image classifier, not a waste-specific model. Its suggested item match can be wrong.
- Gemini needs a valid key and internet access, and can be slower or temporarily unavailable due to API limits.
- Images cannot reliably show every material, cleanliness, or contents. Use the guide and ask for clarification when needed.
- Collection-point data comes from public datasets and may be incomplete or out of date.

For current recycling rules, consult the relevant official Singapore agency guidance and the instructions at the collection point.
