# Brand and marketing image generators

These scripts draw the marketing images as SVG and render them to PNG with
[sharp](https://sharp.pixelplumbing.com/). They write straight into
`../public/brand/`, overwriting the previous version each time.

They were written in a temporary session folder and copied here so they survive —
the images were easy to regenerate, the scripts were not.

## Running them

`sharp` is not a dependency of the app, so install it once in this folder:

```bash
cd brand-tools
npm init -y
npm install sharp
node make-social-card.js
```

## What each one makes

| Script | Output | Used for |
| --- | --- | --- |
| `make-social-card.js` | `social-app-service-1080.png` (1080×1080) | Instagram **feed** post — the app-building service, with prices |
| `make-story-card.js` | `story-app-service-1080x1920.png` (1080×1920) | Instagram **Story** — same content, with room for a link sticker |
| `make-repair-card.js` | `social-repair-shops-1080.png` (1080×1080) | Feed post aimed only at repair shops |
| `make-feature-graphic.js` | `play-feature-graphic-1024x500.png` | Play Store listing graphic (no alpha — Play rejects it) |

## Editing them

Prices, trades and the contact line are plain strings near the top or inside the
`svg` template — change the text and re-run. Keep both cards in step: the square
and the Story carry the same prices, and they look careless when they disagree.

SVG cannot measure text, so the layouts estimate width at roughly `0.5–0.56em`
per character. If you lengthen a line, check the rendered PNG rather than trusting
it to fit — long lines run off the right edge silently.

The Story card deliberately leaves the top and bottom ~300px empty: Instagram
draws its own profile row and reply box over those bands.
