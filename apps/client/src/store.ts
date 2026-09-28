// UI state shared by the HUD (React) and the game view (Pixi). The world
// itself lives in the Mirror; React re-renders on `version` bumps.
import { create } from 'zustand';
import type { BuildingType } from '@owc/shared';
import type { ClipData } from './game/clip.ts';

export interface AlertItem { id: number; kind: string; text: string; battleId?: number; at?: [number, number]; time: number }
export interface Toast { id: number; text: string; tone: 'info' | 'error' | 'good'; icon?: string }

export type Sheet = null | 'build' | 'details' | 'battles' | 'settings' | 'help' | 'shop' | 'chronicle';

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
  ghost: { x: number; y: number; ok: boolean; reason: string } | null;
  alerts: AlertItem[];
  toasts: Toast[];
  battleFocus: number | null;
  pendingAttack: { pieceIds: number[]; targetKingId: number; name: string; siege: boolean } | null;
  /** A finished chapter being celebrated (campaign.md §5.5). */
  ceremony: { n: number; name: string; opens: string; title?: string; coronation?: boolean } | null;
  /** A civilization to scroll to and highlight when the shop opens. */
  shopFocus: string | null;
  /** Something that isn't yours, being looked at (Inspect card). */
  inspect: { piece?: number; building?: number } | null;
  layout: 'phone' | 'desktop';
  settings: Settings;
  hint: string | null;
  lassoMode: boolean;
  watching: boolean;
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
  ghost: null,
  alerts: [],
  toasts: [],
  battleFocus: null,
  pendingAttack: null,
  layout: 'desktop',
  settings: loadSettings(),
  hint: null,
  lassoMode: false,
  watching: false,
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
  select: (ids) => set({ selection: ids }),
  toast: (text, tone = 'info', icon) => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, text, tone, icon }].slice(-3) });
    setTimeout(() => set({ toasts: get().toasts.filter((t) => t.id !== id) }), 3200);
  },
  alert: (a) => {
    const id = nextId++;
    set({ alerts: [{ ...a, id, time: Date.now() }, ...get().alerts].slice(0, 4) });
    setTimeout(() => get().dismissAlert(id), 20_000);
  },
  dismissAlert: (id) => set({ alerts: get().alerts.filter((x) => x.id !== id) }),
  setSettings: (p) => {
    const settings = { ...get().settings, ...p };
    try { localStorage.setItem('owc.settings', JSON.stringify(settings)); } catch { /* private mode */ }
    set({ settings });
  },
}));
