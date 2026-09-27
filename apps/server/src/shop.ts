// The shop (docs/specs/cosmetics.md): Crowns, the shop currency, are bought in
// packs through Stripe Checkout; civilizations are bought with Crowns, in game,
// in one tap. No SDK: one REST call and one webhook signature check.
//
// Flow:
//   1. A signed-in player picks a Crown pack. The client sends `shop.checkout`
//      over its session, and we create a Checkout Session carrying the player id
//      and the pack. Checkout shows Apple Pay and Google Pay when they're enabled
//      in the Stripe dashboard: we don't restrict payment methods.
//   2. The player pays on Stripe's page and comes back to /?shop=success.
//   3. Stripe calls POST /stripe/webhook (checkout.session.completed). We verify
//      the signature, then credit the Crowns, once per session id. Retried
//      webhooks are ignored.
//   4. `civ.buy` spends Crowns on a civilization and puts it on.
//
// Env: STRIPE_SECRET_KEY (sk_live_… or sk_test_…), STRIPE_WEBHOOK_SECRET (whsec_…), PUBLIC_URL.
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { civById, packById } from '@owc/shared';
import type { Game, PlayerRec } from './game.ts';

const SECRET = process.env.STRIPE_SECRET_KEY ?? '';
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET ?? '';
const PUBLIC_URL = (process.env.PUBLIC_URL ?? 'http://localhost:8787').replace(/\/$/, '');
/** Webhooks older than this are rejected (replay protection). */
const TOLERANCE_S = 300;

export const shopOpen = () => !!(SECRET && WEBHOOK_SECRET);

/** Start a Stripe Checkout for a pack of Crowns. Returns the payment page URL, or an error message. */
export async function createCheckout(p: PlayerRec, packId: string): Promise<{ url: string } | { error: string }> {
  const pack = packById(packId);
  if (!pack) return { error: 'No such pack' };
  if (!shopOpen()) return { error: 'The shop opens soon' };
  // Purchases belong to an account: guests' empires fall, and with them anything bought.
  if (!p.googleSub) return { error: 'Sign in with Google first: your Crowns are saved to your account' };
  const form = new URLSearchParams({
    mode: 'payment',
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(pack.cents),
    'line_items[0][price_data][product_data][name]': `${pack.crowns.toLocaleString('en-US')} Crowns`,
    'line_items[0][price_data][product_data][description]': 'Crowns for the Open World Chess shop: cosmetic civilizations for your empire.',
    'line_items[0][price_data][product_data][images][0]': `${PUBLIC_URL}/img/crowns-${pack.crowns}.png`,
    client_reference_id: p.id,
    'metadata[playerId]': p.id,
    'metadata[pack]': pack.id,
    'payment_intent_data[metadata][playerId]': p.id,
    'payment_intent_data[metadata][pack]': pack.id,
    success_url: `${PUBLIC_URL}/?shop=success`,
    cancel_url: `${PUBLIC_URL}/?shop=cancel`,
  });
  if (p.email) form.set('customer_email', p.email);
  try {
    const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { authorization: `Bearer ${SECRET}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const body = (await r.json()) as { url?: string; error?: { message?: string } };
    if (!r.ok || !body.url) { console.error('stripe checkout failed', r.status, body.error?.message); return { error: 'Could not start checkout. Try again in a moment' }; }
    return { url: body.url };
  } catch (e) {
    console.error('stripe checkout error', e);
    return { error: 'Could not reach the payment service' };
  }
}

/** Credit a paid pack, once per Stripe session. */
export function creditPack(game: Game, playerId: string, packId: string, sessionId: string): boolean {
  const p = game.players.get(playerId);
  const pack = packById(packId);
  if (!p || !pack || !sessionId) return false;
  p.receipts ??= [];
  if (p.receipts.includes(sessionId)) return true; // a retried webhook
  p.receipts.push(sessionId);
  p.crowns = (p.crowns ?? 0) + pack.crowns;
  game.logEvent(p.id, 'shop', `Got ${pack.crowns} Crowns`);
  game.onAlert(p.id, { kind: 'info', text: `${pack.crowns.toLocaleString('en-US')} Crowns added. Thank you!` });
  game.onSelf(p.id);
  return true;
}

/** Spend Crowns on a civilization and put it on. Returns an error message or null. */
export function buyCiv(game: Game, p: PlayerRec, civId: string): string | null {
  const civ = civById(civId);
  if (!civ) return 'No such civilization';
  if (p.civs?.includes(civ.id)) return null;
  if ((p.crowns ?? 0) < civ.price) return 'Not enough Crowns';
  p.crowns = (p.crowns ?? 0) - civ.price;
  (p.civs ??= []).push(civ.id);
  p.civ = civ.id;
  game.logEvent(p.id, 'shop', `Unlocked the ${civ.name} civilization`);
  game.onPlayers();
  game.onSelf(p.id);
  return null;
}

/** Verify a Stripe-Signature header: `t=<unix>,v1=<hex hmac of "t.body">` (maybe several v1). */
export function verifySignature(payload: string, header: string, secret: string, now = Date.now()): boolean {
  const parts = header.split(',').map((kv) => kv.split('=') as [string, string]);
  const t = parts.find(([k]) => k === 't')?.[1];
  const sigs = parts.filter(([k]) => k === 'v1').map(([, v]) => v);
  if (!t || !sigs.length) return false;
  if (Math.abs(now / 1000 - Number(t)) > TOLERANCE_S) return false;
  const expected = createHmac('sha256', secret).update(`${t}.${payload}`).digest();
  return sigs.some((s) => {
    const got = Buffer.from(s, 'hex');
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}

/** HTTP routes: /shop/config and /stripe/webhook. Returns true if handled. */
export async function handleShop(game: Game, req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const path = (req.url ?? '').split('?')[0];
  if (path === '/shop/config') {
    res.setHeader('content-type', 'application/json');
    res.setHeader('cache-control', 'no-store');
    res.end(JSON.stringify({ open: shopOpen() }));
    return true;
  }
  if (path !== '/stripe/webhook') return false;
  if (req.method !== 'POST' || !WEBHOOK_SECRET) { res.statusCode = 404; res.end(); return true; }
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) { size += (c as Buffer).length; if (size > 1_000_000) { res.statusCode = 413; res.end(); return true; } chunks.push(c as Buffer); }
  const payload = Buffer.concat(chunks).toString('utf8');
  if (!verifySignature(payload, String(req.headers['stripe-signature'] ?? ''), WEBHOOK_SECRET)) {
    res.statusCode = 400; res.end('bad signature'); return true;
  }
  let event: { type?: string; data?: { object?: { id?: string; payment_status?: string; metadata?: Record<string, string>; client_reference_id?: string } } };
  try { event = JSON.parse(payload); } catch { res.statusCode = 400; res.end('bad json'); return true; }
  const obj = event.data?.object;
  if ((event.type === 'checkout.session.completed' || event.type === 'checkout.session.async_payment_succeeded') && obj?.payment_status === 'paid') {
    const playerId = obj.metadata?.playerId ?? obj.client_reference_id ?? '';
    const pack = obj.metadata?.pack ?? '';
    if (!creditPack(game, playerId, pack, obj.id ?? '')) console.error('stripe webhook: could not credit', pack, 'to', playerId, obj.id);
    else console.log(`shop: credited ${pack} to ${playerId} (${obj.id})`);
  }
  res.setHeader('content-type', 'application/json');
  res.end('{"received":true}');
  return true;
}
