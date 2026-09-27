# Design Principles

## 1. Emergence over features (Decided)

> "We don't want to bake features in, we want gameplay to emerge from first principles."

A small set of basic rules should produce the interesting behavior: migration, capitals, frontiers, alliances, raids. We don't script those behaviors as features.

**Basic rules** (the only kind of thing we add):
- Pieces move by their chess gaits.
- Buildings live only near a king.
- Buildings draw on nearby nodes.
- Battles are chess.
- Losing a king loses what it held.
- Resources are richer, and rivals stronger, at higher elo.

**Features** (what we avoid):
- a "capital" designation;
- a "relocate your Emperor" button;
- a quest pushing players toward high elo;
- any special mode that only exists to produce one behavior.

**The test for any new mechanic:**
1. Can this behavior already come out of the existing rules? If so, tune the numbers, not the rules.
2. If a rule is really missing, is it general (it applies everywhere, to everyone, all the time) and not one-purpose?
3. Does it add a new button or mode? Prefer changing what an existing action *does* over adding an action.
4. Can bots ([specs/bots.md](specs/bots.md)) play it using the same actions as humans? If a bot needs a special case, the rule is probably a feature in disguise.

**Verify emergence with bots.** Simulated bot populations are how we check that the behaviors we want really appear: migration toward high elo, compact empires, Emperors traveling with their armies. See [specs/migration.md](specs/migration.md) §5.

## 2. One interaction model

Everything the player does is **select pieces, then tell them where to go or what to do**. That's the same click-drag (desktop) or tap-drag (mobile) everywhere. Moving an Emperor across the empire, sending a raiding party, and placing a building all use the same model. See [specs/ux.md](specs/ux.md).

## 3. Chess stays chess

Battles are plain chess. Anything that changes the rules of chess inside a battle is out of bounds. The world layer is where the game design lives.

## 4. Mobile and desktop are both first-class from day 0

Neither is a port of the other. See [specs/ux.md](specs/ux.md).

## 5. The world feels alive from day 0

Bots play the same game through the same protocol as humans ([specs/bots.md](specs/bots.md)). Pieces live their own lives in settlements, nature reacts, and everything moves and sounds to one 100 BPM heartbeat ([specs/visuals.md](specs/visuals.md), [specs/audio.md](specs/audio.md)). **Life never changes outcomes:** idle and decorative behavior stays out of the rules.

---

## Audit of the current specs against principle 1

These were written before the principle was stated. Changes applied or proposed:

| Spec item | Problem | Change |
|---|---|---|
| "Found a city" action; a fixed city center and radius ([economy.md](specs/economy.md) §2) | A city is a baked-in object | **Applied:** no city object. A building stays up while **any** of its owner's kings is within 10 squares of it. A "settlement" is just what we call a group of buildings anchored by the same king (a label for the UI and battles, not a rule). |
| "Swap anchor" action that takes 3 turns | A special action | **Applied:** removed. It happens on its own: walk another king in, walk the old one out. |
| Imperial seat, capital bonuses (considered for migration) | Features | **Not doing.** The Emperor is a king; wherever you keep it is your "capital" only because it's where you're strongest. See [migration.md](specs/migration.md). |
| Titles, monuments, "hold a pocket for a week" ([progression.md](specs/progression.md) §6) | Scripted goals | **Downgraded** to an optional brainstorm. Leaderboards stay (they're just stats). |
| Routed bands walk home on their own ([movement.md](specs/movement.md) §4) | Scripted behavior | **Kept for now:** a king-less group needs *some* rule. The more general version: king-less pieces can't be ordered, and they drift toward the nearest friendly king. Revisit after playtests. |
| Spawn shield for new players ([progression.md](specs/progression.md) §4) | A protection feature | **Kept:** onboarding safety beats purity here. It should only exist in the new-player zone. |
| Formation auto-switching (line or column) | Presentation | Fine: it's how a group move looks, not a new rule. |
