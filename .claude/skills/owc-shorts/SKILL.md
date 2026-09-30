---
name: owc-shorts
description: Make vertical short-form ads (TikTok, YouTube Shorts, Reels) for Open World Chess — hook-first 15–35s videos with live gameplay, kinetic type, big titles and art, plus pure-motion "mantra" pieces with no gameplay. Use when asked to make, script, plan, edit or post a marketing video, short, TikTok, reel, ad or trailer for the game, or to work through the content calendar.
---

# Open World Chess shorts

You make one vertical video at a time for a viewer who is **scrolling fast** and
will leave in under two seconds unless something grabs them. Every choice below
serves that one fact.

Read these before your first video, and keep them open:

| File | What it's for |
|---|---|
| `reference/truth.md` | What the game really does. **Every claim in an ad must be in here.** |
| `reference/audience.md` | Who we're talking to, how they think, and their lingo (chess, Twitch, RTS, history). |
| `reference/copy.md` | Hook formulas, title bank, mantras, CTAs, words to avoid. |
| `reference/humor.md` | The subtle insider layer: current Twitch and chess-community references, what's dead, and the rules (dated: re-check freshness before posting). |
| `reference/production.md` | Specs, safe zones, the scene kit, capturing gameplay, voice, music, labels, posting. |
| `calendar.md` | The 30-day plan: what each day's video is. |
| `reference/research.md` | Why these rules (sources). |

## The five laws

1. **The first second is the ad.** Open on motion *and* a big line of text at
   frame 1. Never open on a logo, a menu, a slow pan or a fade from black.
2. **One idea per video.** One feature, one feeling, one sentence you could
   say out loud. If you need "and", make two videos.
3. **Show the real game.** Only claim what `reference/truth.md` says. We can
   stylize, speed up and dramatize, never invent. (Players who feel lied to
   leave, and "ad matches the game" is the #2 reason people keep playing.)
4. **Readable without sound.** Most people watch muted at first. Text carries
   the story; voice and music make it better, not possible.
5. **Built to loop.** The last frame should flow into the first (same shot,
   same line, or a question the opening answers), so replays happen by accident.

## Shape of a video (default 18–30s)

| Time | Beat | Rules |
|---|---|---|
| 0.0–1.5s | **Hook** | Motion + 3–7 word title, huge. A question, a claim, a pattern break. |
| 1.5–4s | **Payoff promise** | Show the thing the hook is about, fast. |
| 4–20s | **Proof** | Gameplay or motion that delivers it. New visual every 1–2s (cut, zoom, text change, move). |
| 20–27s | **Twist / peak** | The best moment: mate, the dragon, the crown taken, the reveal. |
| last 2–3s | **Name + CTA** | "Open World Chess" + one CTA line. Then cut clean so it loops. |

Mantra pieces (no gameplay) can be 8–15s and use a slower, hypnotic rhythm, but
the rule of frame 1 still holds.

## The toolkit (use it, improve it)

Videos are made with the scripts in `tools/shorts/` (read its `README.md`). Your
job per video is to write a **shot** JSON (the footage to film) and a
**timeline** JSON (text, art, voice, music), then run two commands. Don't
hand-build a video in a one-off script: if the kit can't do something, **add it
to the kit** (a layer type, an option), log it in the kit's changelog, and use it.
Every improvement makes the next video cheaper.

Cost: everything runs locally for free except voice lines (ElevenLabs), which
are cached, so a reused line is never paid for twice. Keep scripts tight.

## Workflow for one video

1. **Pick the brief** from `calendar.md` (or the one you were given). Write it as:
   *feature · feeling · hook line · format · length*.
2. **Fact-check it** against `reference/truth.md`. If it isn't there, check the
   code or ask; don't guess.
3. **Write three hooks** using `reference/copy.md`, pick the one a stranger
   would stop for. Write the on-screen text as a beat list with timestamps. Keep
   each card to 3–7 words.
4. **Script the voice** (optional, see `production.md`): spoken lines match or
   echo the text, never contradict it. 2.5 words per second, max.
5. **Get the footage**: write `tools/shorts/shots/dayNN-*.json` and run
   `capture.mjs`; or for battles, a replay clip (`production.md`); or none, for
   no-gameplay pieces (use the `board`, `image` and text layers on a background).
6. **Assemble**: write `tools/shorts/timelines/dayNN.json` and run `render.mjs`.
   It auto-fits text to the safe zone and writes a contact sheet for review.
7. **Review** with the checklist below. Watch it muted, then with sound, then on
   a phone-sized window. Fix, don't rationalize.
8. **Export** MP4 (H.264, AAC, 30 fps), and write the post: caption, hashtags,
   and the required labels (`production.md` → Labels).
9. **Log it** in `calendar.md`: date, file, hook used, and later the numbers
   (views, 2s hold, average watch %, shares). Winners get remixed, losers get a
   new hook, not a new idea.

## Review checklist (all must pass)

- [ ] Frame 1 has motion and a readable title. No logo, no black.
- [ ] Muted, the story still makes sense.
- [ ] No text card over 7 words; nothing on screen shorter than it takes to read (≈0.3s per word, min 1s).
- [ ] All text inside the safe zone (no overlap with TikTok's buttons or caption).
- [ ] Every claim is in `truth.md`. Sped-up footage is labeled ("4× speed").
- [ ] A new visual at least every 2 seconds (except mantra pieces, which move continuously).
- [ ] The game's name and **openworldchess.com** appear on screen (at least on the end card), the CTA says it's **free in the browser**, and the caption points to the link in bio.
- [ ] It loops: the ending leads back into the opening.
- [ ] At most one insider reference (`reference/humor.md`), it reads straight without the joke, it isn't explained, and its freshness was checked this week.
- [ ] Music is from TikTok's Commercial Music Library or our own/royalty-free; nothing else.
- [ ] Post flags set: "Your brand" (promotional) on; AI-generated on if anything realistic is synthetic.

## Voice of the brand

Stoic, confident, a little mythic, with a gamer's wink. Think "chronicle of an
empire" read by someone who also has chat open. Short sentences. Present tense.
We are proud of chess. We never sneer at chess players or at gamers; the joke is
always *with* them. Cute is off-brand (see `docs/specs/art.md`: stoic pieces,
the rook is a war elephant).

## When you're unsure

Make the smaller, clearer video. A single perfect moment with one great line
beats a montage of everything.
