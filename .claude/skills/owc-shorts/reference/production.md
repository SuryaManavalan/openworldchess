# Production

## Specs

- **1080×1920, 9:16, 30 fps**, MP4 (H.264 video, AAC audio), under 50 MB.
- Length: **18–30s** by default. Mantra loops 8–15s. Explainers up to 45s only
  if every second earns it.
- TikTok and YouTube Shorts get the same file. Shorts rewards watching most of the
  video (aim for over 80%), so err shorter.

## Safe zone (1080×1920)

TikTok's buttons and caption cover parts of the frame. Keep **all text and key
action** inside:

- top 150 px: clear (the For You / Following tabs);
- bottom 480 px: clear (caption, sound, username). Nothing important below **y = 1440**;
- right 150 px: clear (like, comment, share buttons);
- left 60 px: clear.

So the text box is about **x 60–930, y 150–1440**. Put the biggest title in the
upper-middle band (**y 250–700**), and gameplay in the middle (**y 500–1400**).

## Typography

- Titles: a heavy display face, **90–160 px**, 1–2 lines, max about 14 characters a
  line. Use **Cinzel Black** or **Cinzel Decorative** for mythic lines, and
  **Inter Black** or **Montserrat Black** for punchy lines. Both are on Google Fonts.
- Support text: 48–64 px, semi-bold.
- Always give text contrast: a 6–10 px dark stroke, or a dark translucent plate
  (rgba 0,0,0,0.6), over busy footage.
- Word-by-word pop-in (kinetic captions) for voiced lines; whole-card slam for titles.
- Reading time: at least 1 s per card, about 0.3 s per word.

## Palette (from the game)

| Use | Color |
|---|---|
| Ground | `#23211f` (warm near-black) |
| Board light / dark | `#eeeed2` / `#769656` |
| Accent (go, win) | `#95b957` |
| Gold (crowns, titles, Victory) | `#e3b23c` |
| Ink | `#ece6da` |
| Danger (loss, blunder) | `#d9534a` |

Faction camps have their own accent colors (`FACTIONS[id].art.accent` in
`packages/shared/src/wilds.ts`).

## Getting footage

### A. Battle replay clips (vertical, ready-made)

The game renders a clean 1080×1920 replay of any finished battle: open a
finished battle → **Share clip** → **Save video to this device**. The code is in
`apps/client/src/game/clip.ts`. It's perfect for "watch this checkmate" beats.

### B. Live world footage (Playwright)

Record the real site with Playwright (see `~/owc-demo/demo.mjs` for a complete,
working example of driving the game):

- **Vertical:** viewport 540×960 with `deviceScaleFactor: 2` gives a real
  phone layout at 1080×1920. Record with `recordVideo: { size: { width: 1080, height: 1920 } }`.
- **Clean:** add `?cinema&watch` to the URL. `?cinema` hides the interface;
  `?watch` watches the world without creating an empire (no guest, no rate
  limit). `tools/shorts/capture.mjs` does both for you.
- **Zoom range that reads on camera** (learned on Day 1): 2.4 is a close-up of
  pieces; about 0.3 shows a whole town with its armies; **below 0.2 the game
  switches to its simplified far view** (towns become blobs). Keep shots at or
  above 0.2, and move across towns at 0.23–0.3 rather than zooming out further.
- **Where to film:** start inside a dense town, not on a lone piece. Find towns
  with the query in `tools/shorts/README.md` (bot empires' names are fine to show).
- **Camera:** `window.__owc.scene.flyTo(x, y, zoom)` glides the camera;
  `window.__owc.mirror` holds the world (pieces, buildings, players, battles).
  Zoom out slowly over an empire for "the world is a chessboard" shots.
- **Moves in battle:** click squares on `.battle .board`. For strong play, drive
  the moves with the engine (`packages/engine`, as `demo.mjs` does).
- **Speed:** you may speed footage up, and you must label it on screen ("4× speed").
- Use a dedicated marketing account; never film other real players' names
  without blurring, unless they're our bots.

### B2. Staged scenes (sieges, blunders, crowns)

For a specific moment (a mate that takes a town, a queen blunder, a crown seized), stage
it on a local server with `tools/shorts/scenario.ts` and film it with acts that play as
the staged players (our engine plays their moves, so the chess is real). See
`tools/shorts/README.md` → Staged scenes. Use made-up empire names, never a real
player's. It's real game behavior, so no "simulated" label is needed; label speed if
you speed it up.

### C. Art and motion (no gameplay)

- Piece, building, creature, relic and wonder art is generated as SVG under
  `art/` (`art/assets/*.mjs`) and in `apps/client/src/game/textures.ts`. Render
  it large for title cards and hypnotic loops.
- Build motion scenes as an HTML canvas page with a `draw(t)` function, then
  capture frame by frame (deterministic, exactly 30 fps). `clip.ts` already does
  this with WebCodecs; copy its `encodeFrames` approach.
- Hypnotic ideas that suit us: an endless zoom through chessboards; pieces
  orbiting a king; a knight tracing L-shapes into a pattern; the board tiling
  outward forever; a pawn walking and becoming a crown; faction sigils cycling;
  titles stacking Settler → High King.

### D. The shorts toolkit (to build next, `tools/shorts/`)

A small kit so every video isn't hand-built:

1. `scene.html`: a 1080×1920 canvas with a timeline of layers (footage, art,
   text cards, transitions) described in JSON.
2. `render.mjs`: captures the timeline frame by frame into MP4 (WebCodecs or
   ffmpeg), mixes voice and music, and burns in labels.
3. Templates: `hook-card`, `kinetic-caption`, `stat-slam` (a big number), `zoom-out`,
   `split` (world on top, board on bottom), `end-card`.

Until it exists, assemble with ffmpeg (`drawtext`, `overlay`, `xfade`,
`setpts` for speed).

## Sound

- **Voice:** ElevenLabs. Pick two stable voices (the Chronicler and the Caster,
  see `copy.md`) and keep them for the whole series; consistency builds recognition.
  Never clone or imitate a real person. Export 44.1 or 48 kHz, normalized to about
  −16 LUFS, ducking music by 8–10 dB under speech.
- **Narration flows (the rule since 2026-09-30).** Write the voice as one or two continuous
  passages of full, flowing sentences, joined by commas and "and"/"then"/"until". Never a
  string of two- or three-word lines with pauses between them: the voice gives lone short
  lines a flat or questioning intonation, and the gaps sound like an answering machine. The
  cards stay short (3–7 words) and ride the speech: give the line `"timed": true` and each
  text layer a `"cue"` (a phrase from the narration) instead of t0/t1 (render.mjs). Aim for
  about 2.5 words a second, ending with the name and CTA inside the same passage.
- **Music:** only (a) tracks from TikTok's **Commercial Music Library** added in the
  app, (b) royalty-free tracks with a license that covers ads, or (c) our own game
  audio (`apps/client/src/audio`). Business accounts can't use the general library.
- **Sound design:** the game's move knocks, captures and chords sell the chess.
  Hit a sound on every cut and every text slam.
- Loud enough to feel, clean enough to hear with no music at all.

## Labels and rules (don't skip)

- **Promotional content:** these are ads for our own game. Turn on the content
  disclosure with **"Your brand"** (TikTok labels it "Promotional content").
- **AI-generated:** TikTok requires the AI label for realistic synthetic
  people, scenes or cloned voices. A generic narration voice isn't a cloned
  voice, but when in doubt, turn the AI label on. Our game footage and art aren't
  AI-generated.
- No misleading footage: nothing the game can't do, sped-up footage labeled.
- No other brand's logo, no real person implied as endorsing us.

## Posting

- Post from the @openworldchess account. The API route is planned
  (`POST /tiktok/studio-post`, see `docs/specs/tiktok.md`). Until it's built, a
  person uploads the files.
- Once a day. Good windows for this audience: 7–10 pm local time, and weekend
  late mornings.
- Pin the best 3 videos to the profile. Reply to the first comments fast.
- Cross-post the same file to YouTube Shorts and Instagram Reels (with no TikTok
  watermark: always upload the original MP4).

## Measuring

Log in `calendar.md` after 48 hours:

| Metric | Good | Rework if |
|---|---|---|
| 2-second hold (hook rate) | 30%+ | under 20%: new hook, same video |
| Average watch % | 50%+ (15–30s) | under 35%: cut the middle |
| Shares / 1k views | 5+ | — |
| Profile visits / site visits | trending up | — |

Winners get remixed (new hook, new text, same idea). Losers get one new hook
before the idea is dropped.
