# Client Spec

Covers the browser client: its screens, rendering, HUD, input and performance targets. The stack is PixiJS for the game view, React for the HUD, Zustand as the shared store, and Vite to build ([TECH.md](../TECH.md) T3–T4).

## 1. Screens and modes

| Mode | What you see |
|---|---|
| **Title** | Play as guest / sign in; pick a name and color. |
| **World (roam)** | The open world, your troops and cities, the HUD, the minimap. |
| **Battle** | The camera zooms into the arena with your side at the bottom; board-focused HUD (clocks, move list, resign/draw). The world stays visible, dimmed, around the dome. |
| **Spectate** | The same as Battle but read-only, with both players' info. |
| **Settlement details** | A bottom sheet on phones, a side panel on desktop: buildings, what each draws from and how much is left, production, garrison, palace toggle. |
| **Away report** | A modal on login: what happened while you were offline. |

Moving between World and Battle is one continuous camera move (zoom and rotate), not a screen load. That keeps the idea that battles happen *in* the world.

## 2. Rendering layers (bottom to top)

1. **Terrain:** a cached texture per chunk (32×32 tiles), redrawn when that chunk's changes arrive.
2. **Ground decals:** city plaza tint, the command radius ring, pawn-facing chevrons, path previews, selection rings.
3. **Y-sorted objects:** resource nodes, buildings, pieces (base sprite plus tinted team mask). Sorted by world row, then rotated with the camera.
4. **Arena domes:** the raised board, the live battle pieces, the dome shader.
5. **Overlays:** cooldown shields, alert pings, troop labels, damage and decay icons.
6. **HUD** (React, DOM).

**Level of detail:**

| Zoom | What's drawn |
|---|---|
| 1 (closest) | Full sprites and idle animation. |
| 2 | Full sprites. |
| 3 | Pieces as simplified icons, troops as clusters. |
| 4 (far) | Troops as banners with a piece count; cities as icons; the terrain texture shrunk down. |

**Camera rotation:** the world container rotates in 90° steps. Each sprite counter-rotates so it stays upright, and y-sorting uses the row on screen after rotation.

## 3. HUD and input

Layout, gestures, and the phone and desktop versions of every screen are specified in **[ux.md](ux.md)**. Both are first-class from day 0. What stays constant across them:

- **HUD contents:**
  - your rating and alerts;
  - the troop bar or troop list (one entry per king);
  - selection details;
  - buildings, with what each draws from and how much is left;
  - the minimap, with an optional elo-band layer.
- **Battle HUD:**
  - clocks and the move list;
  - resign and offer draw;
  - captured pieces;
  - an "AI is playing for you" banner;
  - a reconnect indicator.
- **Input:** gestures and mouse and keyboard all turn into the same command objects ([ux.md](ux.md) §9).

## 5. Audio

Specified in **[audio.md](audio.md)**: music locked to the 100 BPM world turn, pieces as rhythm voices, rewards that cascade, adaptive music. Life, feedback and atmosphere are in **[visuals.md](visuals.md)**.

## 6. Performance targets

- 60 fps on a mid-range laptop with 2,000 visible sprites. **Phones are first-class:** 60 fps on a current iPhone or Pixel, 30 fps on a low-end Android (3 GB RAM). Frame rate drops when idle, to save battery ([ux.md](ux.md) §7).
- Initial load under 3 MB (atlases included).
- Generating terrain for one chunk on the client: under 3ms, done in a Web Worker so panning never stutters.

## 7. Client state (Zustand store)

```
session { player, token, connected }
world   { turn, subscribed chunks, entities by id, chunk overlays }
ui      { selection, camera { x, y, zoom, rotation }, panels, alerts }
battle  { active battle id, fen, clocks, move list, orientation }
```

The Pixi scene reads the store every frame, with no React involved. React subscribes only to the `ui`, `session` and `battle` slices.
