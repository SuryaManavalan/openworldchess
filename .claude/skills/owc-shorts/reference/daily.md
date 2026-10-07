# The daily run (unattended)

You are the studio's daily agent. Once a day you make **one** video for Open World Chess and post
it to TikTok, with nobody watching. Read `SKILL.md` and the references first; everything there
applies. This page is what's different when you work alone on a fresh machine.

The one rule above the others: **a video that fails a check is not posted.** A skipped day costs
nothing. A wrong claim, a broken render or a silent ending costs trust. When in doubt, don't post:
record the day as skipped with the reason.

## 0. Setup (about 5 minutes)

```bash
bash tools/shorts/cloud-setup.sh
export PATH="$HOME/.local/bin:$PATH"
export OWC_STUDIO_KEY=…        # given in your instructions; never print it, never write it to a file in the repo
node tools/shorts/studio.mjs me     # who we post as; "connected": true, and "privacy" lists PUBLIC_TO_EVERYONE
node tools/shorts/studio.mjs log    # every video so far
```

- The server holds the TikTok and voice credentials. You only hold the studio key.
- Voice lines go through the server by themselves (`voice.mjs` sees `OWC_STUDIO_KEY`). The server
  allows about 8,000 characters a day: write the script once, then generate.
- If `me` is not connected or `blocked`, stop: record a skipped day with what TikTok said.
- If `postsToday` in the log is 1 or more, a video already went out in the last 24 hours: stop.

## 1. What to make today

1. Look at the log's last entries (`day`, `kind`).
2. **Every fifth video is a community video** (`kind: "community"`): if the last four entries are
   all `game`, today is a community video. Otherwise it's a game video.
3. **Game video:** the next unposted day in `calendar.md` (the log's highest whole day number + 1).
   Past day 30, write your own brief the way the calendar's "After day 30" section says: remix the
   pillars, new hook, never the same hook twice (check the log). Game features change: read
   `docs/STATUS.md` and recent commits (`git log --since="10 days ago" --oneline`) for what's new,
   and make an update video when something big shipped that no video has covered.
4. **Community video** (day id: the last game day + "a", e.g. `12a`): an invitation to the Discord
   (`discord.gg/B6kPjrakW`) and the GitHub (`github.com/SuryaManavalan/openworldchess`). The game is
   open source. Never the same video twice. Good angles:
   - "This week in Open World Chess": two or three things that really shipped (from `git log`), shown
     in the game, then "built in the open: come build it with us".
   - The Herald's City of the Day (`/api/showcase` lists the best cities): a tour of today's, "posted
     daily in the Discord".
   - A plain invitation like Day 6a (`timelines/day06a.json`) over fresh footage.
   Tone: sincere, no memes. End card: the Discord link as the pill (`"url": "discord.gg/B6kPjrakW"`),
   `"cta": "openworldchess.com · free in your browser"`, and the GitHub link in small text.

## 2. Footage on a fresh machine

There is no `out/` folder: earlier days' footage is gone. Film what you need.

- **The live world** (real players' cities; no setup): `capture.mjs` with no `scenario` films
  `https://openworldchess.com` in watch mode. `curl -s https://openworldchess.com/api/showcase` lists
  the finest cities with their coordinates (`at`); use `"center": [x, y]`. Use `"time": "noon"` and
  `"nolabels": true` unless names matter. Never show a player's name in a way that mocks them.
- **A staged scene** (battles, sieges, anything with a plot): `scenario.ts` + acts, exactly as the
  kit's README says. Staged battles carry a "Staged battle" label; sped-up footage carries "Sped up".
- **No gameplay** (mantra pieces): the `board`, `image` and text layers; piece art from
  `node art/piece-png.mjs` (run inside `art/`).
- Filming is headless here, about 1–2 s a frame. Budget: **at most 25 s of filmed footage a day**
  (several short shots are fine). Keep videos 12–26 s.
- Look at what you filmed before you build on it: extract frames with ffmpeg and read them. If a
  shot is empty, dark or not what the script says, film again or change the script.

## 3. Make it

Write the shot(s) and the timeline as usual (`shots/dayNN-*.json`, `timelines/dayNN.json`). Extra
rules for running alone:

- The opening title is a text layer with `"t0": 0` and `"anim": "slam"` (it is on frame 1).
- Say what the footage is: `"claims": { "spedUp": true|false, "staged": true|false }` in the timeline.
- Every factual line must be in `reference/truth.md`. If you want to say something that isn't
  there, check the code; if you can't confirm it, don't say it.
- At most one insider line (`reference/humor.md`), and only from its "safe" list: you can't check
  freshness from here.
- No real person's name in the script or captions. No other game's or company's name.
- Captions: one or two short sentences, "Free in your browser, link in bio.", 4–5 hashtags
  (always `#chess` and `#openworldchess`).

## 4. Check it (all three, in order)

1. `node tools/shorts/check.mjs tools/shorts/timelines/dayNN.json` must print `ok`. Fix what it
   says and render again. Never edit the checker to pass.
2. **Look at it.** The render writes a contact sheet (`out/dayNN/dayNN-sheet.jpg`): read it. Also
   read frame 1 and one frame per card (`ffmpeg -ss T -i … -frames:v 1`). Every card readable, no
   text over the key action, nothing clipped, the end card right, the footage showing what the
   words say.
3. **The sound.** You can't listen, so measure: `ffmpeg -i out/dayNN/dayNN.mp4 -af volumedetect -f null -`
   should give a mean around −14 to −20 dB, and the checker's silence test must pass.

If you've rendered three times and it still isn't right, stop and record a skipped day.

## 5. Post it, and write it down

```bash
node tools/shorts/studio.mjs post out/dayNN/dayNN.mp4 --caption "…"
```

It posts publicly with the "Your brand" label, waits for TikTok's verdict, and prints
`{ publishId, status }`. `PUBLISH_COMPLETE` is success. On a refusal or `FAILED`, don't retry more
than once.

Then record the day (always, posted or skipped), in a JSON file outside the repo:

```json
{ "day": "12", "kind": "game", "pillar": "S", "hook": "…", "caption": "…", "publishId": "…",
  "status": "PUBLISH_COMPLETE", "notes": "what you made, what you'd do differently, or why it was skipped",
  "timeline": { …the timeline JSON… }, "shots": [ …the shot JSONs… ] }
```

```bash
node tools/shorts/studio.mjs record /tmp/day12.json
```

A skipped day is recorded with `"status": "skipped"` and the same day id: tomorrow's run makes
that day again.

## 6. What you never do

- Never push to the repository, open pull requests or change the game. The log on the server is the
  only thing you write.
- Never post more than one video a day, and never post a video that didn't pass section 4.
- Never print, log, commit or include in a caption the studio key or any other credential.
- Never film or post anything from outside the game.
