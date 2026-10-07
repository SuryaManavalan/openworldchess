# The studio: daily videos, made and posted by an agent

Status: built 2026-10-07. Provisional like everything in DESIGN.md.

A scheduled cloud agent makes one short video a day with the kit in `tools/shorts` and posts it to
the game's TikTok account. Nobody reviews it first (the owner's choice), so the checks are in the
tools.

## 1. The pieces

| Piece | Where | What it does |
|---|---|---|
| The routine | claude.ai/code/routines ("OWC daily video") | Daily at 15:00 UTC (8 am Pacific in summer): a fresh cloud session on this repo, posting by about 9 am |
| The playbook | `.claude/skills/owc-shorts/reference/daily.md` | What the agent does alone: pick the brief, film, check, post, record |
| The gate | `tools/shorts/check.mjs` | What a machine can verify (see §3). A video that fails is not posted |
| The studio CLI | `tools/shorts/studio.mjs` | `me`, `log`, `post`, `record`, through the game server |
| The server | `apps/server/src/studio.ts` | Posts as the studio's TikTok account, speaks through the server's ElevenLabs key, keeps the log |
| Setup | `tools/shorts/cloud-setup.sh` | Dependencies, a browser, ffmpeg, the built client |

## 2. Credentials

- The agent holds one secret, the **studio key** (`STUDIO_KEY` on the server; `OWC_STUDIO_KEY` for
  the tools). It's in the routine's instructions, not in the repository (which is public).
- TikTok tokens and the ElevenLabs key never leave the server (`/etc/owc/env`).
- **The studio account** is a player (`STUDIO_PLAYER`: their name or id) who connected TikTok in
  the game. The studio posts through that player's link, with the same code that posts a player's
  battle clip.
- **Caps** (a leaked key can do no more): 3 posts and 8,000 voice characters in any 24 hours.
  To revoke: change `STUDIO_KEY` on the server and in the routine.

## 3. The gate (`check.mjs`)

- **The file:** 1080×1920, 30 fps, H.264 + AAC, 8–60 s, under 50 MB. The sound runs as long as the
  picture, with no silence over 1.5 s. Frame 1 isn't black.
- **The timeline:**
  - a big title at 0 s;
  - cards of 7 words or fewer, on screen long enough to read;
  - text inside TikTok's safe zone;
  - the name, openworldchess.com and "free" on screen;
  - "Sped up" and "Staged battle" labels wherever the timeline's `claims` say the footage needs them.

The gate can't judge taste or truth. For those the playbook has the agent read its own frames,
keep every claim to `reference/truth.md`, and skip the day when unsure.

## 4. The log

`GET /studio/log` (in `studio.json` beside the world): one entry a day with the hook, pillar, kind,
caption, TikTok's publish id and status, the agent's notes, and the timeline and shots (so a video
can be made again). The agent never pushes to the repository: a push to main deploys the game.

Every fifth video is a community video (Discord and GitHub); the rest follow `calendar.md`, then
remix its pillars.

## 5. Operating it

- **Pause:** disable the routine at claude.ai/code/routines.
- **See what happened:** `OWC_STUDIO_KEY=… node tools/shorts/studio.mjs log`, or the routine's run
  history.
- **Drafts instead of public:** `studio.mjs post … --draft` sends to the account's TikTok drafts
  (change the playbook's post command).
