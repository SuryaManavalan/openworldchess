# Art Spec

Covers the visual direction and the asset pipeline. The code lives in [`art/`](../../art/README.md). The latest gallery is published as an artifact.

## 1. Direction (Decided)

- **2D**, close enough to chess.com's pieces that chess players feel at home: thick dark outlines, flat fills, one soft shade band.
- Pieces are **beings in a world** but still clearly chess pieces, keeping the Staunton silhouettes.
- **Stoic, not cute:** no smiles, no shiny round eyes, nothing plush. Eyes are small solid ovals under straight brows that dip slightly toward the nose.
- The **rook is a war elephant** carrying the rook tower on its back.
- **Terrain, resources and buildings** use the same style and are recognizable at a glance.

## 2. Style rules (from `art/lib/style.mjs`)

| Rule | Value |
|---|---|
| Canvas | 100×100 viewBox per square |
| Outline | `#2b2622`, 3.2 units, round joins |
| Shading | a flat fill plus one right-side shade band (a curved clip) |
| Light pieces | body `#f8f4ec`, shade `#d9d0c2` |
| Dark pieces | body `#57514c`, shade `#3f3a36` |
| Player color | one tint on: collar (every piece), knight mane, elephant blanket, building flags and banners |
| Ground shadow | a black ellipse at 18% opacity |
| Terrain | always a light/dark checker per terrain type |
| Classic board | `#eeeed2` / `#769656`, used for city plazas and battle arenas |

**Which body, light or dark?** In the world, every player's pieces are **light-bodied, with their team color** as the identity. In a **battle**, the attacker's set turns light and the defender's dark, so the board reads like normal chess. The team colors stay on the collars. *(Proposed; round 1–2 art showed both options.)*

## 3. Asset list

| Group | Assets | Status |
|---|---|---|
| Pieces | king, queen, elephant, bishop, knight, pawn, Emperor | Round 2 (stoic) done |
| Buildings | palace, house, stable, temple, barracks | Round 1 done; the palace should grow to 3×3 ([economy.md](economy.md) §2) |
| Buildings, other | construction scaffold, ruins | To do |
| Resources | tree, pine, rock, gold ore, wheat; depleted variants (stump, rubble, harvested field) | Depleted variants to do |
| Terrain | grass, sand, water, road, plaza | Done. Forest floor and mountain to do; 3–4 variants per terrain |
| World UI | arena dome, cooldown shield, pawn-facing chevron, selection ring, command radius ring, alert ping | To do |
| Portraits | a larger bust for each piece type, for the HUD | Later |

## 4. Pipeline

1. **Source:** each asset is a JavaScript function that returns SVG markup, taking options (side, team, variant). Shared helpers keep the style consistent.
2. **Layers for tinting ([TECH.md](../TECH.md) T13):** each asset renders twice:
   - **base:** everything, with team areas drawn in neutral grey;
   - **mask:** only the team-colored shapes, in white.

   At runtime, Pixi draws base plus mask tinted with the player's color. Implementation: `part()` gets a `team: true` flag, and the build renders team parts to their own layer.
3. **Raster:** resvg renders each layer at 64px and 128px.
4. **Atlas:** the frames are packed into `atlas@1x.png` / `atlas@2x.png` with a Pixi JSON frame map, and the result is copied to `apps/client/public/assets`.
5. **Review:** contact sheets in `art/out/png` and the gallery page `art/out/gallery.html`, published for feedback after every round.

## 5. Animation approach

Life, idle routines, nature and feedback are specified in [visuals.md](visuals.md). This section covers only how animation is built.


- **No frame-by-frame art.** Motion comes from transforms on the static sprites (position, scale, rotation, flips), driven by gait events ([movement.md](movement.md) §8). That keeps the art cheap and consistent, much like chess.com's pieces.
- Small extra parts where needed: the knight's shadow scaling during its hop, dust puffs (a small particle sprite), felling trees and quarrying rock during construction (the node sprite shakes and shrinks), and a work-area overlay when placing buildings.
