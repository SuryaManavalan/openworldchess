# Visuals Spec: A Living World

**Decided:** the world should be beautiful, eye-catching and almost hypnotic to watch: something you get lost in. It should feel alive, like a little world. Pieces in a city walk around and live their own lives. It's the small touches that make someone stop and think "wow, this world is alive."

Art style and assets are in [art.md](art.md); how pieces move under orders is in [movement.md](movement.md) §8. This spec covers **life, feedback and atmosphere**. Sound is its twin ([audio.md](audio.md)).

## 1. Pillars

1. **One heartbeat.** The world turn is 600ms, which is **100 BPM**. Steps, idle breathing, flag flutters, waves in the wheat and the music all lock to this beat. A marching army, a working settlement and the soundtrack share one pulse. That shared rhythm is where the hypnotic feeling comes from.
2. **Life is routine, not gags.** The characters are stoic ([art.md](art.md) §1). They show life through dignified habits: drilling, working, keeping watch, paying respect. No cartoon slapstick.
3. **The world reacts.** Nature and bystanders respond to what players do. Birds scatter from an army, a crowd gathers around a battle, grass wears into paths. Reaction is what makes a world feel alive, more than ambient loops.
4. **Readability comes first.** Ambient life must never look like a gameplay signal. No ambient red, no ambient motion that resembles an attack. It all calms down when you zoom out or an alert fires.
5. **Life never changes outcomes.** Anything decorative or idle stays out of the rules. Idle movement follows the reach and occupancy rules and gives way immediately to any order ([PRINCIPLES.md](../PRINCIPLES.md) §1).
6. **Everyone sees the same life.** Decorative motion is seeded by `(piece id, world turn)`, so every player watching a settlement sees the same thing. That makes screenshots and streams shareable: "look at that knight."

## 2. Pieces living their lives

### Idle routines (on the server, low priority)

A piece with no orders, inside a settlement (within reach of an anchoring king), runs an **idle routine**. These are real, cheap gait moves on the server, at most one every 3–8 turns. The rules:
- routines stay within the anchoring king's reach;
- idle pieces give way (swap) to any ordered piece instantly;
- they never stand on a square the owner is placing a building on;
- they stop the moment an alert fires.

Routines are drawn from the piece's type and from **what's really happening in the settlement**, so the life reflects the economy:

| Piece | Routines |
|---|---|
| **Pawn** | **Drill:** idle pawns form a rank on the plaza and march a square circuit on the beat, turning together at each corner (the about-face stomp; [movement.md](movement.md) §2). **Work:** they tend the wheat their house is drawing from, with a sickle motion on the beat. **Rest:** they stand in pairs outside a house, facing each other. |
| **Knight** | **Training circuit:** it traces a **closed knight's tour** around its stable (a real mathematical L-hop loop). It's rhythmic and quietly impressive. **Grazing:** it stands at the edge of the wheat. |
| **Bishop** | **Procession:** it walks the diagonals between the temple and other buildings, staying on its own square color as the rules require. It pauses at a building and gives a short glow of blessing. |
| **Elephant** | **Patrol:** a slow straight-line beat along the settlement's edge. **Labor:** it hauls stone from the rock nodes the barracks draws from. At rivers, it sprays water. |
| **Queen** | **Survey:** a long glide to a vantage point, a long pause looking outward, a glide back. |
| **King** | It mostly stands at its post, pacing one square at a time. When a king passes, nearby pawns turn to face it and hold still for one beat (stoic respect). |
| **Emperor** | As a king, but idle pieces that notice it form a short **honor line** as it passes. |

**Social moments:** two idle pieces that end up next to each other face each other for a few beats. A faint chess glyph can appear between them (♞? ♝!) as their "conversation".

### Rare moments

Some events are deliberately rare (about 1 in 1,000 to 1 in 100,000 per piece per hour), so players catch them and share them:
- idle pieces on the plaza happen to line up into a famous mate pattern (Anastasia's, a back-rank mate) for a few beats;
- two knights on opposite colors mirror each other's hops;
- a bishop stops in a sunbeam, and its shade band glows;
- a pawn drill with exactly 8 pawns forms a perfect rank; the pawns salute on the downbeat, and the formation dissolves.

These are seeded and deterministic (§1.6): everyone watching sees the same moment.

## 3. Buildings and production

- **Every building shows its real state:**
  - a producing building has activity (forge smoke from the barracks, a lantern swinging at the temple, horses shifting in the stable);
  - an idle building is still;
  - a decaying building shows cracks and a drooping flag, and its colors fade as its HP drops;
  - a ruin gets overgrown over time.
- **A piece is born:** the door opens on the beat, the new piece steps out onto the square in front, the owner's banner flutters once, and a soft glow fades.
- **Construction:** scaffolding rises in stages. Trees fall and rock gets chipped at the nodes it draws from, and the material visibly moves to the site.
- **Resources run down visibly:** rock outcrops shrink as they're quarried, and gold veins lose their shine. Tree stumps regrow through sapling stages.

## 4. Nature and atmosphere

| System | What it does | Reacts to |
|---|---|---|
| **Wind field** | One noise field that moves over time. Flags, wheat, tree canopies and grass tufts all sway to the same wind, so gusts **ripple across the map**. | — (global) |
| **Wheat waves** | A shader makes waves roll through fields, synced to the wind. | Pieces walking through leave a parting wake. |
| **Water** | Shimmer, ripples, occasional fish jumps, reflections of nearby pieces. | Knights hopping a ford splash; elephants spray. |
| **Birds** | Flocking birds (boids) roost in forests and circle. | They scatter when a troop comes within 6 squares, and again when a battle starts. |
| **Wildlife** | Deer at forest edges, butterflies over wheat, fireflies at night. | Deer flee from troops. |
| **Day and night** | A cosmetic cycle: 40 real minutes per day, the same for everyone. Color grading shifts through dawn, day, dusk and night. At night windows light up, pawns on patrol carry lanterns, and settlements glow warmly in the dark. | — |
| **Weather** | Regional and cosmetic: rain (wet ground shading, puddles), mist in valleys at dawn, snow at high altitude. | — |
| **Desire paths** | Squares walked often wear from grass into dirt trails over hours. Settlements grow their own roads **from real traffic**. | Real movement (the server tracks walking traffic per chunk and sends it in the chunk data). |

## 5. Feedback and juice (the satisfying parts)

| Moment | Visual |
|---|---|
| Select | The piece pops (scale 1.08, back over 120ms), and a selection ring draws around it. A lasso selects pieces **one after another** along the loop, each with its own pop. |
| Path preview | Dashes flow toward the destination at the beat's tempo; ghost pieces show where they'll end up. |
| Commit a move | A ripple at the destination; the ghosts snap into place; the troop starts moving on the next downbeat. |
| Knight hop | An arc, dust as it lands, and its shadow shrinking at the top of the arc. |
| Queen glide | Faint afterimages along long moves. |
| Elephant move | A stomp, dust, and a slight camera shake at 8 squares (turned off with reduce-motion). |
| Attack declared | A banner-red line to the target, and a countdown ring around both kings. |
| Battle start | The camera flies to the arena on the beat; the dome rises; the pieces march to their squares one by one. |
| Capture (battle) | The captured piece tips over, its banner drops, and it dissolves into dust. The capturing piece lands with weight. |
| Check | The king's square pulses; the dome tints slightly. |
| Checkmate | The king topples in slow motion; a shockwave crosses the board; the winner's color floods the dome, then washes outward over the world. |
| **Conversion** | The captured side's banners flip to the winner's color **one by one, in a wave** from the arena outward. Each flip is a little burst. This is the big payoff moment (paired with a sound cascade, [audio.md](audio.md) §4). |
| Production done | A soft glow; a count ticks up on the king's chip. Several completions in a row get **brighter each time**. |

## 6. Camera

- Panning coasts with momentum; zoom stretches slightly at its limits and springs back; rotation eases in over two beats.
- **Follow mode:** the camera trails a moving troop slightly ahead of it.
- **Watch mode:** after 60 seconds without input, if the setting is on, the camera slowly drifts across your settlements. It lingers on activity (a drill, a birth, a construction site), like a living screensaver. Any touch hands control straight back. This is the "get lost watching" mode.

## 7. Technology

- **PixiJS v8:**
  - Mesh or displacement shaders for wind (trees, wheat, flags), water, and the dome.
  - A color-grading lookup table for time of day.
  - Additive light sprites at night.
  - Particles in a ParticleContainer.
- **Ambient systems only run on screen** and scale with zoom and device tier:

| Tier | Ambient budget |
|---|---|
| Low-end phone | wind + water + idle routines; up to 200 particles; no weather |
| Mid | everything; up to 800 particles |
| Desktop / high-end | everything; up to 2,000 particles; reflections |

- Each tier gets a frame-time budget: ambient work takes at most 3ms a frame on mid-range phones. It's measured continuously, and the tier drops automatically.
- **Reduce motion** ([ux.md](ux.md) §8) turns off camera shake, afterimages and watch mode, and softens flocking.

## 8. Build order

| Milestone | Life and visuals |
|---|---|
| M2 | The beat clock; gait animations; wind field; water; birds that react to troops |
| M3 | Battle start, captures, checkmate, the conversion wave, a crowd around the dome |
| M4 | Idle routines tied to production; births; construction; nodes running down; decay |
| M5 | Day and night; desire paths; rare moments |
| M6 | Weather; watch mode; performance tiers tuned on real devices |
