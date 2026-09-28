# Shorts toolkit

Scripts that turn a small JSON file into a finished vertical video. They're used by
the `owc-shorts` skill (`.claude/skills/owc-shorts/`). An agent's job per video
is to **write the JSON**, not to hand-build a video.

| Script | Does | Input |
|---|---|---|
| `capture.mjs` | Films the real world at exactly 30 fps along a camera path (zoom, pan, rotate), with no interface (`?cinema`) | `shots/*.json` |
| `render.mjs` | Composites footage + animated overlay (text, art, flashes, end card) + our own score + voice into the final MP4, plus a review contact sheet | `timelines/*.json` |
| `scene.js` / `scene.html` | The overlay renderer and the score synth (layer types are documented at the top of `scene.js`) | used by `render.mjs` |
| `voice.mjs` | ElevenLabs voice lines, **cached** by voice + text + settings | used by `render.mjs`, or `node voice.mjs chronicler "line"` |

Outputs go to `out/` (git-ignored). The voice cache is `out/voice-cache/`.

## Making a video

```bash
node tools/shorts/capture.mjs tools/shorts/shots/day01-world.json   # footage (skip for no-gameplay videos)
node tools/shorts/render.mjs  tools/shorts/timelines/day01.json     # the video + out/day01/day01-sheet.jpg
```

Then review the MP4 and the contact sheet against the skill's checklist.

## Finding a place to film

Towns near the origin (where the first empires settled), from the live save:

```bash
ssh -i ~/.ssh/owc_lightsail ubuntu@98.88.175.192 'sudo python3 - <<EOF
import json,collections
d=json.load(open("/var/lib/owc/world.json")); pl={p["id"]:p for p in d["players"]}
by=collections.defaultdict(list)
for b in d["buildings"]:
    o=b.get("owner")
    if o and not pl.get(o,{}).get("wild") and abs(b["x"])<400 and abs(b["y"])<400: by[pl[o]["name"]].append((b["x"],b["y"]))
for n,bs in sorted(by.items(), key=lambda kv:-len(kv[1])): print(n, len(bs), sum(x for x,_ in bs)//len(bs), sum(y for _,y in bs)//len(bs))
EOF'
```

Filming opens a visible Chrome window for a couple of minutes (it renders about 10×
faster than headless). It watches with `?watch`, so it creates no empire.

## What it costs

| Step | Cost |
|---|---|
| Footage, overlays, music, sound effects, assembly | **Free**: runs locally (Playwright + ffmpeg + our synth) |
| Voice | ElevenLabs characters: about 150–250 per video; cached lines are free forever |
| Agent time | Mostly writing one timeline JSON (a few hundred lines of context), not building |

A no-voice video costs nothing but compute. Reused lines ("Open World Chess. Play
free, in your browser.") are paid for once.

## Improving the kit (please do)

When a video needs something the kit can't do, **add it to the kit** so the next
video gets it for free:

1. Add a layer type to `scene.js` (document it in the header), or an option to
   `capture.mjs` / `render.mjs`. Keep old timelines working.
2. Use it in the timeline you're making.
3. Add a line to the changelog below, and mention it in the skill's
   `reference/production.md` if agents should know about it.

Good next additions: a `split` layout (world on top, board below), a
`kinetic` caption layer (word-by-word from the voice timing), piece and creature
art layers from `art/`, a battle-replay layer (from `clip.ts`), transitions
(whip, zoom punch), and a `post.mjs` that uploads to TikTok through the
server once `studio-post` exists.

## Staged scenes (battles, sieges, anything with a plot)

For moments you can't wait for on the live server, stage them on a **local** server:

```bash
node tools/shorts/scenario.ts tools/shorts/scenarios/day02-siege.json   # world + server; writes out/day02/scenario.env.json
node tools/shorts/capture.mjs tools/shorts/shots/day02-siege.json       # "scenario": that env; "before"/"events": acts
```

- `scenario.ts`: made-up empires at an open spot, with pieces, buildings and reserves; the
  Emperors are parked far away; staged players are old, unshielded accounts, so battles
  resolve exactly as for real players. `turnMs` slows the world to match filming speed.
- Acts (`tools/shorts/acts/`): players signed in with the scenario's tokens. `battle.mjs`:
  `attack`, `playToMateIn1` (our engine plays the real game until the next move mates),
  `mate`. Shots run acts in `before` (not filmed) and `events` (at a time in the shot);
  an `eval` event runs in the camera's page (`B` is the staged battle's id).
- Filming with a player's tab open is slower (~2 s a frame). Stop the server afterwards
  (its pid is in the env file).

## Changelog

- 2026-09-28: staged scenes: `scenario.ts`, acts (`acts/battle.mjs`), and `scenario` /
  `before` / `events` in shots. First used for Day 2 (a siege, filmed live).

- 2026-09-27: capture films in watch mode (no guest empire, no rate limit) in a
  visible window (~175 ms a frame). The end card's URL is a big pill. Text centers
  on the safe area (x 495), not the screen.

- 2026-09-27: first version. capture (zoom/pan/rotate), render (footage +
  overlay + score + voice + ducking + loudness), layers: text (auto-fit to the safe
  zone), label, vignette, flash, sweep, endcard, image, board; score in D Dorian at
  100 BPM with hits, riser and gong.
