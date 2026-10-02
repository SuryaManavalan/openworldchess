// Acts for armies in the world (tools/shorts/README.md): orders a staged player gives from their
// own tab, through the same commands the interface sends.
import { player } from './battle.mjs';

/**
 * `as`'s elephants clear the land in a box relative to their (non-Emperor) king:
 * `from`/`to` are [dx, dy] corners. `hard` also breaks rock and ore.
 */
export async function clear(ctx, { as, from, to, hard = false, n = 8 }) {
  const p = await player(ctx, as);
  const err = await p.evaluate(async ([from, to, hard, n]) => {
    const o = window.__owc, m = o.mirror, k = m.myKings().find((q) => !q.emperor);
    const ids = m.myPieces().filter((q) => q.kind === 'R').slice(0, n).map((q) => q.id);
    return o.commands.clearLand(ids, [k.x + from[0], k.y + from[1]], [k.x + to[0], k.y + to[1]], hard).then(() => null, (e) => String(e));
  }, [from, to, hard, n]);
  if (err) console.warn('clear:', err);
}

/** `as` sends pieces (`kinds`, default all but the Emperor) to [dx, dy] from their king, as one troop. */
export async function march(ctx, { as, to, kinds }) {
  const p = await player(ctx, as);
  await p.evaluate(([to, kinds]) => {
    const o = window.__owc, m = o.mirror, k = m.myKings().find((q) => !q.emperor);
    const ids = m.myPieces().filter((q) => !q.emperor && (!kinds || kinds.includes(q.kind))).map((q) => q.id);
    o.ui.getState().select(ids);
    o.input.issue([k.x + to[0], k.y + to[1]]);
    o.ui.getState().select([]);
  }, [to, kinds]);
}
