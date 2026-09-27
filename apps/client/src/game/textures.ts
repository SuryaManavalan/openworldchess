// Art → GPU textures. Every asset is code-generated SVG (art.md §4); here we
// rasterize it once per (asset, side, color) and cache it. Player colors are
// baked per player, which keeps any color possible (art.md §2).
import { Texture } from 'pixi.js';
import * as piecesArt from 'owc-art/pieces';
import * as worldArt from 'owc-art/world';
import * as decorArt from 'owc-art/decor';
import * as creatureArt from 'owc-art/creatures';
import * as natureArt from 'owc-art/nature';
import * as campsArt from 'owc-art/camps';
import { FACTIONS, type PieceKind } from '@owc/shared';

type ArtFn = (o?: { side?: string; team?: string; emperor?: boolean }) => string;
const PIECES = piecesArt.PIECES as unknown as Record<string, ArtFn>;
const BUILDINGS = worldArt.BUILDINGS as unknown as Record<string, ArtFn>;
const RESOURCES = worldArt.RESOURCES as unknown as Record<string, ArtFn>;
const DECOR = decorArt.DECOR as unknown as Record<string, (o?: { team?: string; awning?: string }) => string>;
type Art0 = Record<string, () => string>;
const NATURE: Record<string, Art0> = { tree: natureArt.TREES as unknown as Art0, rock: natureArt.ROCKS as unknown as Art0, ore: natureArt.ORES as unknown as Art0, crop: natureArt.CROPS as unknown as Art0 };
const creature = creatureArt.creature as unknown as (f: unknown, kind: PieceKind) => string;
const campArt = campsArt.campArt as unknown as (name: string, f: unknown) => string;
const ART_NAME: Record<PieceKind, string> = { K: 'king', Q: 'queen', R: 'elephant', B: 'bishop', N: 'knight', P: 'pawn' };
export const RES = 128; // raster size per 100x100 art unit

const cache = new Map<string, Texture>();
const pending = new Map<string, Promise<Texture>>();

function svgToTexture(markup: string, size = RES): Promise<Texture> {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}">${markup}</svg>`;
  const img = new Image();
  img.decoding = 'async';
  img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  return img.decode().then(() => {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    c.getContext('2d')!.drawImage(img, 0, 0, size, size);
    return Texture.from(c);
  });
}

/** Returns the texture if ready (else starts loading and returns null). */
function get(key: string, make: () => string, size = RES, onReady?: () => void): Texture | null {
  const t = cache.get(key);
  if (t) return t;
  if (!pending.has(key)) {
    const p = svgToTexture(make(), size).then((tex) => { cache.set(key, tex); pending.delete(key); return tex; });
    pending.set(key, p);
  }
  if (onReady) pending.get(key)!.then(onReady);
  return null;
}

export function pieceTexture(kind: PieceKind, side: 'light' | 'dark', team: string, emperor = false, onReady?: () => void) {
  return get(`p:${kind}:${side}:${team}:${emperor}`, () =>
    kind === 'K' ? PIECES.king({ side, team, emperor }) : PIECES[ART_NAME[kind]]({ side, team }), RES, onReady);
}

export function buildingTexture(type: string, team: string, onReady?: () => void) {
  if (type === 'ruin') return get('b:ruin', ruinArt, 192, onReady);
  return get(`b:${type}:${team}`, () => BUILDINGS[type]({ team }), 192, onReady);
}

const NODE_ART: Record<string, string> = { tree: 'tree', pine: 'pine', rock: 'rock', ore: 'goldOre', wheat: 'wheat' };
/** A resource node's art: a plain kind ("tree") or a biome variant ("tree:cherry", "ore:ruby"). */
export function nodeTexture(kind: string, onReady?: () => void) {
  const [group, name] = kind.split(':');
  const make = name ? () => (NATURE[group]?.[name] ?? RESOURCES.rock)() : () => RESOURCES[NODE_ART[kind]]();
  return get(`n:${kind}`, make, 96, onReady);
}

/** A creature of the wilds (docs/specs/wilds.md): the faction's art for a chess role. */
export function creatureTexture(faction: string, kind: PieceKind, onReady?: () => void) {
  return get(`c:${faction}:${kind}`, () => creature(FACTIONS[faction], kind), RES, onReady);
}

export function creatureUrl(faction: string, kind: PieceKind): string {
  const k = `c:${faction}:${kind}`;
  let u = urlCache.get(k);
  if (!u) {
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${creature(FACTIONS[faction], kind)}</svg>`);
    urlCache.set(k, u);
  }
  return u;
}

/** A wild camp's structure, tinted with its faction's colors. */
export function campTexture(art: string, faction: string, onReady?: () => void) {
  return get(`camp:${art}:${faction}`, () => campArt(art, FACTIONS[faction]), 192, onReady);
}

export function stumpTexture(onReady?: () => void) {
  return get('n:stump', () =>
    `<ellipse cx="50" cy="86" rx="16" ry="3" fill="#000" opacity=".18"/><path d="M40 86 V74 Q50 70 60 74 V86 Z" fill="#a06e44" stroke="#2b2622" stroke-width="3.2" stroke-linejoin="round"/><ellipse cx="50" cy="74" rx="10" ry="3" fill="#d9b88a" stroke="#2b2622" stroke-width="2.4"/><path d="M58 70 q6 -8 12 -6" stroke="#6fae4a" stroke-width="3" fill="none" stroke-linecap="round"/>`, 96, onReady);
}

function ruinArt() {
  return `<ellipse cx="50" cy="88" rx="38" ry="6" fill="#000" opacity=".18"/>
  <path d="M14 87 V62 L22 58 V70 L30 66 V87 Z" fill="#9d9689" stroke="#2b2622" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M60 87 V54 L68 50 L70 60 L78 58 V87 Z" fill="#bdb7ab" stroke="#2b2622" stroke-width="3.2" stroke-linejoin="round"/>
  <path d="M34 87 L38 78 L48 80 L52 87 Z" fill="#8f8a82" stroke="#2b2622" stroke-width="3" stroke-linejoin="round"/>
  <path d="M62 66 q4 -6 8 -2 M18 70 q3 -5 7 -2" stroke="#548f36" stroke-width="3" fill="none" stroke-linecap="round"/>`;
}

/** Piece art as a data URL, for the React battle board. */
const urlCache = new Map<string, string>();
export function pieceUrl(kind: PieceKind, side: 'light' | 'dark', team: string, emperor = false): string {
  const k = `${kind}:${side}:${team}:${emperor}`;
  let u = urlCache.get(k);
  if (!u) {
    const markup = kind === 'K' ? PIECES.king({ side, team, emperor }) : PIECES[ART_NAME[kind]]({ side, team });
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${markup}</svg>`);
    urlCache.set(k, u);
  }
  return u;
}

export function buildingUrl(type: string, team: string): string {
  const k = `b:${type}:${team}`;
  let u = urlCache.get(k);
  if (!u) {
    u = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${BUILDINGS[type]({ team })}</svg>`);
    urlCache.set(k, u);
  }
  return u;
}

export function decorTexture(kind: string, color = '#d9534a', variant?: string, onReady?: () => void) {
  return get(`d:${kind}:${color}:${variant ?? ''}`, () => DECOR[kind]({ team: color, awning: variant ?? color }), 96, onReady);
}
