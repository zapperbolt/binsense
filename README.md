# BinSense

BinSense helps people sort household waste in Singapore. It uses a React interface, a local Node.js server for Gemini and collection-point data, and an on-device MobileNet option for quick image labels.

## Run locally

You need Node.js and pnpm. Keep the project folder on your computer; GitHub stores the code but does not run the app.

1. Create a .env file in the project root and add your Gemini key:

GEMINI_API_KEY=your_key_here

Keep this key private. The .env.example file shows the expected format.

2. In Terminal, open the project folder and run:

pnpm install
pnpm run server

3. Leave that Terminal window running. Open a second Terminal window in the same folder and run:

pnpm run dev

4. Open the local address Vite prints, usually http://localhost:5173.

Gemini image analysis and chat need a valid API key and internet access. MobileNet runs in the browser and is a fast, general-purpose image model; its labels are less reliable for waste sorting.

## Project files

- src/ — React screens, styling, and item guide data.
- server.js — local Node.js API for Gemini and collection-point data.
- index.html — browser page loaded by Vite.
- vite.config.js — development server configuration.
- package.json and pnpm-lock.yaml — project scripts and dependency versions.
- .env.example and .gitignore — environment variable example and files Git should ignore.

To make a production build, run pnpm run build. The Node.js server can then serve the built app and API together.
