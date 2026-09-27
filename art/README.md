# Art

All game art is SVG generated from code, so the whole set shares one style and can be recolored per player.

- `lib/style.mjs`: shared style tokens (outline, piece palettes, player colors, materials) and drawing helpers. Every asset is drawn in a 100×100 box.
- `assets/pieces.mjs`: chess pieces as characters.
- `assets/world.mjs`: buildings, resources, and terrain tiles.
- `assets/nature.mjs`: biome variants of the resource nodes: 17 trees, 9 rocks, 7 ores, 8 crops. Preview with `node art/preview-nature.mjs`.
- `assets/creatures.mjs` with `creature-heads-a.mjs` and `creature-heads-b.mjs`: the wilds' creature pieces. Each chess role keeps its cue, and the creature shows in the head, palette and mount (docs/specs/wilds.md §6). Preview with `node art/preview-creatures.mjs [faction ...]`.
- `assets/camps.mjs`: 20 camp structures, tinted per faction. Preview with `node art/preview-camps.mjs`.
- `build.mjs`: builds everything into `out/`: single SVGs, PNG contact sheets (`out/png`), and a gallery page (`out/gallery.html`).

```
npm install
npm run build
```
