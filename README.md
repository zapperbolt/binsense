# BinSense

BinSense helps people sort household waste in Singapore. Take or upload a photo, let Gemini identify recognizable items, then see the matching guidance from BinSense's curated disposal guide and browse nearby collection points in the app.

## What it does

- Gemini can identify multiple visible items in one photo and match them against BinSense's sample catalog.
- Disposal rules and instructions come from the app, not from the AI response.
- The app includes recycling, composting, general waste, e-waste, textile, and Return Right guidance.
- The Nearby bins page embeds Singapore's official live recycling locator, including beverage-return, e-waste, textile, and general recycling locations.
- The browser shrinks large photos before sending them to the local Python server.

This is an educational prototype. The catalog is incomplete and AI matches can be wrong. The photo cannot reveal hidden material, residue, or a Return Right deposit mark. Check official guidance before disposing of uncertain items.

## Privacy and free-tier notes

Photo analysis sends the image from BinSense's local Python server to Google's Gemini API. Do not upload private or sensitive images. Google's free API tier has changing quotas, and Google states that free-tier content may be used to improve its products. Check the current [pricing](https://ai.google.dev/gemini-api/docs/pricing) and [rate limits](https://ai.google.dev/gemini-api/docs/rate-limits).

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

- `index.html` — interface, photo upload/compression, item guide, and embedded locator.
- `server.py` — local web server and Gemini API bridge. It keeps the API key out of the browser.
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
- [Cloop: donation and textile-bin guidance](https://cloop.sg/donate/)
- [Gemini image understanding and object detection](https://ai.google.dev/gemini-api/docs/image-understanding)
