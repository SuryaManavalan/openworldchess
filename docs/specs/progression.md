# Progression Spec

Covers the player's rating, the Emperor, losing everything and starting over, and protection for new players.

## 1. Accounts (Decided)

- **Play instantly as a guest:** you choose a username, and it must be **unique** (ignoring case). No sign-in is needed to start.
- **Guests are warned in the game:** "If you don't sign in, your empire will fall." There's a "Guest · sign in" chip, a reminder after a few minutes of play, the browser's leave-page prompt, and a sheet explaining what happens.
- **If a guest leaves without signing in, their empire falls** after a grace period (default 15 minutes, `GUEST_GRACE_MS`):
  - their pieces and buildings go masterless (nearby kings can claim them, as after an Emperor's fall);
  - the account is deleted, and **the username becomes available again**.
- **Signing in with Google** links the current guest empire to the Google account. After that it never falls for being offline (the AI defends it), and it continues on any device. Signing in on a new device with an account that already has an empire resumes that empire. A Google account without an empire starts a new one.
- Implementation: `apps/server/src/auth.ts` (OAuth code flow). Setup is in [deploy/README.md](../../deploy/README.md).

## 2. Rating (Proposed)

- **Glicko-2**, so new players converge quickly.
- Starting rating is **1000**, or **seeded from lichess** if they link a lichess account (lichess blitz rating − 100, clamped to 600–2200).
- Only rated battles change it ([battle.md](battle.md) §7).
- The rating drives spawn and respawn location on the elo map ([world.md](world.md) §4) and the AI's strength when it defends for you.
- Leaderboards: global, and per area.

## 3. The Emperor

### Decided

- Each player has one Emperor, an elite king.
- If the Emperor is killed (checkmated in a battle), the winner takes the pieces, and the loser **starts from scratch in a new, lower-elo area**.

### Proposed details

- The Emperor is a king in every way (movement, battle role, anchoring a city). It looks different (gold crown; [art.md](art.md)).
- It can't be produced or replaced. Palaces make ordinary kings only.
- There is no "capital" rule. Wherever you keep your Emperor is your capital in practice. Moving it is ordinary select-and-drag, and dangerous ([migration.md](migration.md)).
- **What an Emperor kill takes (Decided: option b, nearby only):**
  - The winner gets **every piece in the battle** (nobody flees) and **the whole city** the Emperor anchored: its garrison, buildings and site.
  - The loser's **other** holdings become **masterless**. Their other troops and garrisons turn neutral (grey collars) and stand still. Their other cities start decaying at once.
  - **Any** king that comes within 3 squares of a masterless troop, or enters a masterless city's radius, **claims** it. Its pieces convert to that king's owner, and a claimed city gets that king as its anchor.
  - Masterless holdings that nobody claims within 2 hours vanish (the pieces desert and the buildings fall to ruins).
  - The winner's reward is still huge. And an Emperor's fall sets off a land rush that nearby players can join.
  - *Rejected:* the winner absorbs everything, everywhere (too much snowballing), and a share scaled by distance (too complicated).
- **Restart:** the loser gets the starting kit ([economy.md](economy.md) §5) with a **new Emperor**. They respawn in open ground where `elo(x, y) ≈ newRating − 200`, and at least 500 squares from where they fell.
- The loser's rating also drops from the rated loss itself, so the move to a lower-elo area comes both from the map and from their rating.

## 4. Protection for new players (Proposed)

- **Spawn shield:** a new or respawned player can't be attacked for **2 hours of online play** or until they attack someone, whichever comes first. A visible bubble shows over their buildings.
- Elo areas already separate strong players from new ones. The shield covers the gap before that separation settles.
- The shield covers only the new-player zone. Pieces that leave it aren't shielded, which keeps early scouting interesting.

## 5. Being offline

- Cities and troops stay in the world while you're offline.
- A **defending AI** plays your battles at your rating ([battle.md](battle.md) §5).
- Troops you left in the field hold position; they can be attacked, and the AI defends them.
- On login, a **"While you were away"** report lists battles (with replays), conversions, production and decay.
- Future: an optional "camp" order that fortifies a troop, making it slower to engage (a longer countdown) in exchange for staying still.

## 6. Long-term goals (brainstorm only; see [PRINCIPLES.md](../PRINCIPLES.md) §1)

These are scripted goals, so they're **not planned**. Leaderboards (plain stats) are the exception. Anything here has to be rethought as something that comes out of the basic rules.

- **Titles by territory:** Baron (3 cities), Duke (6), and so on.
- **Holding a high-elo pocket** for a whole week earns a world-visible monument.
- **Seasonal world resets** (optional): keep ratings, reset the map. Many MMOs rely on this to keep the game fresh.
- **Replays:** every battle is stored as PGN, so battles can be shared and analyzed with an engine afterward.
