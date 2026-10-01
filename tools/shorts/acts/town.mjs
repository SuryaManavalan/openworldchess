// Acts for towns (tools/shorts/README.md): a staged player builds, through the real build flow
// (the same ghost and checks a player sees), at the nearest good spot to where it's asked.
import { player } from './battle.mjs';

/**
 * `as` builds a `type` at the nearest spot where the build ghost says it's allowed, searching
 * outward from `near` (squares relative to their king, or with `from: "building"` to their first
 * building: a town grows as one). Returns the spot.
 */
export async function build(ctx, { as, type = 'house', near = [0, 0], max = 10, from = 'king' }) {
  const p = await player(ctx, as);
  const at = await p.evaluate(([type, near, max, from]) => {
    const o = window.__owc, ui = o.ui.getState();
    const k = o.mirror.myKings().find((q) => !q.emperor) ?? o.mirror.myKings()[0];
    const b0 = from === 'building' ? o.mirror.myBuildings().sort((a, b) => a.id - b.id)[0] : null;
    const cx = (b0 ?? k).x + near[0], cy = (b0 ?? k).y + near[1];
    ui.set({ buildType: type });
    for (let r = 1; r <= max; r++)
      for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        o.input.updateGhost([cx + dx, cy + dy]);
        if (o.ui.getState().ghost?.ok) { o.input.placeBuilding(); return [cx + dx, cy + dy]; }
      }
    ui.set({ buildType: null, ghost: null });
    return null;
  }, [type, near, max, from]);
  if (!at) { console.log(`build ${type}: no good spot near`, near); return null; }
  // Wait until the server has it, so the next build doesn't pick the same spot.
  await p.waitForFunction(([x, y]) => [...window.__owc.mirror.buildings.values()].some((b) => x >= b.x && x < b.x + b.size && y >= b.y && y < b.y + b.size), at, { timeout: 8000 }).catch(() => console.log('build: not confirmed at', at));
  return at;
}
