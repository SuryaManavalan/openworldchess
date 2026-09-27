// UI state shared by the HUD (React) and the game view (Pixi). The world
// itself lives in the Mirror; React re-renders on `version` bumps.
import { create } from 'zustand';
import type { BuildingType } from '@owc/shared';

export interface AlertItem { id: number; kind: string; text: string; battleId?: number; at?: [number, number]; time: number }
export interface Toast { id: number; text: string; tone: 'info' | 'error' | 'good' }

export type Sheet = null | 'build' | 'details' | 'battles' | 'settings' | 'help';

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
  layout: 'phone' | 'desktop';
  settings: Settings;
  hint: string | null;
  lassoMode: boolean;
  watching: boolean;
  needName: boolean;
  nameError: string | null;
  welcomeNote: string | null;
  googleEnabled: boolean;
  bump: () => void;
  set: (p: Partial<UIState>) => void;
  select: (ids: number[]) => void;
  toast: (text: string, tone?: Toast['tone']) => void;
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
  bump: () => set({ version: get().version + 1 }),
  set: (p) => set(p),
  select: (ids) => set({ selection: ids }),
  toast: (text, tone = 'info') => {
    const id = nextId++;
    set({ toasts: [...get().toasts, { id, text, tone }].slice(-3) });
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
