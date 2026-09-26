# Art

All game art is SVG generated from code, so the whole set shares one style and can be recolored per player.

- `lib/style.mjs`: shared style tokens (outline, piece palettes, player colors, materials) and drawing helpers. Every asset is drawn in a 100×100 box.
- `assets/pieces.mjs`: chess pieces as characters.
- `assets/world.mjs`: buildings, resources, and terrain tiles.
- `build.mjs`: builds everything into `out/`: single SVGs, PNG contact sheets (`out/png`), and a gallery page (`out/gallery.html`).

```
npm install
npm run build
```
