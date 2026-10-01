# Contributing to Open World Chess

Thanks for wanting to help build the endless chessboard. Bug fixes, ideas, art, balance tweaks,
docs and features are all welcome. New to open source? That's fine: open an issue or ask in
our [Discord](https://discord.gg/B6kPjrakW) and we'll help you land your first pull request.

## How it works

1. **Fork** this repository (the Fork button on GitHub) and clone your fork.
2. Make a **branch** for your change: `git checkout -b fix-knight-pathing`.
3. Make the change, and run the checks below.
4. **Push** to your fork and open a **pull request** against `main`. Say what you changed and why,
   with a screenshot or short clip if it changes something you can see.
5. We review every pull request. CI runs the same checks automatically; a maintainer approves the
   first run for new contributors. Once it's merged, it ships to openworldchess.com on its own.

For anything big (a new mechanic, a new building, a rework), please **open an issue or start a
thread on Discord first**, so we can agree on the design before you spend time on it.

## Running it locally

You need Node 22 and pnpm 9 (`corepack enable` gives you pnpm).

```bash
pnpm install
pnpm dev          # game server + client (http://localhost:5173) + bots
```

Open http://localhost:5173 and you're playing on your own local world. More detail is in
[docs/STATUS.md](docs/STATUS.md).

## Before you open a pull request

```bash
pnpm typecheck    # TypeScript across every package
pnpm test         # rules, server, campaign, and an end-to-end game
pnpm build        # the client builds
```

All three must pass (CI runs them too). If you change how the game behaves, add or update a test
in `apps/server/test/` or the package you touched.

## Where things are

| Path | What's there |
|---|---|
| `apps/server` | The game server: world, economy, battles, the wilds, troops, the Chronicle (campaign) |
| `apps/client` | The browser client (React for the interface, PixiJS for the world) |
| `apps/bots` | Bot players that use the same actions as people |
| `packages/shared` | Types, constants, the protocol, and the lessons the game teaches |
| `packages/rules` | Pure game rules: movement, pathfinding, battles, ratings |
| `packages/worldgen` | The procedural world: biomes, resources, the land's rating |
| `packages/engine` | The chess engine wrapper used by the wilds and the AI |
| `art/` | The art pipeline (pieces, buildings, creatures) |
| `docs/` | The design: start with [PRINCIPLES.md](docs/PRINCIPLES.md), then the specs in [docs/specs](docs/specs) |

## How we build

- **The specs are the source of truth.** Each system has a spec in `docs/specs` (battle, economy,
  movement, campaign, and others). If your change alters how something works, update its spec in
  the same pull request.
- **Emergence over features.** We'd rather add one general rule than a special mode. Read
  [docs/PRINCIPLES.md](docs/PRINCIPLES.md) before proposing a mechanic.
- **No secrets in the game's rules.** Every rule a player is subject to is explained in-game (the
  lessons in `packages/shared/src/lessons.ts`). New rules come with their lesson.
- **Phone and desktop.** Anything in the interface must work on a phone-sized screen and on desktop.
- **Art direction.** It's 2D and clean, in the spirit of chess.com: stoic pieces, not cute ones.
  The rook is a war elephant. See [docs/specs/art.md](docs/specs/art.md).
- **Keep it fast.** The server runs on a small machine. If your change does work every turn, see
  [docs/specs/performance.md](docs/specs/performance.md).
- Match the style of the code around you. Small, focused pull requests are easier to review and
  get merged sooner.

## Never commit

API keys, tokens, passwords, or anything from a `.env` file. Production secrets live on the server,
never in this repository.

## License

Open World Chess is licensed under the [GNU Affero General Public License v3.0](LICENSE). By
contributing, you agree that your contributions are licensed under the same license. In short:
you can use, study, change and share this code, and if you run a modified version as a public
server, you must share your changes under the same license.
