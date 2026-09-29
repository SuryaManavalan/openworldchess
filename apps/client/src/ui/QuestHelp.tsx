// Help for every quest (campaign.md §5.5): what to do, step by step; what to look for, drawn in
// this land's own art (crops are berry bushes in a taiga, pumpkins in an autumn wood); and
// buttons that do the fiddly part for you (show me the crops, place the house, select the army).
import { BUILDINGS, CHAPTERS, FEATS, LESSONS, SIDE_TEACH, OPENINGS, PIECE_NAME, REACH, cheb, type BuildingType, type PieceKind, type SideQuest, type Step } from '@owc/shared';
import { biomeAt } from '@owc/worldgen';
import { mirror } from '../net.ts';
import { useUI } from '../store.ts';
import { scene, input } from './GameView.tsx';
import { buildingUrl, nodeUrl, pieceUrl } from '../game/textures.ts';
import { localName, nodeArt } from '../game/biomeArt.ts';
import { checkPlacement } from '../game/placement.ts';
import { SheetGrab } from './SheetGrab.tsx';
import { LessonView } from './LessonView.tsx';
import { Icon } from './Icon.tsx';

type Kind = 'tree' | 'rock' | 'ore' | 'wheat';
interface Help { title: string; steps: string[]; look: { img: string; label: string }[]; actions: { label: string; run: () => void }[]; note?: string }

/** The king the player is most likely working with: the one nearest the camera. */
function homeKing() {
  const ks = mirror.myKings();
  if (!ks.length) return null;
  const cx = scene?.cam.x ?? 0, cy = scene?.cam.y ?? 0;
  return ks.slice().sort((a, b) => cheb(a.x, a.y, cx, cy) - cheb(b.x, b.y, cx, cy))[0];
}
/** The nearest resources of a kind (loaded around the camera), nearest first. */
function nearest(kind: Kind, from: { x: number; y: number }, n = 6) {
  return [...mirror.nodes.values()].filter((q) => q.kind === kind && q.remaining > 0 && !q.hoard)
    .sort((a, b) => cheb(a.x, a.y, from.x, from.y) - cheb(b.x, b.y, from.x, from.y)).slice(0, n);
}
/** "6 squares north-east of your king". */
function dir(dx: number, dy: number) {
  if (Math.abs(dx) < 2 && Math.abs(dy) < 2) return 'right beside your king';
  const ns = dy < -1 ? 'north' : dy > 1 ? 'south' : '', ew = dx > 1 ? 'east' : dx < -1 ? 'west' : '';
  return `${Math.max(Math.abs(dx), Math.abs(dy))} squares ${ns && ew ? `${ns}-${ew}` : ns || ew} of your king`;
}

/** Fly to the nearest resources of a kind and ring them, so the player sees what they look like. */
function showResource(kind: Kind) {
  const k = homeKing(), ui = useUI.getState();
  if (!k || !scene) return;
  const ns = nearest(kind, k);
  if (!ns.length) { ui.toast(`No ${localName(kind, biomeAt(mirror.seed, k.x, k.y))} in view near your king: try exploring`, 'info'); return; }
  scene.flyTo(ns[0].x, ns[0].y, Math.max(scene.cam.zoom, 0.8));
  ns.forEach((q, i) => scene!.fx.schedule(500 + i * 140, () => scene!.fx.ripple(q.x, q.y, 0xf3d27a, 1.1)));
  ui.set({ questHelp: null });
}

/** Pick a building and put its outline on the best nearby spot (the player still confirms). */
function placeFor(type: BuildingType) {
  const k = homeKing(), ui = useUI.getState();
  if (!k || !input) return;
  const spec = BUILDINGS[type];
  // Near what it needs, within the king's reach.
  const anchor = spec.needs[0] ? nearest(spec.needs[0] as Kind, k, 1)[0] ?? k : k;
  let best: [number, number] | null = null;
  for (let r = 1; r <= REACH && !best; r++)
    for (let dy = -r; dy <= r && !best; dy++) for (let dx = -r; dx <= r && !best; dx++)
      if (Math.max(Math.abs(dx), Math.abs(dy)) === r && checkPlacement(type, anchor.x + dx, anchor.y + dy).ok) best = [anchor.x + dx, anchor.y + dy];
  ui.set({ questHelp: null, sheet: null, buildType: type });
  const at = best ?? [anchor.x + 2, anchor.y + 2];
  scene?.flyTo(at[0], at[1], Math.max(scene.cam.zoom, 0.8));
  input.updateGhost(at);
  if (!best) ui.toast('No good spot right here: drag the outline until it turns green', 'info');
}

function selectArmy() {
  const k = homeKing(), ui = useUI.getState();
  if (!k || !input || !scene) return;
  ui.select(input.armyOf(k.emperor ? mirror.myKings().find((x) => !x.emperor) ?? k : k));
  scene.flyTo(k.x, k.y, Math.max(scene.cam.zoom, 0.7));
  ui.set({ questHelp: null });
}
const fly = (at?: [number, number]) => () => { if (at && scene) { scene.flyTo(at[0], at[1], Math.max(scene.cam.zoom, 0.7)); useUI.getState().set({ questHelp: null }); } };

/** Which building makes a piece. */
const MAKER: Record<PieceKind, BuildingType> = { P: 'house', N: 'stable', B: 'temple', R: 'barracks', Q: 'palace', K: 'palace' };

function helpForStep(s: Step, target: [number, number] | undefined, phone: boolean): Help {
  const tap = phone ? 'Tap' : 'Click', k = homeKing();
  const biome = k ? biomeAt(mirror.seed, k.x, k.y) : 'meadow';
  const art = (kind: Kind) => nodeUrl(nodeArt(mirror.seed, kind, k?.x ?? 0, k?.y ?? 0, biome));
  const where = (kind: Kind) => { const n = k && nearest(kind, k, 1)[0]; return n ? ` The nearest are ${dir(n.x - k!.x, n.y - k!.y)}.` : ''; };
  const color = mirror.self?.color ?? '#888';
  const building = (type: BuildingType): Help => {
    const spec = BUILDINGS[type], need = spec.needs[0] as Kind | undefined;
    const cost = Object.entries(spec.cost).map(([r, n]) => `${n} ${r === 'tree' ? 'wood' : r === 'rock' ? 'stone' : r}`).join(' and ');
    return {
      title: `Build a ${type}`,
      steps: [
        `${tap} the hammer (bottom right) and choose ${type[0].toUpperCase() + type.slice(1)}.`,
        need ? `Put it within 3 squares of ${localName(need, biome)}: that's what it works.${where(need)}` : 'Put it near your king.',
        `The outline turns green on a good spot. ${phone ? 'Tap Build' : 'Click to build'}.`,
        `It costs ${cost}, taken from the ${Object.keys(spec.cost).map((r) => (r === 'tree' ? 'trees' : r === 'rock' ? 'rocks' : r === 'ore' ? 'ore' : 'crops')).join(' and ')} within 10 squares, and goes up on its own.`,
      ],
      look: [{ img: buildingUrl(type, color, mirror.self?.civ), label: type }, ...(need ? [{ img: art(need), label: localName(need, biome) }] : []), { img: art('tree'), label: 'wood: trees' }],
      actions: [...(need ? [{ label: `Show me the ${localName(need, biome)}`, run: () => showResource(need) }] : []), { label: `Place a ${type} for me`, run: () => placeFor(type) }],
    };
  };
  switch (s.verb) {
    case 'build': return building(s.type);
    case 'raise': {
      const b = MAKER[s.kind], name = PIECE_NAME[s.kind].toLowerCase();
      const have = mirror.myBuildings().some((x) => x.type === b && x.built >= 1);
      return {
        title: `Raise ${s.count > 1 ? `${s.count} ${name}s` : `a ${name}`}`,
        steps: [
          `A ${b} makes ${name}s on its own while one of your kings is within 10 squares.`,
          have ? `You have one: just wait, or tap the bubbles that rise over it to hurry it.` : `You don't have a ${b} yet: build one first.`,
          `It pauses when there's no room for more ${name}s (your population). ${tap} its bar to see why.`,
        ],
        look: [{ img: buildingUrl(b, color, mirror.self?.civ), label: b }, { img: pieceUrl(s.kind, 'light', color, false, mirror.self?.civ), label: name }],
        actions: have ? [{ label: `Show my ${b}`, run: fly(mirror.myBuildings().find((x) => x.type === b) && [mirror.myBuildings().find((x) => x.type === b)!.x, mirror.myBuildings().find((x) => x.type === b)!.y]) }] : [{ label: `Place a ${b} for me`, run: () => placeFor(b) }],
      };
    }
    case 'march': return {
      title: 'March your army',
      steps: [`${tap} one of your kings: its army is selected.`, phone ? `Tap a square far away (${s.dist}+ squares), then Move here. Or drag from a selected piece to the spot.` : `Right-click a square ${s.dist}+ squares away.`, 'Your troop marches in a column; elephants clear trees in the way.'],
      look: [{ img: pieceUrl('K', 'light', color, false, mirror.self?.civ), label: 'your king' }], actions: [{ label: 'Select my army', run: selectArmy }],
    };
    case 'hunt': case 'free': return {
      title: s.verb === 'free' ? 'Free the captives' : 'Hunt a camp of the wilds',
      steps: [
        s.verb === 'free' ? 'Raider camps hold captive pieces. Beat the camp and they come home to you.' : 'Wild camps (creatures in the wild) can be hunted. Beating one gives Renown and loot.',
        `${tap} one of your kings to select its army.`,
        phone ? "Tap the camp's king (the biggest creature), then Attack." : "Right-click the camp's king, then Attack.",
        'The battle is a real game of chess against the camp. Win it, and the camp scatters.',
      ],
      look: [], actions: [...(target ? [{ label: 'Show me the camp', run: fly(target) }] : []), { label: 'Select my army', run: selectArmy }],
    };
    case 'settle': return {
      title: 'Found a new settlement',
      steps: [`March a king ${s.minDist ?? 25}+ squares from your first town${s.eloAbove ? ', into richer land' : ''}.`, 'Build anything there near its king: that starts a settlement.', 'A king must stay near a settlement to keep it working.'],
      look: [], actions: [{ label: 'Select my army', run: selectArmy }],
    };
    case 'grow': return {
      title: 'Grow a settlement',
      steps: ['Buildings close together make a settlement: 3 make a village, 6 a town, 10 a city.', 'Build more in the same place, near one king.'],
      look: [], actions: [{ label: 'Place a house for me', run: () => placeFor('house') }],
    };
    case 'link': return { title: 'Link towns by trade', steps: ['Two of your towns close enough to trade send merchants between them on their own.', 'Keep a king near each town, and let the merchants walk.'], look: [], actions: [] };
    case 'discover': return { title: 'Find a rare land', steps: ['Rare lands look different: silver woods, fungus forests, crystal fields, ash plains, blossom groves, blighted land.', 'March a king into one.'], look: [], actions: [...(target ? [{ label: 'Show me one', run: fly(target) }] : []), { label: 'Select my army', run: selectArmy }] };
    case 'win': return {
      title: s.siege ? "Win a siege" : 'Beat a rival empire',
      steps: [`${tap} one of your kings to select its army.`, phone ? "Tap a rival player's king (or their building), then Attack." : "Right-click a rival player's king or building, then Attack.", s.siege ? 'Attacking a king in its town is a siege: win, and the town is yours.' : 'Win the chess battle.'],
      look: [], actions: [...(target ? [{ label: 'Show me a rival', run: fly(target) }] : []), { label: 'Select my army', run: selectArmy }],
    };
    case 'promote': return { title: 'Promote a pawn', steps: ['In any battle, walk a pawn to the far side of the board.', 'It fights as a queen for that battle.'], look: [], actions: [] };
    case 'crown': return building('palace');
    case 'scout': return {
      title: 'Scout the camp',
      steps: [`${tap} your king (the one without the gold crown) to select its army.`, phone ? 'Tap near the marked camp, then Move here.' : 'Right-click near the marked camp.', 'Your king only needs to come within 8 squares: close enough to see who camps there.', 'Your Emperor stays home, holding your house while the king is away.'],
      look: [{ img: pieceUrl('K', 'light', color, false, mirror.self?.civ), label: 'your king: send him' }, { img: pieceUrl('K', 'light', color, true, mirror.self?.civ), label: 'your Emperor: keep him home' }],
      actions: [...(target ? [{ label: 'Show me the camp', run: fly(target) }] : []), { label: 'Select my king', run: selectArmy }],
    };
    case 'clear': return {
      title: 'Clear land with elephants',
      steps: ['Select only war elephants (tap one, then + Add for more).', `${tap} Clear land, then drag over trees near your town.`, 'Each elephant fells trees one after another; more elephants work faster.'],
      look: [{ img: pieceUrl('R', 'light', color, false, mirror.self?.civ), label: 'war elephant' }, { img: art('tree'), label: 'trees' }],
      actions: [{ label: 'Show me trees', run: () => showResource('tree') }],
    };
    case 'pave': return {
      title: 'Pave a road with knights',
      steps: ['Select only knights (tap one, then + Add for more).', `${tap} Pave, then ${phone ? 'tap' : 'click'} where the road should go.`, 'They pave from where they stand; more knights pave faster. Troops march faster on paved roads.'],
      look: [{ img: pieceUrl('N', 'light', color, false, mirror.self?.civ), label: 'knight' }], actions: [],
    };
  }
}

function helpForSide(q: SideQuest, phone: boolean): Help {
  const tap = phone ? 'Tap' : 'Click';
  switch (q.kind) {
    case 'bounty': case 'rescue': case 'skirmish': return { ...helpForStep({ verb: q.kind === 'skirmish' ? 'win' : q.kind === 'rescue' ? 'free' : 'hunt', count: 1, line: '' } as Step, q.at, phone), title: q.line };
    case 'scout': return { title: 'Scout a strange land', steps: ['March any of your pieces to the marked place.'], look: [], actions: [{ label: 'Show me where', run: fly(q.at) }, { label: 'Select my army', run: selectArmy }] };
    case 'grow': return helpForStep({ verb: 'grow', tier: 2, line: '' }, q.at, phone);
    case 'shrine': return {
      title: 'Answer the shrine',
      steps: q.puzzle ? [`It's a chess puzzle: ${q.puzzle.fen.split(' ')[1] === 'w' ? 'White' : 'Black'} to play and mate in ${q.puzzle.n}.`, `${tap} Answer the riddle, then ${phone ? 'tap' : 'click'} a piece and its square.`, 'Only one first move works. A wrong move just resets the riddle.'] : ['Walk any one of your pieces onto the shrine (Show me finds it).', 'It then asks its riddle: a chess puzzle.'],
      look: [], actions: [{ label: 'Show me the shrine', run: fly(q.at) }, ...(!q.puzzle ? [{ label: 'Select my army', run: selectArmy }] : [])],
    };
    case 'opening': { const o = OPENINGS[q.challenge ?? '']; return { title: `Win with ${o?.name ?? 'the opening'}`, steps: ['Attack a camp or a rival: when you attack, you play White.', `Open with ${o?.moves.join(', then ')} (among your first ${o?.within} moves).`, 'Then win the game.'], look: [], actions: [{ label: 'Select my army', run: selectArmy }] }; }
    case 'feat': return { title: FEATS[q.challenge ?? ''] ?? 'A feat', steps: ['Win any battle (a camp or a rival) this way.', 'Pick a camp you can beat comfortably.'], look: [], actions: [{ label: 'Select my army', run: selectArmy }] };
    case 'pilgrimage': return {
      title: `A pilgrimage, ${(q.stage ?? 0) + 1} of 3`,
      steps: [
        ['Select only elephants (tap them, or use + Add), then Clear land, and drag over the grove.', 'Elephants fell every tree in it; it goes faster with more elephants.'],
        ['Walk a bishop into the clearing.', `Select only the bishop and ${tap} Raise altar, then Build. Keep the bishop beside it.`],
        ['Select only knights and tap Pave, then tap the altar.', 'They pave a road from where they stand; more knights pave faster.'],
      ][q.stage ?? 0],
      look: [], actions: [{ label: 'Show me where', run: fly(q.at) }],
    };
  }
}

/** The help sheet for the quest in the banner (or a side quest from the Chronicle). */
export function QuestHelp() {
  const ui = useUI();
  const c = mirror.self?.chronicle;
  if (!ui.questHelp || !c) return null;
  const phone = ui.layout === 'phone';
  const side = ui.questHelp.side != null ? c.sides.find((q) => q.id === ui.questHelp!.side) : undefined;
  const step = CHAPTERS[c.chapter - 1]?.steps[c.step];
  const h = side ? helpForSide(side, phone) : step ? helpForStep(step, c.target, phone) : null;
  // Why it works this way: the rules this quest teaches (lessons.ts).
  const why = (side ? SIDE_TEACH[side.kind] ?? [] : step?.teach ?? []).map((id) => LESSONS[id]).filter(Boolean);
  const close = () => ui.set({ questHelp: null });
  if (!h) return null;
  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="sheet confirm quest-help">
        <SheetGrab onClose={close} />
        <h3><Icon name="help" size={18} /> {h.title}</h3>
        <ol className="help-steps">{h.steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
        {h.look.length > 0 && (
          <div className="help-look">
            <span className="kicker">What to look for</span>
            <div className="looks">{h.look.map((l) => <figure key={l.label}><img src={l.img} alt="" /><figcaption>{l.label}</figcaption></figure>)}</div>
          </div>
        )}
        {why.length > 0 && (
          <div className="help-why">
            <span className="kicker">Why it works this way</span>
            {why.map((l) => <LessonView key={l.title} l={l} />)}
          </div>
        )}
        <div className="row-actions help-actions">
          {h.actions.map((a) => <button key={a.label} className="btn" onClick={a.run}>{a.label}</button>)}
          <button className="btn ghost" onClick={close}>Got it</button>
        </div>
      </div>
    </div>
  );
}
