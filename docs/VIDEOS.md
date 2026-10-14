# How we make the promotional videos

Last checked against the repository on 2026-10-11.

Every Open World Chess short (TikTok, YouTube Shorts, Reels) is made from code in this repository.
There is no video editor and no stock footage. A video is described in a few small JSON files; two
scripts film the real game in a browser and assemble the result; a third checks it; a fourth posts
it. A person can run them by hand, and a scheduled cloud agent runs them once a day.

This document describes the whole process and points to every script. Where a file's own header
documents its options, this document names the file instead of repeating it.

## Contents

1. [The pipeline at a glance](#1-the-pipeline-at-a-glance)
2. [Programs and services](#2-programs-and-services)
3. [Where everything lives](#3-where-everything-lives)
4. [The creative rules](#4-the-creative-rules)
5. [Making one video by hand](#5-making-one-video-by-hand)
6. [Getting footage](#6-getting-footage)
7. [Assembling: the timeline](#7-assembling-the-timeline)
8. [Presets](#8-presets)
9. [Checking a video](#9-checking-a-video)
10. [Posting](#10-posting)
11. [The daily agent](#11-the-daily-agent)
12. [Hooks in the game that exist for filming](#12-hooks-in-the-game-that-exist-for-filming)
13. [Time and cost](#13-time-and-cost)
14. [The videos so far](#14-the-videos-so-far)
15. [Known limits and lessons](#15-known-limits-and-lessons)
16. [Credentials](#16-credentials)

## 1. The pipeline at a glance

```
 brief (calendar.md)
      │
      ▼
 footage ─────────────────────────────┐
  • the live game, filmed in a browser │   capture.mjs   → out/dayNN/*.mp4 (1080×1920, 30 fps, silent)
  • or a staged local world            │   scenario.ts + acts/*.mjs
  • or none (motion and art only)      │
      │                                │
      ▼                                │
 timeline JSON: text cards, art, labels, end card, music settings, voice lines
      │
      ▼
 render.mjs ── voice.mjs (ElevenLabs, cached)
      │        scene.js  (overlay frames + the synthesized score)
      │        ffmpeg    (footage + overlay + music + voice → MP4)
      ▼
 out/dayNN/dayNN.mp4  +  dayNN-sheet.jpg (a contact sheet for review)
      │
      ▼
 check.mjs  (the gate: format, sound, readability, safe zone, required labels)
      │
      ▼
 studio.mjs post  →  the game server  →  TikTok (the account's drafts, for now)
```

## 2. Programs and services

| What | Version or detail | Used for | Where it's called |
|---|---|---|---|
| **Node.js** | 22 (runs `.ts` files directly) | Every script | all of `tools/shorts/` |
| **pnpm** | 9 | Installing dependencies; building the game client | `cloud-setup.sh` |
| **Playwright** + Chromium | 1.62.1 | Driving a real browser: filming the game frame by frame, and drawing the overlay frames | `capture.mjs`, `render.mjs`, `acts/*.mjs` |
| **ffmpeg / ffprobe** | 6.1 | Encoding footage, compositing the overlay, mixing sound, loudness, contact sheets, cutting clips, the checks | `capture.mjs`, `render.mjs`, `check.mjs` |
| **ElevenLabs** text-to-speech | model `eleven_multilingual_v2`, two stock voices | Narration | `voice.mjs` (or the server's `/studio/voice`) |
| **Web Audio** (`OfflineAudioContext` in Chromium) | built in | The music and sound effects: synthesized by our own code, so there is nothing to license | `scene.js` → `renderAudio` |
| **The game itself** | this repo's server and client | The footage. Either the live site or a local server with a staged world | `scenario.ts`, `towns.ts` |
| **chess.js** | 1.4.0 | Checking that every scripted battle move is legal | `acts/battle.mjs` |
| **Stockfish** (our `@owc/engine`) | 19 | Playing staged battles to a real checkmate | `acts/battle.mjs` |
| **resvg** | 2.6 | Rendering piece art to PNG for cards | `art/piece-png.mjs` |
| **Google Fonts** | Cinzel (display), Inter (bold) | Card typography | `scene.html` |
| **TikTok Content Posting API** | upload to drafts (`video.upload`); Direct Post not approved yet | Publishing | `apps/server/src/tiktok.ts`, `studio.ts` |
| **Claude Code** + the `owc-shorts` skill | | The agent that writes the JSON and runs the scripts | `.claude/skills/owc-shorts/` |
| **Claude cloud routine** | Opus, daily at 15:00 UTC | The unattended daily run | routine "OWC daily video" |

Nothing else is involved: no After Effects, Premiere, CapCut, Remotion or stock libraries.

## 3. Where everything lives

**The kit: `tools/shorts/`**

| File | What it does |
|---|---|
| `README.md` | The kit's own manual and changelog. Read it first |
| `capture.mjs` | Films the game at exactly 30 fps along a scripted camera path. Input: a shot JSON. Options are documented in its header |
| `scenario.ts` | Stages a small world on a local server: made-up empires, pieces, buildings, optional river, woods, resource piles. Options in its header |
| `towns.ts` | Builds a showcase world of five hand-designed cities in five terrains (used for Day 5a) |
| `acts/battle.mjs` | Things staged players do in battles: `attack`, `playToMateIn1`, `mate`, `enPassantOpening`, `doubleStep`, `passant`, `queenBlunderSetup`, `hangQueen`, `takeQueen` |
| `acts/army.mjs` | `clear` (elephants clear land), `march` (send pieces as a troop) |
| `acts/town.mjs` | `build` (a staged player builds through the real build flow) |
| `render.mjs` | Assembles the final video from a timeline JSON. Options in its header |
| `scene.js`, `scene.html` | The overlay renderer (every layer type) and the music synthesizer. Layer types are listed at the top of `scene.js` |
| `voice.mjs` | ElevenLabs voice lines, cached by voice + text + settings. Also runs alone: `node tools/shorts/voice.mjs chronicler "A line."` |
| `check.mjs` | The gate before a video is posted |
| `studio.mjs` | Talks to the game server: `me`, `log`, `post`, `record` |
| `cloud-setup.sh` | Prepares a fresh machine (the cloud agent's) |
| `scenarios/`, `shots/`, `timelines/` | The JSON for Days 1 to 9, kept as worked examples |

**Art helpers: `art/`**

| File | What it does |
|---|---|
| `art/piece-png.mjs` | Any piece from any set (standard or a civilization) as a large transparent PNG |
| `art/assets/*.mjs` | The game's art, as code that produces SVG. The same art the game draws |

**The creative brief: `.claude/skills/owc-shorts/`**

| File | What it holds |
|---|---|
| `SKILL.md` | The five laws, the shape of a video, the workflow, the review checklist, the brand voice |
| `calendar.md` | The 30-day plan (one row a day: pillar, format, hook, the video, voice, end line) and the log of what was made |
| `reference/truth.md` | What the game really does. **Every claim in a video must be in here** |
| `reference/copy.md` | Hook formulas, title bank, mantras, end lines, words to avoid |
| `reference/humor.md` | The insider references that are safe to use, and the ones that are dead |
| `reference/audience.md` | Who we're talking to and their vocabulary |
| `reference/production.md` | Specs, safe zone, typography, palette, sound rules, labels |
| `reference/daily.md` | The playbook for the unattended daily run |
| `reference/research.md` | Sources for the rules |

**The server side**

| File | What it does |
|---|---|
| `apps/server/src/studio.ts` | `/studio/*`: post as the studio's TikTok account, voice proxy, the log, the captions page |
| `apps/server/src/tiktok.ts` | The TikTok integration the studio reuses |
| `docs/specs/studio.md` | The design of the daily agent |
| `docs/specs/tiktok.md` | The TikTok integration |

**Output: `out/`** (ignored by git). `out/dayNN/` holds the footage, the final MP4, the contact
sheet and the working files. `out/voice-cache/` holds every voice line ever generated.

## 4. The creative rules

These are in `SKILL.md`; the short version:

1. **The first second is the ad.** Motion and a big line of text on frame 1.
2. **One idea per video.**
3. **Show the real game.** Only claim what `truth.md` says. Sped-up footage and staged battles are labeled on screen.
4. **Readable without sound.** Text carries the story.
5. **Built to loop.** The ending leads back into the opening.

The default shape is 18 to 30 seconds: hook (0 to 1.5 s), promise, proof, peak, then the name and
call to action. Mantra pieces with no gameplay run 8 to 15 seconds.

Seven content pillars rotate through the calendar: World, Stakes, Memes, Lore, Progress, History
and Zen. Every fifth video is a community video (the Discord and the GitHub).

## 5. Making one video by hand

From the repository root, with `pnpm install` done and ffmpeg installed:

```bash
# 1. Footage. Pick one of the three kinds in section 6.
node tools/shorts/capture.mjs tools/shorts/shots/day01-world.json        # the live world
#   or, for a staged scene:
node tools/shorts/scenario.ts tools/shorts/scenarios/day07-blunder.json  # starts a local server
node tools/shorts/capture.mjs tools/shorts/shots/day07-blunder.json

# 2. Assemble.
node tools/shorts/render.mjs tools/shorts/timelines/day07.json
#    → out/day07/day07.mp4 and out/day07/day07-sheet.jpg

# 3. Check.
node tools/shorts/check.mjs tools/shorts/timelines/day07.json

# 4. Post (needs OWC_STUDIO_KEY; see section 16).
node tools/shorts/studio.mjs post out/day07/day07.mp4 --caption "…"
```

The work of making a video is writing the shot JSON and the timeline JSON. If the kit can't do
something, the rule is to add it to the kit (a layer type, an option, an act) and note it in the
kit's changelog, so the next video gets it for free.

## 6. Getting footage

### 6.1 The live world

`capture.mjs` opens the live game in watch mode (no account, no interface) and films it.

```json
{ "out": "out/day01/world.mp4", "seconds": 18,
  "center": [-222, -10771], "time": "noon", "nolabels": true,
  "path": [ { "t": 0, "zoom": 2.2 }, { "t": 17, "zoom": 0.05, "dx": 0, "dy": 0 } ],
  "ease": "inOut" }
```

- `center`: a world square, or `"busiest"`. `GET https://openworldchess.com/api/showcase` lists the
  finest player cities with their coordinates.
- `path`: camera keys. Zoom is interpolated exponentially, so a zoom-out feels even; `dx`/`dy` pan
  in squares. `rotate` turns the camera over the shot.
- `time`: `noon`, `dusk` or `night` pins the game's day. `nolabels` hides town and king names.

**How filming works.** For every frame, the script sets the camera, waits for the browser to
paint, takes a screenshot and pipes it to ffmpeg (H.264, CRF 18). The output is exactly 30 fps
whatever the machine's speed. The game keeps running in real time while this happens, so footage
plays faster than life: that is why staged scenes slow the world down (`turnMs`) and why moving
footage carries a "Sped up" label.

### 6.2 A staged scene

For anything with a plot (a siege, a blunder, elephants clearing a forest), `scenario.ts` builds a
world and runs it on a local server:

```json
{ "name": "day07", "seed": 1, "near": [300, 300], "turnMs": 3000, "countdownScale": 0.1,
  "players": [
    { "name": "Aurelian", "color": "#3d6fd1", "at": [-9, 0], "facing": 1,
      "pieces": { "K": 1, "Q": 1, "R": 2, "N": 2, "B": 1, "P": 5 } },
    { "name": "Greyholt", "color": "#c8623f", "at": [5, 0], "facing": 3,
      "buildings": ["house", "house", "stable", "house", "temple", "house", "barracks"],
      "pieces": { "K": 1, "Q": 1, "N": 1, "B": 1, "P": 5 } } ] }
```

It finds open ground, places the players, and writes `out/<name>/scenario.env.json` (the server's
address, the spot, each player's token). Options: `needs` (resources nearby), `river`, `woods`,
`hoards`, `reserves`.

A shot then films that world, with **acts**: scripted players signed in on their own browser tabs.

```json
{ "scenario": "out/day07/scenario.env.json", "out": "out/day07/blunder.mp4", "seconds": 7,
  "before": [ { "act": "battle.mjs#attack", "args": { "as": "Aurelian", "target": "Greyholt" } },
              { "act": "battle.mjs#queenBlunderSetup", "args": { "white": "Aurelian", "black": "Greyholt" } },
              { "eval": "window.__owc.ui.getState().set({ battleFocus: B })" } ],
  "events": [ { "t": 1.0, "act": "battle.mjs#hangQueen", "args": { "black": "Greyholt" } },
              { "t": 3.4, "act": "battle.mjs#takeQueen", "args": { "white": "Aurelian" } } ] }
```

- `before` runs off camera; `events` run at a time in the shot.
- An `eval` runs code in the camera's page (`B` is the staged battle's id).
- `as` films as a player with the interface visible, on a phone-sized screen (`viewport`), with
  optional `css` to hide parts of it.
- `stroke` and `tap` events draw on camera through the real input, under a fingertip dot (used for
  the city builder).

**Staged battles are real games.** Moves come from our chess engine or from a scripted line, and
every scripted line is checked with chess.js before it's played on the real server. They are
labeled "Staged battle" on screen.

### 6.3 No gameplay

Mantra pieces use only overlay layers: the `board` layer (an endless zoom through chessboards),
`image` layers (piece art from `art/piece-png.mjs`) and text, over a `background` color.

### 6.4 Reusing footage

Clips are cut and joined with ffmpeg into a `base.mp4`. Cut each segment to its own file, then
concatenate with a re-encode:

```bash
ffmpeg -ss 0 -t 4.2 -i out/day05a/a.mp4 -an -c:v libx264 -crf 16 -r 30 -pix_fmt yuv420p s1.mp4
printf "file s1.mp4\nfile s2.mp4\n" > list.txt
ffmpeg -f concat -safe 0 -i list.txt -c:v libx264 -crf 16 -r 30 -pix_fmt yuv420p base.mp4
```

Use `-nostdin` when cutting inside a shell loop. Slow a stretch with `setpts=PTS/0.5`.

## 7. Assembling: the timeline

A timeline is one JSON file: the footage underneath, the layers on top, the sound.

```json
{ "out": "out/day07/day07.mp4", "seconds": 23.8,
  "base": { "video": "out/day07/base.mp4" },
  "claims": { "spedUp": false, "staged": true },
  "layers": [
    { "type": "vignette", "t0": 0, "t1": 23.8, "strength": 0.45 },
    { "type": "label", "t0": 0, "t1": 12.4, "text": "Staged battle", "y": 1400 },
    { "type": "text", "t0": 0, "t1": 1.7, "lines": ["HE HUNG", "HIS QUEEN."], "y": 1010, "size": 150, "anim": "slam" },
    { "type": "text", "cue": "in a war", "lines": ["IN A WAR."], "color": "#e3b23c", "y": 1080, "size": 170, "anim": "slam" },
    { "type": "flash", "t0": 10.2, "dur": 0.25 },
    { "type": "endcard", "cue": "open world chess", "sub": "Would you have seen it?",
      "url": "openworldchess.com", "cta": "Free in your browser", "y": 560 } ],
  "audio": { "bpm": 100, "musicGain": 0.5, "sfxGain": 0.75 },
  "voice": [ { "at": 0.15, "voice": "caster", "timed": true, "text": "He hung his queen. In a war. …" } ] }
```

### 7.1 Layers

| Layer | What it draws | Main options |
|---|---|---|
| `text` | A card of one or more lines | `lines`, `colors`, `y`, `size`, `font` (`display` or `bold`), `anim` (`slam`, `pop`, `rise`, `fade`, `type`), `plate`, `glow`, `spacing`, `silent` |
| `label` | A small tag ("Sped up", "Staged battle") | `text`, `y` |
| `endcard` | The name, a line, the URL as a pill, a call to action | `sub`, `url`, `cta`, `dim`, `y` |
| `image` | Art | `src`, `x`, `y`, `w`, `anim` (`pop`, `float`, `fade`) |
| `board` | A procedural endless chessboard | `light`, `dark`, `period`, `speed`, `spin`, `dim` |
| `vignette` | Darkens the edges so text reads | `strength` |
| `flash`, `sweep` | A hit of light at a peak | `color`, `dur` |

Text is fitted to the safe width automatically. A `slam` title at 0 s is fully on screen on frame 1.

### 7.2 Narration and cues

- A voice line is `{ "at", "voice", "text" }`. With `"timed": true`, ElevenLabs also returns when
  each character is spoken, and the timing is cached beside the MP3.
- A layer with `"cue": "a phrase from the narration"` instead of `t0`/`t1` appears as those words
  are spoken and holds until the next cued card. Cards that share a cue appear and end together.
- The rule is one or two flowing passages at about 2.5 words a second, with short cards riding
  the speech. A string of short lines with pauses sounds like an answering machine. The exception
  is a mantra, where single words are spoken on the beat.
- `"voiceContext": true` sends each line's neighbours as context, for a steadier delivery of
  separate lines.

### 7.3 Music and sound effects

`scene.js` synthesizes the score for each video, in the game's key (D Dorian), at the timeline's
`bpm`:

- a drone pad that swells over the piece;
- a pulse on the beat and a plucked figure that climbs;
- a hit on every `slam` and `pop` card and every `flash`;
- a riser before the end card and a gong on it.

Because the score is generated, there are no music rights to clear.

### 7.4 What `render.mjs` does

1. Generates or loads the voice lines, and resolves the cues to times.
2. Opens `scene.html` in Chromium, renders the score to a WAV, then draws the overlay for every
   frame on a transparent 1080×1920 canvas and screenshots it.
3. Pipes those frames to ffmpeg, which lays them over the footage, mixes the score and the voice
   (the music ducks under speech), normalizes loudness to −14 LUFS, and writes H.264 (CRF 20) with
   AAC audio at 48 kHz.
4. Writes a contact sheet: one frame every two seconds.

## 8. Presets

**Format**

| Setting | Value |
|---|---|
| Frame | 1080×1920, 9:16, 30 fps |
| File | MP4, H.264 video, AAC audio, under 50 MB |
| Length | 18 to 30 s; mantra loops 8 to 15 s |
| Safe zone for text | x 60 to 930, y 150 to 1440 |
| Biggest title | y 250 to 700; gameplay in y 500 to 1400 |

**Type**

| Use | Preset |
|---|---|
| Titles | Cinzel Black (`"font": "display"`, the default), 90 to 170 px, 1 or 2 lines |
| Punchy or support lines | Inter Black (`"font": "bold"`), 48 to 110 px |
| Contrast | A dark stroke on all text; `"plate": true` over busy footage |
| Reading time | At least 1 s a card, about 0.3 s a word; at most 7 words a card |

**Colors**

| Use | Color |
|---|---|
| Ground | `#23211f` |
| Ink | `#ece6da` |
| Gold (titles, crowns, peaks) | `#e3b23c` |
| Accent (the URL pill) | `#95b957` |
| Board light / dark | `#eeeed2` / `#769656` |
| Arena walnut / cream | `#b58863` / `#efe0c0` |
| Staged players | Aurelian `#3d6fd1`, Greyholt `#c8623f` |

**Voices** (stock ElevenLabs voices; never a clone of a real person)

| Name | Voice | Settings | Used for |
|---|---|---|---|
| Chronicler | George (`JBFqnCBsd6RMkjVDRZzb`) | stability 0.55, similarity 0.8, style 0.35 | World, lore, progress, community |
| Caster | Charlie (`IKne3meq5aSn9XLyUdCD`) | stability 0.62, similarity 0.8, style 0.25 | Battles, memes |

**Sound:** 90 to 100 BPM; `musicGain` 0.45 to 0.6; `sfxGain` 0.5 to 0.9.

**The end card:** "OPEN WORLD CHESS", one line, `openworldchess.com` as the pill, "Free in your
browser". Community videos put the Discord link in the pill instead.

**Labels:** "Sped up" on moving footage; "Staged battle" whenever a staged battle is on screen.

## 9. Checking a video

`node tools/shorts/check.mjs <timeline.json>` exits with a failure unless all of these hold:

- **The file:** 1080×1920, 30 fps, H.264 and AAC, 8 to 60 s, under 50 MB.
- **The sound:** it runs as long as the picture, with no silence longer than 1.5 s.
- **Frame 1:** not black, and the timeline has a big title at 0 s.
- **Cards:** 7 words or fewer, and on screen long enough to read.
- **Safe zone:** all text inside it.
- **On screen somewhere:** the name, `openworldchess.com`, and "free".
- **Labels:** present wherever the timeline's `claims` say the footage is sped up or staged.

It can't judge taste or truth. For those, a person (or the agent) reads the contact sheet and
single frames:

```bash
ffmpeg -ss 12.5 -i out/day07/day07.mp4 -frames:v 1 frame.jpg
ffmpeg -i out/day07/day07.mp4 -vn -af volumedetect -f null -      # mean around -14 to -20 dB
```

Nobody in this pipeline can listen to a video except the owner. Sound problems that the level
checks miss (a mispronounced word, an odd reading) are only caught by ear.

## 10. Posting

```bash
node tools/shorts/studio.mjs me                 # who we post as, and what TikTok allows
node tools/shorts/studio.mjs post out/day07/day07.mp4 --caption "…"
node tools/shorts/studio.mjs log                # every video so far
```

- The script uploads the MP4 to the game server, which posts it through TikTok's Content Posting
  API as the studio's account (**Open World Chess**) and waits for TikTok's verdict.
- **Today, videos go to the account's TikTok drafts**, not straight to the profile. TikTok approved
  the app for sign-in and uploading to drafts; Direct Post needs a separate review, and public
  posting needs TikTok's audit after that.
- **A draft arrives without its caption** (TikTok's drafts upload takes only the file). The owner
  copies the caption from the end of the daily run's message, or from the private captions page
  (`/studio/captions`), pastes it in TikTok, turns on the **"Your brand"** disclosure, and posts.
- The same file goes to YouTube Shorts and Instagram Reels by hand.

## 11. The daily agent

A Claude cloud routine ("OWC daily video", Opus) starts every day at 15:00 UTC, on a fresh machine
with a clean checkout of this repository. It follows `reference/daily.md`:

1. **Setup:** `bash tools/shorts/cloud-setup.sh`, which reports one line for each of dependencies,
   browser, ffmpeg, client build and network.
2. **Pick the brief:** the next day in `calendar.md`; every fifth video is a community video.
3. **Film:** the live world or a staged scene. Nothing carries over between days, so footage is
   always fresh.
4. **Make it:** write the shot and timeline JSON in `out/dayNN/`, render.
5. **Check:** `check.mjs`, then read the contact sheet and frames, then measure the sound.
6. **Post and record:** `studio.mjs post`, then `studio.mjs record` (the hook, caption, status,
   notes, and the timeline and shots, so a video can be made again).
7. **Hand over the caption:** a phone notification, and the caption alone in a code block at the end
   of its final message.

A video that fails a check is not posted: the day is recorded as skipped with the reason. The agent
never pushes to the repository (a push that changes the game deploys it).

The server side (`apps/server/src/studio.ts`) holds the TikTok and voice credentials, so the agent
holds a single key, and it enforces daily caps: 3 posts and 8,000 voice characters in 24 hours.

To pause it, disable the routine at claude.ai/code/routines. Design notes: `docs/specs/studio.md`.

## 12. Hooks in the game that exist for filming

| Hook | What it does | Where |
|---|---|---|
| `?watch` | Look at the world with no empire | `apps/client/src/net.ts` |
| `?cinema` | Hide the interface (battles still show) | `apps/client/src/ui/HUD.tsx` |
| `?time=noon\|dusk\|night` | Pin the day | `apps/client/src/game/fx.ts` |
| `?nolabels` | No town names or king tags | `apps/client/src/game/scene.ts` |
| `window.__owc` | `{ mirror, scene, input, ui, commands }`: the page's state, camera, input and commands, for scripts | `apps/client/src/ui/GameView.tsx` |
| `/api/showcase` | The finest player cities and their coordinates | `apps/server/src/herald.ts` |
| Server settings `TURN_MS`, `COUNTDOWN_SCALE`, `WILDS`, `SHIELD_MS` | Slow the world, shorten countdowns, turn off the wilds, for staged scenes | `apps/server/src/main.ts` |

## 13. Time and cost

| Step | On a desktop with a screen | On the cloud machine (no screen) |
|---|---|---|
| Filming | about 0.2 s a frame (a 20 s shot: about 2 minutes) | about 1.7 s a frame (a 20 s shot: about 20 minutes) |
| Rendering | 3 to 6 minutes | about 7 s of work for each second of video |
| A whole daily run | | 45 to 70 minutes |

- **Money:** the only paid step is ElevenLabs, about 150 to 400 characters a video. Lines are
  cached, so a repeated line is free.
- **Everything else** runs on the machine: filming, overlays, music, effects, assembly.

## 14. The videos so far

| Day | Hook | Kind | Notes |
|---|---|---|---|
| 1 | The whole world is a chessboard. | Live world | One continuous zoom-out |
| 2 | What happens after checkmate? | Staged siege | First staged video |
| 3 | Google en passant. | Staged battle | A real en passant |
| 3a | Send them out. | Staged, interface visible | Troops |
| 4 | Every empire begins with one house. | Staged | First flowing narration |
| 4a | One lonely sadge developer | Community | Open-source announcement |
| 5 | The City Builder Update | Staged, drawn on camera | 50 s update showcase |
| 5a | Every city is drawn by hand. | Showcase world (`towns.ts`) | Five cities |
| 6 | Chat, the rook is an elephant. | Staged | Elephants clear a forest; ladder mate |
| 6a | Join the Open World Chess Discord | Community | Plain invitation |
| 7 | He hung his queen. In a war. | Staged battle | A real hung queen |
| 8 | From Settler to High King. | Reused footage | Ten titles on the beat |
| 9 | Calculate. Commit. Conquer. | No gameplay | A 12 s seamless loop |
| 10 | Knights hop. | Daily agent | Its first video (the rehearsal) |
| 10a | The biggest player city | Daily agent, community | |
| 11 | Protect the Emperor. | Daily agent | |
| 12 | Chess was born as a war. | Daily agent | |
| 13 | Promotion is temporary here. | Daily agent | |

Days 1 to 9 were made in working sessions and posted by hand; their JSON is in `tools/shorts/`.
From Day 10 the agent's timelines and shots are in the studio log (`studio.mjs log`; the full
entries are at `GET /studio/log?full=1`).

## 15. Known limits and lessons

- **Nobody but the owner hears the audio.** Day 9's music cut out right after its last spoken word,
  and only a listener caught it. The cause is fixed (the voice track is now padded to the video's
  length) and `check.mjs` now tests for it, but pronunciation still needs an ear.
- **Days 1 to 8 have that flaw.** Their music stops with the last spoken word. They were posted as
  they were and are not to be re-rendered.
- **Filming is slow without a screen.** Keep unattended shots short, and never let an agent end
  its turn while filming is still running.
- **Camera tracking is hand-written.** `capture.mjs` has no built-in "follow these pieces" option.
  The agent's own tracking drifted on Day 10 and it had to cut the video down. A follow option is
  the most useful next addition.
- **The agent's videos aren't kept.** A cloud machine is discarded after its run; the only copy of
  a daily video is the draft on TikTok (its recipe is in the log).
- **A fully opaque overlay frame used to stop ffmpeg silently.** Every overlay frame now keeps one
  transparent corner pixel. `FFV=warning` before a render shows ffmpeg's warnings.
- **Older footage shows things that have changed.** Clips from before October 2026 show the
  chessboard that cities used to get at their centre; it is now the Arena, a building players place.
- **`reference/production.md` still calls the posting route "planned".** This document and
  `docs/specs/studio.md` are current.

## 16. Credentials

No secret is in the repository (it is public). Where each one lives:

| Credential | Where | Who uses it |
|---|---|---|
| ElevenLabs key | `~/.config/owc/elevenlabs.key` on the owner's machine (or `ELEVENLABS_API_KEY`); `/etc/owc/env` on the server | `voice.mjs`; the server's voice proxy |
| TikTok client key and secret, and the studio account's tokens | `/etc/owc/env` and the world save, on the server only | `tiktok.ts` |
| Studio key (`STUDIO_KEY` / `OWC_STUDIO_KEY`) | `/etc/owc/env`; `~/.config/owc/studio.key`; the routine's instructions | `studio.mjs`, the daily agent |
| Captions page key (`STUDIO_VIEW_KEY`) | `/etc/owc/env`; in the owner's bookmark | The owner's phone; read-only |

With `OWC_STUDIO_KEY` set and no ElevenLabs key on the machine, `voice.mjs` speaks through the
server by itself.
