// Bot runner (bots.md §3, §7): hosts many bots, keeps their identities across
// restarts, and runs the population manager. Bots use only the public protocol.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { ChessAI } from '@owc/engine';
import { Bot, type Persona, type Style } from './brain.ts';

const SERVER_URL = process.env.SERVER ?? 'ws://localhost:8787/play';
const TARGET = Number(process.env.BOTS ?? 12);
const FILE = process.env.BOT_FILE ?? new URL('../../../data/bots.json', import.meta.url).pathname;

const A = ['iron', 'quiet', 'grey', 'amber', 'north', 'stone', 'ash', 'river', 'oak', 'frost', 'ember', 'moor', 'silent', 'lucky', 'slow', 'deep', 'tiny', 'old'];
const B = ['rook', 'gambit', 'pawnstorm', 'bishop', 'knight', 'tempo', 'castle', 'zugzwang', 'endgame', 'sicilian', 'caro', 'fork', 'pin', 'blunder', 'queen'];
const STYLES: Style[] = ['builder', 'raider', 'expander', 'turtle', 'opportunist'];

function newPersona(): Persona {
  // Handles in the style of real online names (bots.md §4).
  const cap = Math.random() < 0.5;
  const a = A[Math.floor(Math.random() * A.length)], b = B[Math.floor(Math.random() * B.length)];
  const name = (cap ? a[0].toUpperCase() + a.slice(1) + b[0].toUpperCase() + b.slice(1) : a + '_' + b) + (Math.random() < 0.7 ? Math.floor(Math.random() * 999) : '');
  // Strength: roughly normal around 1150, clamped 600–2400.
  const g = Math.sqrt(-2 * Math.log(Math.random() || 1e-9)) * Math.cos(2 * Math.PI * Math.random());
  return { name: name.slice(0, 20), strength: Math.max(600, Math.min(2400, Math.round(1150 + g * 300))), style: STYLES[Math.floor(Math.random() * STYLES.length)], risk: Math.random() };
}

const personas: Persona[] = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : [];
while (personas.length < TARGET) personas.push(newPersona());
const save = () => { mkdirSync(dirname(FILE), { recursive: true }); writeFileSync(FILE, JSON.stringify(personas, null, 1)); };
save();

const ai = new ChessAI(Number(process.env.ENGINES ?? 2));
const bots: Bot[] = [];

// Bring bots online gradually, like players logging in.
personas.slice(0, TARGET).forEach((p, i) => setTimeout(() => {
  const bot = new Bot(SERVER_URL, p, ai);
  bot.onToken = () => save();
  bots.push(bot);
  console.log(`bot online: ${p.name} (${p.style}, ~${p.strength})`);
}, i * 1500 + Math.random() * 1000));

const shutdown = () => { for (const b of bots) b.stop(); ai.stop(); save(); process.exit(0); };
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
