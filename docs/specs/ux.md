# UX Spec: Mobile and Desktop

**Decided:** mobile-friendly and desktop-friendly from day 0. Neither is a port of the other. Each gets the interactions that feel native on it.

This spec covers interaction and layout. Rendering, state and modes are in [client.md](client.md).

## 1. Principles

1. **One interaction model:** *select, then direct.* Every action is choosing pieces, then showing them where to go or what to target. Moving an Emperor across the empire uses the same gesture as moving a pawn ([PRINCIPLES.md](../PRINCIPLES.md) §2).
2. **Direct manipulation on touch.** You drag the thing to where you want it. You don't pick from a menu.
3. **The thumb zone owns the actions.** On phones, everything you *do* sits in the bottom third. The top shows information only.
4. **Nothing depends on hover.** Hover can add to desktop, but every piece of information is reachable by tap.
5. **Forgiving targets.** A tap on a small piece snaps to the nearest selectable thing. Every touch target is at least 44pt.
6. **Confirm only what can't be undone.** Moves are cheap and can be re-issued, so they need no confirmation. Attacks, buildings and resigning are confirmed.
7. **The same features on every platform.** There are no desktop-only abilities. The ergonomics differ, the power doesn't.

## 2. Form factors

| Form factor | Primary orientation | Layout family |
|---|---|---|
| Phone | **Portrait** (one-handed); landscape supported | Phone layout (§4) |
| Tablet | Either | Desktop layout with touch gestures |
| Desktop / laptop | Landscape | Desktop layout (§5) |

The layout is chosen by viewport size and input type (`pointer: coarse` plus width), not by user agent. A touchscreen laptop gets the desktop layout, and both input sets work.

## 3. Gestures and their desktop equivalents

| Intent | Mobile (touch) | Desktop (mouse + keyboard) |
|---|---|---|
| Pan | One-finger drag on the ground | WASD / arrow keys, middle-drag, edge scroll |
| Zoom | Pinch | Scroll wheel |
| Rotate the camera 90° | **Two-finger twist**, snapping to 90° with a haptic tick | Q / E |
| Select a piece | Tap it | Click |
| Select a king's group | **Double-tap** the king (or any of its pieces) | Double-click, or click the troop in the troop list |
| Select a custom group | **Long-press, then draw a loop** around pieces (lasso) | Left-drag a box on empty ground |
| Add to the selection | Tap more pieces while the selection chip shows "+" | Shift + click / Shift + drag |
| **Move** | **Drag from any selected piece to the destination** (see below) | Right-click the destination |
| Set facing on a move | While dragging, twist a second finger | Right-drag: release direction = facing |
| **Attack** | Drag the selection **onto an enemy piece, king or building**, then confirm | Right-click the enemy, then confirm |
| Build | Drag a building card from the Build sheet onto the map | Click a card, then click the map |
| Context menu | Long-press on something without dragging: a radial menu | Right-click on your own thing, or a hover tooltip |
| Deselect | Tap empty ground | Esc, or click empty ground |
| Jump to something | Tap an alert banner, troop chip or minimap | Same, or keys 1–9 for control groups |
| Undo the last order | Shake is **not** used; tap Stop on the action row | S (stop), or Ctrl+Z within 3 seconds |

### Drag-to-command (the core mobile gesture)

1. Press on a selected piece and drag. A **path preview** draws from the group to your finger, and a ghost formation shows at the destination.
2. The ghost sits **80px above your finger**, so your thumb never hides where you're aiming. The preview snaps to squares and follows the move rules: it turns red where the group can't go, and stops at the edge of reach ([movement.md](movement.md) §4).
3. Drag over an enemy and the target turns red with an **Attack** label.
4. Release to commit. Drag back onto the group to cancel.

This covers selecting and dragging a group to a location, from the Emperor across the map to a pawn one square over. It's the same on desktop with a mouse.

A two-step alternative for accessibility: with a selection, tap the ground to place the ghost, then tap the **Move** chip.

### Choosing among overlapping things

Only one piece stands on a square, so things only overlap at far zoom. Tapping a cluster zooms in on it. At close zoom, a tap between two pieces fans them out briefly to choose from.

## 4. Phone layout (portrait)

### World

```
┌───────────────────────────────┐
│ ◉ 1340   ⚔ 1 alert      ☰     │  status strip (information only)
│ ┌───────────────────────────┐ │
│ │ ⚠ City A attacked · 0:52  │ │  alert banner: tap to fly there
│ └───────────────────────────┘ │
│                          [▣]  │  minimap button (opens a sheet)
│                               │
│          THE WORLD            │
│      (full-bleed canvas)      │
│                               │
│ ┌───────────────────────────┐ │
│ │ Line ▾ · Stop · ⤢ Attack  │ │  action row (only with a selection)
│ └───────────────────────────┘ │
│ ♔12  ♔7  ♚5 ◔  ♔3   …   [🔨] │  troop bar: your kings, swipe sideways; build button
└───────────────────────────────┘
```

- **Troop bar:** one chip per king, showing piece count, a cooldown ring, and a danger badge. Tap a chip to select that group and fly to it; double-tap to follow it.
- **Bottom sheets** hold all detail. They have three heights (peek, half, full) and are dragged up or down: selection details, building info, the build list, the minimap, the battle list.
- **No floating panels over the world** on phones. The world stays visible.

### Battle

```
┌───────────────────────────────┐
│ ♚ Opponent 1410        4:12   │  opponent bar + clock
│ ┌───────────────────────────┐ │
│ │                           │ │
│ │     BOARD (full width)    │ │  your side at the bottom
│ │                           │ │
│ └───────────────────────────┘ │
│ 12. Nf3 Nc6 13. Bb5 a6 …   →  │  move strip (swipe sideways)
│ ♔ You 1340             4:31   │  your bar + clock
│   😐 · ½ Draw · ⚑ Resign      │  actions (resign asks for confirmation)
└───────────────────────────────┘
```

- **Moves:** tap-tap or drag, like chess apps. The piece lifts under your finger and the legal squares show dots.
- **Promotion:** the picker opens right on the promotion square.
- **Haptics:** a light tick on each move, a stronger one on captures and check.
- **Low clock:** under 10 seconds the clock turns red and pulses; a haptic buzz at 10s and 5s.
- **Landscape phone:** the board on the left, clocks and the move list on the right.
- **Spectating** uses the same layout without the action row, and adds an emote bar.

## 5. Desktop layout

```
┌──────────────────────────────────────────────────────────────┐
│ ◉ Name 1340 · alerts                               ⚙ Menu    │
├────────────┬────────────────────────────────────┬────────────┤
│ Troops     │                                    │ Selection  │
│ ♔ North 12 │                                    │ details,   │
│ ♚ Emp. 5 ◔ │            THE WORLD               │ building,  │
│ ♔ Raid 7   │                                    │ battle     │
│            │                                    │ panel      │
│ Buildings  │                                    │            │
│ …          │                              ┌────┐│            │
│            │                              │mini││            │
└────────────┴──────────────────────────────┴────┘┴────────────┘
```

- The side panels can be collapsed. Hotkeys are shown in tooltips. Rich hover information (ranges, work areas, a king's reach) shows on hover as an extra.
- **Battles on desktop** keep the world visible and dimmed around a large board. The clocks and move list sit to the right, like chess.com's layout.

## 6. Alerts and notifications

An attack gives **60 seconds** of warning ([battle.md](battle.md) §2). A warning is useless if you're not looking, so:

- **In the app:** a banner, a sound, a haptic buzz, and a one-tap **Go to battle** button.
- **Outside the app:** a **push notification** ("City A is being attacked. Battle in 0:58"). Tapping it opens straight into the battle.
  - Web Push works in Chrome and Android, but on iOS only for an installed PWA (iOS 16.4+), and it's unreliable there.
  - **Recommendation:** ship a **PWA from day 0**. Add **Capacitor** wrappers for iOS and Android no later than the alpha (M6), for reliable push, haptics on iOS, and app store presence. It's the same codebase ([TECH.md](../TECH.md) T18).
- Settings let you choose which alerts reach you: attacks (on by default), battle results, buildings decaying.

## 7. Mobile realities

| Reality | Handling |
|---|---|
| Interruptions (a call, switching apps) | The battle keeps its clock. Reconnecting resumes it at once, and the AI covers disconnects of 20 seconds or more ([battle.md](battle.md) §5). When resumed, the client shows what happened while it was away. |
| Flaky networks | Automatic reconnect with backoff, and fresh chunk snapshots when it's back ([networking.md](networking.md) §4). A small "reconnecting" pill, never a blocking modal. |
| Battery | The frame rate drops to 30 fps when idle, and to 0 when the app is in the background. Particles are reduced on low-power devices. |
| Memory (iOS Safari) | Atlases at 1× or 2× chosen by screen density; unused chunk textures are evicted; a texture budget of about 150 MB. |
| Screen notches and home bars | All fixed UI respects safe-area insets. |
| Accidental zoom or scroll | `touch-action: none` on the canvas; the page itself never scrolls in the world view. |

## 8. Accessibility

- Team colors are chosen to be distinguishable with color blindness, **and** each player has a banner emblem. Identity never depends on color alone.
- A reduce-motion setting skips the arcing knight hops and replaces camera flights with cuts.
- UI text scales with the system text size. The board and HUD reflow up to 130%.
- Later: screen-reader move announcements in battles (SAN read aloud).

## 9. Implementation notes

- **Gestures:** our own small recognizer on Pointer Events handles tap, double-tap, long-press, drag, pinch, twist and lasso, with explicit priority rules (for example, a long-press cancels a pan). It's about 400 lines and easy to test. Alternative: `@use-gesture/vanilla`.
- **Commands:** every gesture and every mouse or keyboard action turns into the same command objects (`select`, `move`, `attack`, `build`, and so on). Everything after that is shared. Bots issue these same commands ([bots.md](bots.md)).
- **Device test matrix:**
  - small phone: iPhone SE;
  - current iPhone;
  - mid-range Android: Pixel 6a;
  - low-end Android: 3 GB RAM;
  - iPad;
  - desktop Chrome, Firefox and Safari.

  CI runs Playwright with mobile emulation for layout checks. Before each milestone, the team plays for real on actual devices.
- **Definition of done:** every milestone ([ROADMAP.md](../ROADMAP.md)) counts as done only when it works on a phone in portrait **and** on desktop.
