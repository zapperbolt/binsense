# BinSense

**BinSense** is a photo-assisted household waste-sorting prototype. It helps someone check an item, understand the right next step, and learn why the answer changes based on material, contamination, or special collection needs.

## What works in this prototype

- Take a photo on a phone or choose/drop an image on a computer.
- Select the matching item from a built-in catalog and get Singapore-specific demo guidance.
- View quick recycling, composting, and e-waste guidance.
- Keep recent checks in the browser on the current device.
- Open the cited NEA guidance from each answer.

**Image recognition is not connected yet.** The photo is a visual reference only; the person confirms the item from the catalog. The interface says so rather than pretending to run a vision model. No photo is uploaded or stored by BinSense. The catalog is a small educational sample, not a complete official waste database. Always check local collection rules.

## Run it

Open `index.html` in a modern browser. No install, API key, or server is required. Camera access may depend on the browser; choosing a photo works as a fallback.

## Tech used

- HTML for the page structure
- CSS for layout and styling
- JavaScript for item lookup, photo preview, local history, and navigation
- `localStorage` for recent checks on this device

## Data sources

- [NEA: Recycling at home](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/waste-minimisation-and-recycling/at-home)
- [NEA: Food waste management strategies](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/food-waste-management/food-waste-management-strategies)
- [NEA: E-waste management](https://www.nea.gov.sg/our-services/waste-management/3r-programmes-and-resources/e-waste-management)

## Next build steps

1. Connect a vision model to suggest a likely catalog item, with a confidence score.
2. Ask a follow-up when the photo cannot reveal an important condition, such as whether packaging is food-stained.
3. Add a verified local collection-point lookup for special items.

## Project note

Singapore already has official recycling resources, including NEA's Recycle Right / Bloobin services. BinSense is a learning prototype, not a replacement for those services. Its direction is to combine photo capture, item-condition follow-up, transparent reasoning, and a simple local action in one flow.
