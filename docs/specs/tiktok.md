# TikTok

Players can sign in with TikTok and share replay clips of their battles to
TikTok. Server: `apps/server/src/tiktok.ts`. Client: `apps/client/src/game/clip.ts`
(the clip) and `apps/client/src/ui/ShareTikTok.tsx` (the post form).

## 1. Products and scopes

| Product | Scope | Used for |
|---|---|---|
| Login Kit | `user.info.basic` | Sign in with TikTok; the display name and avatar |
| Content Posting API (Direct Post) | `video.publish` | Post a battle clip straight to the player's profile |
| Content Posting API (Upload) | `video.upload` | Send a clip to the player's TikTok drafts |
| Webhooks | none | `post.publish.*` status, `authorization.removed` |

Share Kit is for mobile apps, so the web game doesn't use it.

## 2. Accounts

Sign in with TikTok works like Google sign-in:
- a TikTok account with an empire continues it;
- otherwise it saves the guest empire that started the flow;
- otherwise it starts a new empire named after the TikTok display name.

A player signed in with Google can also connect TikTok, just for sharing.

`PlayerRec.tiktokId` is the login identity. `PlayerRec.tiktok` holds the
tokens and profile. Disconnecting, or the `authorization.removed` webhook,
deletes `tiktok`. It also deletes `tiktokId`, unless TikTok is the empire's
only sign-in. Access tokens refresh on use. They never reach the browser.

## 3. Clips

When a battle ends, "Share clip" replays it in the browser:
- The picture is a 1080×1920 canvas: the board, both players, and the last move in large type.
- Sound is a knock per move and a chord at the end.
- The canvas is recorded with MediaRecorder: MP4 where the browser supports it, otherwise WebM.
- Long games show their last 110 plies.
- There's no logo or watermark.

Battles carry `startFen` so the replay knows where the battle began.

## 4. Posting rules (TikTok's Content Posting UX guidelines)

- The form shows the creator's avatar and nickname from `creator_info`.
- "Who can see this video" has no default. Only the creator's allowed options are listed.
- Comment, Duet and Stitch start off, and stay disabled where the creator turned them off.
- "Disclose video content" asks for Your brand and/or Branded content, with TikTok's label wording.
  - Branded content can't be private.
- The consent line links TikTok's Music Usage Confirmation, plus the Branded Content Policy when branded.
- A clip longer than `max_video_post_duration_sec` is refused.
- After posting, the player is told it may take a few minutes to appear. The game polls `status/fetch`, and the webhook raises an alert.

Until TikTok audits the app, direct posts are visible only to the creator
(`SELF_ONLY`).

## 5. Endpoints

| Path | Does |
|---|---|
| `GET /auth/tiktok/start?token=&then=` | Redirects to TikTok's authorize page |
| `GET /auth/tiktok/callback` | Exchanges the code and signs in or links the account |
| `GET /tiktok/me` | Connection state and `creator_info` (header `x-owc-token`) |
| `POST /tiktok/post?mode=direct\|draft` | Body is the video; header `x-owc-meta` holds the settings. Single-chunk `FILE_UPLOAD`; one post per 30s |
| `GET /tiktok/status?id=` | The post's status (the owner only) |
| `POST /tiktok/disconnect` | Revokes the token and deletes the link |
| `POST /tiktok/webhook` | Verifies `TikTok-Signature` (HMAC-SHA256 of `t.body` with the client secret, within 10 min) |

Env: `TIKTOK_CLIENT_KEY`, `TIKTOK_CLIENT_SECRET`. `TIKTOK_API` and
`TIKTOK_AUTHORIZE` can be overridden for tests.
