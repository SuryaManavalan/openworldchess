// The Build palette (citybuilding.md §8): four tabs, Build (buildings), Streets, Adorn and
// Plant, in the phone's Build sheet and the desktop side panel. Picking a tool closes the
// sheet on phones and leaves one slim bar at the bottom (ToolBar); the map is the canvas.
import type { ReactNode } from 'react';
import { BUILDINGS, DECOR_BASE, DECOR_CAP, DECOR_PER_BUILDING, PLANT_FIELD_COST, isDecor, type DecorType } from '@owc/shared';
import { commands, mirror } from '../net.ts';
import { useUI, type CityTool } from '../store.ts';
import { decorUrl, nodeUrl } from '../game/textures.ts';
import { previewUrl } from '../game/cityart.ts';
import { Icon } from './Icon.tsx';
import { setControlsOpen } from '../store.ts';

const STYLES = [{ style: 1, name: 'Cobble' }, { style: 2, name: 'Flagstone' }, { style: 3, name: 'Earth' }];
/** The Adorn palette, in the order players reach for things. */
const ADORN: DecorType[] = ['wall', 'fence', 'hedge', 'flowerbed', 'lamp', 'bench', 'banner', 'planter', 'well', 'stall', 'statue', 'fountain', 'tavern'];
const LABEL: Record<string, string> = {
  wall: 'Wall', fence: 'Fence', hedge: 'Hedge', flowerbed: 'Flowerbed', lamp: 'Lamp', bench: 'Bench', banner: 'Banner', planter: 'Planter',
  well: 'Well', stall: 'Market stall', statue: 'Statue', fountain: 'Fountain', tavern: 'Tavern', bridge: 'Bridge',
};
const RES: Record<string, string> = { tree: 'wood', rock: 'stone' };
export const costOf = (t: DecorType) => Object.entries(BUILDINGS[t].cost).map(([k, v]) => `${v} ${RES[k] ?? k}`).join(', ');

export function toolName(t: CityTool): string {
  if (t.kind === 'pave') return `${STYLES.find((s) => s.style === t.style)?.name ?? 'Street'} street`;
  if (t.kind === 'plant') return t.plant === 'wheat' ? 'Field' : 'Sapling';
  return LABEL[t.type] ?? t.type;
}
function toolCost(t: CityTool): string {
  if (t.kind === 'pave') return 'Free in your towns · across water: a bridge, 10 wood a square';
  if (t.kind === 'plant') return t.plant === 'wheat' ? `${PLANT_FIELD_COST} wood a square · fills in 5 min` : 'Free · grows in 8 min';
  return `${costOf(t.type)}${BUILDINGS[t.type].line ? ' a square' : ''}`;
}

/** How many decorations you have, of how many you may (citybuilding.md §7). */
function budget() {
  const me = mirror.me;
  let decor = 0, real = 0;
  for (const b of mirror.buildings.values()) if (b.owner === me && b.type !== 'ruin') (isDecor(b.type) ? decor++ : real++);
  return { decor, max: Math.min(DECOR_CAP, DECOR_BASE + DECOR_PER_BUILDING * real) };
}

function pick(tool: CityTool, erase = false) {
  const ui = useUI.getState();
  ui.set({ tool, toolErase: erase, stroke: null, buildType: null, ghost: null, moving: null, selection: [], sheet: ui.layout === 'phone' ? null : ui.sheet });
}

function Card({ img, name, meta, on, onClick, wide }: { img: string; name: string; meta: string; on?: boolean; onClick: () => void; wide?: boolean }) {
  return (
    <button className={`build-card city-card ${on ? 'on' : ''} ${wide ? 'wide' : ''}`} onClick={onClick}>
      <img src={img} alt="" />
      <span className="bname">{name}</span>
      <span className="bmeta">{meta}</span>
    </button>
  );
}

function EraserCard({ tool, label }: { tool: CityTool; label: string }) {
  const ui = useUI();
  const on = ui.toolErase && ui.tool?.kind === tool.kind;
  return (
    <button className={`build-card city-card eraser ${on ? 'on' : ''}`} onClick={() => pick(tool, true)}>
      <span className="eraser-ico"><Icon name="close" size={22} stroke={2.6} /></span>
      <span className="bname">Eraser</span>
      <span className="bmeta">{label}</span>
    </button>
  );
}

export function BuildPalette({ buildings }: { buildings: ReactNode }) {
  const ui = useUI();
  const color = mirror.self?.color ?? '#d9534a';
  const tab = ui.buildTab;
  const tabs: { id: typeof tab; label: string }[] = [{ id: 'build', label: 'Build' }, { id: 'streets', label: 'Streets' }, { id: 'adorn', label: 'Adorn' }, { id: 'plant', label: 'Plant' }];
  const b = budget();
  const active = (t: CityTool) => !ui.toolErase && ui.tool != null && JSON.stringify(ui.tool) === JSON.stringify(t);
  return (
    <div className="build-palette">
      <div className="seg palette-tabs" role="tablist">
        {tabs.map((t) => <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => ui.set({ buildTab: t.id })}>{t.label}</button>)}
      </div>
      {tab === 'build' && buildings}
      {tab === 'streets' && (
        <>
          <p className="palette-note">Draw streets and squares in your towns: a wide street becomes a square. Across water, it's a bridge. Through your wall, a gate.</p>
          <div className="build-list city-grid">
            {STYLES.map((s) => <Card key={s.style} img={previewUrl(`pave:${s.style}`)} name={s.name} meta="Free in your towns" on={active({ kind: 'pave', style: s.style })} onClick={() => pick({ kind: 'pave', style: s.style })} />)}
            <EraserCard tool={{ kind: 'pave', style: 1 }} label="Lift streets and bridges" />
          </div>
        </>
      )}
      {tab === 'adorn' && (
        <>
          <p className="palette-note">Drag to draw walls, fences, hedges and flowerbeds; tap to place the rest. <b>{b.decor}/{b.max}</b> decorations (more as your towns grow).</p>
          <div className="build-list city-grid">
            {ADORN.map((t) => (
              <Card key={t} img={BUILDINGS[t].line ? previewUrl(t, color) : decorUrl(t, color)} name={LABEL[t]} meta={costOf(t) + (BUILDINGS[t].line ? ' a square' : '')}
                on={active({ kind: 'decor', type: t })} onClick={() => pick({ kind: 'decor', type: t })} />
            ))}
            <EraserCard tool={{ kind: 'decor', type: 'lamp' }} label="Remove decorations" />
          </div>
        </>
      )}
      {tab === 'plant' && (
        <>
          <p className="palette-note">Grow crops and woods where you want them: a field feeds houses and stables, a grove gives wood. Rock and ore can't be planted.</p>
          <div className="build-list city-grid">
            <Card img={nodeUrl('wheat')} name="Field" meta={`${PLANT_FIELD_COST} wood · fills in 5 min`} on={active({ kind: 'plant', plant: 'wheat' })} onClick={() => pick({ kind: 'plant', plant: 'wheat' })} />
            <Card img={nodeUrl('tree')} name="Sapling" meta="Free · grows in 8 min" on={active({ kind: 'plant', plant: 'tree' })} onClick={() => pick({ kind: 'plant', plant: 'tree' })} />
            <EraserCard tool={{ kind: 'plant', plant: 'tree' }} label="Pull up plantings" />
          </div>
        </>
      )}
    </div>
  );
}

/**
 * The bar while a drawing tool is in hand: what it is and costs, the street width, Erase, and
 * Done. Nothing else on screen (citybuilding.md §8).
 */
export function ToolBar() {
  const ui = useUI();
  const t = ui.tool;
  if (!t) return null;
  const phone = ui.layout === 'phone';
  const done = () => ui.set({ tool: null, toolErase: false, stroke: null });
  const img = t.kind === 'pave' ? previewUrl(`pave:${t.style}`) : t.kind === 'plant' ? nodeUrl(t.plant) : BUILDINGS[t.type].line ? previewUrl(t.type, mirror.self?.color) : decorUrl(t.type, mirror.self?.color ?? '#d9534a');
  return (
    <div className="action-row tool-bar">
      <div className="tool-top">
        <img className="tool-img" src={img} alt="" />
        <span className="tool-name">{ui.toolErase ? `Erasing ${t.kind === 'pave' ? 'streets' : t.kind === 'plant' ? 'plantings' : 'decorations'}` : toolName(t)}<small>{ui.toolErase ? 'Drag over what to remove' : toolCost(t)}</small></span>
        <button className="icon-btn tool-help" aria-label="Controls" title="Controls (?)" onClick={() => { setControlsOpen('tools'); ui.set({ sheet: 'controls' }); }}><Icon name="help" size={18} /></button>
        <button className="btn gold tool-done" onClick={done}>Done</button>
      </div>
      <div className="tool-actions">
        {t.kind === 'pave' && !ui.toolErase && (
          <div className="seg tool-width" aria-label="Street width">
            {[1, 2, 3].map((w) => <button key={w} className={ui.toolWidth === w ? 'on' : ''} onClick={() => ui.set({ toolWidth: w })}>{w === 1 ? 'Narrow' : w === 2 ? 'Wide' : 'Square'}</button>)}
          </div>
        )}
        <button className="btn ghost tool-undo" title={phone ? 'Undo your last stroke' : 'Undo your last stroke (Ctrl+Z)'} onClick={() => void commands.undoCity().then((e) => e && ui.toast(e, 'info'))}><Icon name="undo" size={15} /> Undo</button>
        <button className={`btn ghost tool-erase ${ui.toolErase ? 'on' : ''}`} title="Erase (X)" onClick={() => ui.set({ toolErase: !ui.toolErase, stroke: null })}><Icon name="close" size={15} stroke={2.6} /> Erase</button>
      </div>
      <span className="hint-text">{phone ? 'One finger draws · two fingers move the map' : 'Drag to draw · right-drag pans · X erases · Esc when done'}</span>
    </div>
  );
}
