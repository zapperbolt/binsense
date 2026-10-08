# BinSense

BinSense helps people sort household waste in Singapore. Take or upload a photo, let Gemini identify recognizable items, then see the matching guidance from BinSense's curated disposal guide and browse nearby collection points in the app.

## What it does

- Gemini can identify multiple visible items in one photo and match them against BinSense's sample catalog.
- Ask BinSense is a multi-turn Gemini chat: it can discuss missed or unlisted items, answer follow-up questions, and show in-app locator buttons when an item matches a supported collection category. Disposal guidance is constrained by BinSense's Singapore sorting rules; uncertain materials or unsupported locator categories should be clarified rather than presented as verified facts.
- Disposal rules and instructions come from the app, not from the AI response.
- The app includes recycling, composting, general waste, e-waste, textile, and Return Right guidance.
- The Nearby bins page requests browser location, sorts collection points by distance, and displays results on a BinSense map.
- Blue-bin, e-waste, and clothing/reuse points are loaded from NEA's public data.gov.sg GeoJSON datasets and cached by the local server for six hours.
- Return Right live machine locations and operating status are not in a documented open dataset, so that category currently points to the operator's live locator rather than inventing machine locations.
- The Community page demonstrates a photo-and-location check-in, estate selection, and a pending-points leaderboard. It is local to one browser and is not a shared or verified rewards system.
- The browser shrinks large photos before sending them to the local Python server.

This is an educational prototype. The catalog is incomplete and AI matches can be wrong. The photo cannot reveal hidden material, residue, or a Return Right deposit mark. Public location datasets may be outdated; confirm a point accepts the item before travelling. A photo and GPS check-in cannot prove that an item was deposited in the correct bin. Community points remain pending and are stored only in the current browser.

## Privacy and free-tier notes

Photo analysis sends the image from BinSense's local Python server to Google's Gemini API. Ask BinSense sends the current message and recent chat context to Gemini to answer questions and identify supported locator categories. Do not submit private or sensitive information. Google's free API tier has changing quotas, and Google states that free-tier content may be used to improve its products. Check the current [pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

The API key is read by `server.py` from a local `.env` file. `.env` is excluded from Git by `.gitignore`; never paste a real key into `index.html`, `.env.example`, or GitHub. Anyone who downloads the repository needs their own key. GitHub Pages alone cannot run this backend.

## Run BinSense locally

Requirements: Python 3, an internet connection, and a Gemini API key. No Python packages are required.

1. Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Copy `.env.example` to a new file named `.env`, then replace the placeholder with your key:

   ```text
   GEMINI_API_KEY=your_real_key_goes_here
   GEMINI_MODEL=gemini-3.8-flash
   ```

3. In Terminal, go to the folder containing `server.py` and run:

   ```sh
   python3 server.py
   ```

Keep that Terminal window open and visit <http://127.0.0.1:5050>. Press `Control+C` in Terminal to stop BinSense. The real key belongs only in `.env` on your computer; do not upload that file to GitHub.

## Files

- `index.html` — interface, photo upload/compression, conversational chat, item guide, in-app map, and local community prototype.
- `server.py` — local web server, Gemini image and chat endpoints, and cached open-data location endpoints. It keeps the API key out of the browser.
- `.env.example` — safe template showing which private settings belong in `.env`.
- `.gitignore` — excludes `.env`, operating-system clutter, and Python cache files from Git.

## GitHub Pages note

GitHub Pages can host the static page, but it cannot run `server.py` or safely keep a private Gemini API key. The AI feature currently works when BinSense is opened through the local Python server. Sharing a public working demo needs a deployed backend that stores the key securely; visitors should not be asked to put your personal key in the page.

## Data sources

- [NEA: Recycling at home](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/waste-minimisation-and-recycling/at-home)
- [NEA: Food waste management strategies](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/food-waste-management/food-waste-management-strategies)
- [NEA: E-waste management](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/e-waste-management)
- [NEA: Beverage Container Return Scheme for consumers](https://www.nea.gov.sg/our-services/waste-management/beverage-container-return-scheme/for-consumers)
- [Singapore recycling-location finder](https://www.recycle.gov.sg/locations)
- [NEA Recycling Bins dataset on data.gov.sg](https://data.gov.sg/datasets/d_4dde14826642f49eefff48b7832b90db/view) (last updated June 2024)
- [NEA E-waste Recycling dataset on data.gov.sg](https://data.gov.sg/datasets/d_db40d004afeb5a7f0f555fdcc34934cc/view) (underlying point data from June 2022; NEA warns it may be outdated)
- [NEA Channels for Donation, Resale and Repair dataset on data.gov.sg](https://data.gov.sg/datasets/d_7e1f0da76a744c85e3d3ecc76642dcb5/view) (last updated January 2024)
- [Return Right live machine locator](https://returnright.sg/p/find-my-nearest-rvm)
- [Cloop: donation and textile-bin guidance](https://cloop.sg/donate/)
- [Gemini image understanding and object detection](https://ai.google.dev/gemini-api/docs/image-understanding)
