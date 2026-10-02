// UI state shared by the HUD (React) and the game view (Pixi). The world
// itself lives in the Mirror; React re-renders on `version` bumps.
import { create } from 'zustand';
import type { BuildingType, DecorType } from '@owc/shared';
import type { ClipData } from './game/clip.ts';

export interface AlertItem { id: number; kind: string; text: string; battleId?: number; at?: [number, number]; time: number }
export interface Toast { id: number; text: string; tone: 'info' | 'error' | 'good'; icon?: string }

/** A drawing tool (citybuilding.md §8). */
export type CityTool = { kind: 'decor'; type: DecorType } | { kind: 'pave'; style: number } | { kind: 'plant'; plant: 'wheat' | 'tree' };
export type Sheet = null | 'build' | 'details' | 'battles' | 'settings' | 'help' | 'shop' | 'chronicle' | 'troops' | 'controls' | 'find';
/** Which part of the Controls guide to open first. */
export let controlsOpen = 'map';
export const setControlsOpen = (s: string) => { controlsOpen = s; };

interface Settings {
  sound: boolean;
  music: number;
  effects: number;
  ambience: number;
  reduceMotion: boolean;
  watchMode: boolean;
}

interface UIState {
  status: 'connecting' | 'open' | 'closed';
  version: number;
  selection: number[];
  sheet: Sheet;
  buildType: BuildingType | null;
  /** A building being moved (citybuilding.md §3): the ghost places it instead of a new one. */
  moving: number | null;
  /** A drawing tool (citybuilding.md §8): streets, decorations or planting; null when none. */
  tool: CityTool | null;
  /** The eraser for the current tool. */
  toolErase: boolean;
  /** Street brush width in squares (1–3). */
  toolWidth: number;
  /** Squares in the stroke being drawn (previewed until it's lifted). */
  stroke: [number, number][] | null;
  /** The Build palette's tab. */
  buildTab: 'build' | 'streets' | 'adorn' | 'plant';
  ghost: { x: number; y: number; ok: boolean; reason: string; warn?: boolean } | null;
  alerts: AlertItem[];
  toasts: Toast[];
  battleFocus: number | null;
  pendingAttack: { pieceIds: number[]; targetKingId?: number; /** A camp, by its home: its band runs back to defend it (wilds.md §4). */ targetBuildingId?: number; name: string; siege: boolean; /** No king: a pawn commands (battle.md §9). */ raid?: boolean; /** Their troop has no king: one of its pawns will defend as commander. */ kingless?: boolean } | null;
  /** A finished chapter being celebrated (campaign.md §5.5). */
  ceremony: { n: number; name: string; opens: string; title?: string; coronation?: boolean } | null;
  /** A civilization to scroll to and highlight when the shop opens. */
  shopFocus: string | null;
  /** Something that isn't yours, being looked at (Inspect card). */
  inspect: { piece?: number; building?: number } | null;
  layout: 'phone' | 'desktop';
  settings: Settings;
  hint: string | null;
  /** The side quest shown in the top banner instead of the chapter (campaign.md §5.5); null: the chapter. */
  questFocus: number | null;
  /** The quest banner folded down to one line (remembered). */
  trackerMin: boolean;
  /** A shrine's riddle open on screen (the side quest's id). */
  riddle: number | null;
  /** Help for a quest open (campaign.md §5.5): the banner's step, or a side quest by id. */
  questHelp: { side?: number } | null;
  /** A work order waiting for its place (movement.md §9): where to pave to, or what to clear. */
  orderMode: 'pave' | 'clear' | 'haul' | 'haulTo' | null;
  /** A haul's deposit, chosen before its drop spot (citybuilding.md §6). */
  haulFrom: [number, number] | null;
  /** An area chosen for elephants to clear, waiting for confirmation. */
  pendingClear: { ids: number[]; a: [number, number]; b: [number, number] } | null;
  lassoMode: boolean;
  /**
   * A spot picked on the map first, pieces after (movement.md §7): the nearest piece is chosen,
   * the bar's + and − bring nearer ones in or let farther ones go, and Move here sends them.
   */
  rally: [number, number] | null;
  watching: boolean;
  /** A new version was deployed during a battle: reload when ready. */
  updateReady: boolean;
  needName: boolean;
  nameError: string | null;
  welcomeNote: string | null;
  googleEnabled: boolean;
  tiktokEnabled: boolean;
  /** A battle clip being shared (ShareTikTok). */
  share: ClipData | null;
  flags: { id: number; x: number; y: number; color: string }[];
  flagMode: boolean;
  addFlag: (x: number, y: number) => void;
  removeFlag: (id: number) => void;
  bump: () => void;
  set: (p: Partial<UIState>) => void;
  select: (ids: number[]) => void;
  toast: (text: string, tone?: Toast['tone'], icon?: string) => void;
  alert: (a: Omit<AlertItem, 'id' | 'time'>) => void;
  dismissAlert: (id: number) => void;
  setSettings: (p: Partial<Settings>) => void;
}

const loadSettings = (): Settings => {
  const d: Settings = { sound: true, music: 0.5, effects: 0.8, ambience: 0.6, reduceMotion: false, watchMode: true };
  try { return { ...d, ...JSON.parse(localStorage.getItem('owc.settings') ?? '{}') }; } catch { return d; }
};

let nextId = 1;

export const useUI = create<UIState>((set, get) => ({
  status: 'connecting',
  version: 0,
  selection: [],
  inspect: null,
  shopFocus: null,
  ceremony: null,
  sheet: null,
  buildType: null,
  moving: null,
  tool: null,
  toolErase: false,
  toolWidth: 1,
  stroke: null,
  buildTab: 'build',
  ghost: null,
  alerts: [],
  toasts: [],
  battleFocus: null,
  pendingAttack: null,
  layout: 'desktop',
  settings: loadSettings(),
  hint: null,
  trackerMin: (() => { try { return localStorage.getItem('owc.trackerMin') === '1'; } catch { return false; } })(),
  orderMode: null,
  haulFrom: null,
  riddle: null,
  questHelp: null,
  pendingClear: null,
  questFocus: (() => { try { const v = Number(localStorage.getItem('owc.questFocus')); return v > 0 ? v : null; } catch { return null; } })(),
  lassoMode: false,
  rally: null,
  watching: false,
  updateReady: false,
  needName: false,
  nameError: null,
  welcomeNote: null,
  googleEnabled: false,
  tiktokEnabled: false,
  share: null,
  flags: (() => { try { return JSON.parse(localStorage.getItem('owc.flags') ?? '[]'); } catch { return []; } })(),
  flagMode: false,
  addFlag: (x, y) => {
    const colors = ['#e0503a', '#e3b23c', '#4a7fd4', '#95b957', '#c7508f', '#46a6c9'];
    const flags = [...get().flags, { id: Date.now(), x: Math.round(x), y: Math.round(y), color: colors[get().flags.length % colors.length] }].slice(-12);
    try { localStorage.setItem('owc.flags', JSON.stringify(flags)); } catch { /* ignore */ }
    set({ flags, flagMode: false });
  },
  removeFlag: (id) => {
    const flags = get().flags.filter((f) => f.id !== id);
    try { localStorage.setItem('owc.flags', JSON.stringify(flags)); } catch { /* ignore */ }
    set({ flags });
  },
  bump: () => set({ version: get().version + 1 }),
  set: (p) => set(p),
  // Nothing selected: nothing to add to, and no order waiting for its place.
  select: (ids) => set(ids.length ? { selection: ids } : { selection: [], lassoMode: false, orderMode: null, rally: null }),
  toast: (text, tone = 'info', icon) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, text, tone, icon }].slice(-3) });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200);
  },
  alert: (a) => {
    const id = nextId++;
    set({ alerts: [{ ...a, id, time: Date.now() }, ...get().alerts].slice(0, 4) });
    // News fades sooner than danger: attacks and battles stay up until they matter.
    setTimeout(() => get().dismissAlert(id), a.kind === 'info' ? 9_000 : 20_000);
  },
  dismissAlert: (id) => set({ alerts: get().alerts.filter((x) => x.id !== id) }),
  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    try { localStorage.setItem('owc.settings', JSON.stringify(settings)); } catch { /* private mode */ }
    set({ settings });
  },
}));
