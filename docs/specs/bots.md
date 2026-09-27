# Bots Spec: AI Players From Day 0

**Decided:** from day 0 the world has AI-controlled players that can't be told apart from real players. They serve testing and make the world feel alive before there's a large player base. They're phased out slowly as more people join.

## 1. Principle: bots are players

- A bot is an **ordinary account** playing through the **same WebSocket protocol** and the **same commands** as the human client ([ux.md](ux.md) §9, [networking.md](networking.md) §2).
- It gets no server-side shortcuts: no hidden information, no special actions, the same rate limits.
- This is what makes bots honest opponents. It also makes them useful as tests: if a bot can play the game, the protocol is complete.
- The server keeps a private `is_bot` flag for operations and analytics. **It is never sent to any client.**

## 2. Telling players (a decision for you)

If bots can't be told apart, some players will believe they beat, lost to, or rivaled a human who doesn't exist.
- Many games backfill with bots, and it's widely accepted when **disclosed at the level of the game**.
- When it's discovered and *wasn't* disclosed, it tends to cost player trust.

**Recommendation:**
- State in the FAQ and terms that "the world includes AI-controlled rulers, especially while the game is young".
- Never claim that a particular account is human.
- Keep bots out of anything involving money or real social relationships. Chat is emote-only already, so no one can form a friendship with a bot.

Individual bots stay unlabeled, so they keep their purpose. *Your call.*

## 3. Architecture

```
bot-runner (separate process; scale out to more of them)
 ├─ population manager     how many bots, where, when (§7)
 ├─ bot × N                one per account
 │   ├─ persona            name, color, emblem, strength, style, schedule
 │   ├─ memory             only what its own client has seen
 │   ├─ strategy           utility AI, replans every 30–120s
 │   ├─ tactics            turns plans into commands, with human timing
 │   └─ client             headless protocol client (shared with the web client)
 └─ chess pool             Maia and Stockfish processes for battles
```

- It uses `packages/rules` and `packages/worldgen`, the same packages the web client uses, to plan paths and judge sites.
- The runner has **no database access**. It talks to the game only through the protocol, the same way a player's client does.
- One runner process hosts about 200 bots. It sleeps between decisions, so the cost is mostly chess engines during battles.

## 4. Inside a bot

### Persona

| Trait | Values | Effect |
|---|---|---|
| Name | Generated handles in the style of real online names | — |
| Strength | A true rating of 600–2400 | Chess strength, and how sharp its planning is |
| Style | Builder, raider, expander, turtle, opportunist | Weights on the utility terms below |
| Risk appetite | 0–1 | How readily it attacks; whether it moves its Emperor |
| Schedule | A timezone, session lengths and days off, sampled from human distributions | When it's online |

### What it knows

- Only what its client has received: its own entities plus the chunks it subscribed to. It keeps a memory of explored terrain and of enemies it has seen, which fades over time.
- It can run worldgen locally, just as a human can see the map, but it only **trusts** resource nodes it has actually seen, since nodes it hasn't seen may be depleted.

### Strategy (utility AI)

Every 30–120 seconds (with random jitter), the bot scores its candidate actions and picks one by weighted random choice, not always the top score. That makes it plausibly imperfect.

| Action | Utility, roughly |
|---|---|
| Settle a site with a king | expected production of the site (nodes, richness) − danger (enemy strength nearby) − travel risk |
| Build X near king K | how much X's production adds to army balance × node quality |
| Move a king or the Emperor | the gain in production, safety and reach − exposure on the road ([migration.md](migration.md) §2) |
| Attack king T | P(win) × value(T's holdings) − P(loss) × value(own king and set) |
| Defend or reinforce | threat level × value of what's at stake |
| Idle or regroup | a baseline |

- `P(win)` comes from the standard Elo expectation using the two sides' ratings, adjusted for the material in the two sets (a piece-value difference mapped to an Elo offset).
- **No behavior is scripted.** Migration, raiding and escorting the Emperor come out of these utilities and the basic rules ([PRINCIPLES.md](../PRINCIPLES.md) §1). Bots are how we check that the rules actually produce them.

### Tactics and humanization

What other players can observe (orders, timing, presence, battle play) should look human:

- **Reaction time** to alerts: lognormal, with a median of 8 seconds and a long tail. Sometimes (depending on its schedule) it doesn't respond at all.
- **How often it issues orders:** bursts and lulls, never a metronome, and capped at human speeds.
- **Imperfection:** it sometimes leaves a piece behind, takes a longer path, or misjudges a fight, at rates that shrink as its strength grows.
- **Presence:** it logs in and out on its schedule. When it's offline, its battles use the normal AI stand-in, exactly as for a human ([battle.md](battle.md) §5).

### Chess

| Engine | How human it looks | Use |
|---|---|---|
| **Maia** (a neural net trained on lichess games to *predict human moves* at a given rating; Maia-2 covers a wide range of ratings) | High: it makes human-looking mistakes | **Main engine** for bot battles up to ~1900–2000 |
| Stockfish with `UCI_Elo` | Low: perfect moves mixed with odd blunders, which strong players can spot | Above ~2000, mixed with Maia's move policy |

- **Licensing:** Maia runs on lc0 (GPL-3). Like Stockfish, it runs only on the server side, so it's never distributed ([TECH.md](../TECH.md) T10). Verify the license of the model weights before shipping.
- **Timing model:**
  - Think time is lognormal, scaled by how complex the position is (number of legal moves, how much the evaluation swings).
  - Obvious recaptures are fast.
  - It spends more time on critical moves and gets sloppy when low on time.
  - It sometimes premoves.
- **Human endings:**
  - It resigns once the evaluation has been lost for several moves (the threshold depends on the persona).
  - It offers draws in dead positions.
  - It sends "GG" emotes at human rates.

## 5. Rating integrity

- Bots have real ratings that change like anyone else's. Each bot's **playing strength is calibrated to its rating** (Maia level and planning sharpness), so beating a 1500 bot means about the same as beating a 1500 human. Human ratings stay meaningful.
- Monitor for drift: if a bot's rating runs far from its true strength, recalibrate it quietly.

## 6. Testing uses

| Use | How |
|---|---|
| **Load testing** | Spin up N bots against staging (up to 200 per runner process) ([TECH.md](../TECH.md) T16). |
| **Scenario tests** | Scripted bots in CI: two bots fight, a siege plays out, an Emperor is killed. The expected outcomes are asserted. |
| **Balance and emergence** | Offline mode: the server simulation and bots in one process, no network, time sped up ×20. This powers the migration checks ([migration.md](migration.md) §5) and economy tuning. |
| **Protocol completeness** | A bot must be able to do everything a player can. A missing command shows up as a bot that can't act. |

## 7. Population and phasing out

**The population manager** keeps each region and elo band feeling alive:

```
botTarget(band) = max(0, desiredPopulation(band) − humansActive(band))    // smoothed over hours, never sudden
```

- **At launch:** bots spread across every elo band, with extra density in the new-player zone so first sessions have neighbors.
- **Around new humans:** the bots nearby are generated with low risk appetite and similar ratings. The spawn shield still applies. The first hours should be interesting, not a massacre.
- **No ganging up:** bots don't share information and don't coordinate. A human is attacked by at most one bot at a time, and by at most N bots per day.
- **Phasing out:**
  - As human numbers grow, bots don't vanish. They **retire**: they log in less and less over weeks, like players drifting away.
  - Their holdings then follow the normal rules for inactive players (buildings decay once no king is nearby; unguarded holdings become targets). That's content for the humans who remain.
- A rough schedule, tuned from real data:

| Concurrent humans | Bots per human |
|---|---|
| < 100 | 3 : 1 |
| 500 | 1 : 1 |
| 2,000 | 0.2 : 1 |
| 5,000+ | ~0 (a few remain for testing) |

- **Kill switches:** per bot, per region, and global.

## 8. Measuring whether bots can be told apart

1. **Statistics:** compare distributions of everything a player can observe, bots against humans:
   - move times;
   - accuracy by rating (average centipawn loss);
   - resignation timing;
   - session lengths;
   - order rates;
   - attack frequency.

   Use two-sample KS tests. Before there are human players, calibrate chess behavior against the **lichess open database** (which has move times and ratings). Refit to our own players as their data arrives.
2. **Classifier test:** train a simple model to tell bots from humans using only what players can observe. Target: **AUC < 0.6**, close to a coin flip.
3. **Human judges:** occasional opt-in surveys ("which of your last 10 opponents were AI?"). Target: no better than chance.

## 9. Build order

This work is folded into [ROADMAP.md](../ROADMAP.md):

| Milestone | Bot capability |
|---|---|
| M1 | Battle bot: the Maia/Stockfish pool, the timing model, resign and draw behavior. Practice battles use it. |
| M2 | Roaming bots: log in, explore, move troops with human timing. Load testing starts. |
| M3 | Attack and defense decisions (utility AI, P(win) estimates). |
| M4 | Economy: settling, building, migrating. Offline sped-up simulation mode. |
| M5 | Personas, schedules, persistent bot accounts, rating calibration. |
| M6 | Population manager, phasing out, measuring detectability, kill switches. |
