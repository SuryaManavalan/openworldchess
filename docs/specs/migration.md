# Migration Toward High Elo (Emergent)

**Goal (Decided):** higher-elo areas should draw players in. Empires should creep deeper over time: new villages further in, and the Emperor moving settlement to settlement toward the heart of the empire, even though that's dangerous.

**Constraint (Decided):** there is **no migration feature**. No capital designation, no relocate button, no bonus zone. Moving your Emperor is the same select-and-drag as moving anything else ([PRINCIPLES.md](../PRINCIPLES.md) §1). The drift has to come out of the basic rules. This doc traces how it does, checks the numbers, and describes how bots will verify it.

## 1. The basic rules involved

| # | Rule | Where |
|---|---|---|
| R1 | Buildings produce only from nodes within 3 squares | [economy.md](economy.md) §1 |
| R2 | Nodes are richer and ore is more common at higher area elo | [resources.md](resources.md) §2 |
| R3 | Stone and ore run out; wood and wheat regrow | [economy.md](economy.md) §1 |
| R4 | Buildings and pieces must stay within 10 squares of a king; kings are the slowest thing to produce | [economy.md](economy.md) §2, [movement.md](movement.md) §4 |
| R5 | The Emperor is a king, and losing it loses everything nearby, plus a restart lower down | [progression.md](progression.md) §3 |
| R6 | Movement is slow (a troop with pawns covers ~100 squares per minute), and attacks give 60 or 15 seconds of warning | [movement.md](movement.md) §2, [battle.md](battle.md) §2 |
| R7 | Players spawn and respawn by rating; losing an Emperor pushes you lower | [world.md](world.md) §4 |

## 2. How the behaviors arise

### "Deeper is better": R1 + R2 + R3

- A king is your scarcest asset (R4), so every king should anchor the best production it can reach.
- The same buildings produce more near richer nodes (R2), and palace sites are far more common in pockets (5% of sites at low elo, 19% at 2000+; [resources.md](resources.md) §4).
- Stone and ore run out (R3). Even a happy player eventually has to put kings somewhere new, and the best untapped sites are deeper, because they're richer and fewer people can hold them.

**Result:** a steady push inward that nobody scripted.

### "Deeper is dangerous": R7 + battles

- Strong players win more battles, and so hold more of the rich ground. Weak players who reach too far lose kings. If they lose their Emperor, R7 sends them back down.
- Over time this **sorts players by strength across the map**: an ecology where depth tracks skill. The danger comes from *who is there*, not from any rule about the zone.

### Compact empires: R4 + R6

- A settlement can only be reinforced during the 60-second warning if an army is within ~100 squares (a troop with pawns covers ~100 squares a minute). Holdings spread wider than that can be picked off one at a time.
- **Result:** empires stay compact and move as a body, not as a thin sprawl. A settlement left far behind decays when you pull its king forward (R4), so old land is abandoned naturally, or it becomes a prize for a neighbor.

### The Emperor follows the empire: R4 + R5 + R6

Nothing tells you where to keep your Emperor. The pressures:
- **It's a free king.** It anchors buildings like any king (R4). An Emperor sitting at an exhausted settlement in the back wastes your one king that never needs replacing.
- **Safety means being near your army.** Your army is where your production is, and that keeps moving deeper. An Emperor left far behind is out of reach of help when it's attacked (R6).
- **Moving it is the dangerous part.** On the road it's a troop in the open, open to a 15-second field battle, and a loss is catastrophic (R5). Its gold crown is visible to everyone. Players will escort it with their best set and travel along their own lines.
- **Out of these pressures come "royal progresses" and Emperor-hunting**, both through ordinary moves.

## 3. Is the pull strong enough? A gap found

In the current numbers, **richness only affects how much a node holds** (how long a mine lasts), not **how fast a building produces**. A barracks at elo 2200 makes Elephants at the same rate as one at elo 900. Only ore access and mine lifespan improve deeper. That's probably too weak to justify the danger.

**Proposed general rule (not a feature):** a building's production time scales with the richness of the node it draws from:

```
productionTime = baseTime / richness(node)        richness = clamp(1 + (elo − 1000)/2000, 0.7, 1.9)
```

- A stable on elo-2400 wheat makes knights about 1.7× as fast as one at elo 1000; one on elo-600 land runs at 0.8×.
- It's one rule, applied everywhere, and it's visible when placing a building (the preview shows the rate). It also feeds the battle cooldown formula ([battle.md](battle.md) §8): richer empires recover faster.

With it, the gradient per king (production rate × palace access × mine lifespan) roughly **triples** from the new-player zone to the heart of a pocket. That's a strong pull, and the danger is set by who's there, not by a number.

## 4. How it could go wrong, and what to adjust

| Failure | Symptom | Adjust (the rule stays; change the numbers) |
|---|---|---|
| The pull is too weak | Settlements' area elo stays flat over time, even for strong players | Steeper `richness`; more ore at high elo; smaller mines (they run out sooner) |
| The pull is too strong | Weak players rush pockets and lose Emperors repeatedly | Flatter `richness`; a longer fade out of the new-player zone ([world.md](world.md) §4) |
| Emperors never move | The Emperor sits by the first settlement forever | Smaller early mines, so the first settlement runs out within a few days |
| One player snowballs | The top player holds most pockets | There are many pockets (35% of 2,000² cells have one); finite mines force turnover; shared anchors and 60-second warnings help defenders |
| Empires sprawl | Players spread thin across huge areas | Slower pawns, or shorter warnings |

## 5. Checking emergence with bots

The bots ([bots.md](bots.md)) play by the same rules. Given only utility goals (grow production, protect kings, protect the Emperor), they should produce these behaviors **without being coded to**. If they don't, the rules need tuning. We don't add features.

**Simulation:**
- 500 bots of mixed strength (rating 800–2400).
- Time sped up ×20; roughly 30 in-game days.
- Worldgen as built.

**Metrics and success criteria:**

| Metric | Success looks like |
|---|---|
| Median area elo of a player's buildings over time, by player strength | Rises for strong bots, stays flat for weak ones; correlation with rating ≥ 0.5 by day 30 |
| Distance from the Emperor to the center of the player's buildings | Under 60 squares 80% of the time, **without any rule about it** |
| Emperor moves per player per week | More than 0, and increasing with strength (they do migrate) |
| Emperor deaths while traveling / all Emperor deaths | 20–50% (the road is dangerous, but not certain death) |
| Radius of a player's holdings (90th percentile of buildings from their center) | Under ~150 squares (compact) |

If a metric misses, adjust the numbers in §4 and rerun. Tuning like this is as quick as the resource balance simulator ([resources.md](resources.md)).
