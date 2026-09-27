// The shop (docs/specs/cosmetics.md): webhook signatures, crediting Crowns once
// per payment, and spending them on civilizations.
import { afterAll, describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { Game, type PlayerRec } from '../src/game.ts';
import { buyCiv, creditPack, verifySignature } from '../src/shop.ts';

const game = new Game({ seed: 9, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
const sign = (payload: string, secret: string, t = Math.floor(Date.now() / 1000)) => `t=${t},v1=${createHmac('sha256', secret).update(`${t}.${payload}`).digest('hex')}`;

describe('shop', () => {
  it('accepts only correctly signed, fresh webhooks', () => {
    const body = '{"type":"checkout.session.completed"}', secret = 'whsec_test';
    expect(verifySignature(body, sign(body, secret), secret)).toBe(true);
    expect(verifySignature(body + ' ', sign(body, secret), secret)).toBe(false);
    expect(verifySignature(body, sign(body, 'whsec_other'), secret)).toBe(false);
    expect(verifySignature(body, sign(body, secret, Math.floor(Date.now() / 1000) - 3600), secret)).toBe(false);
    expect(verifySignature(body, 'garbage', secret)).toBe(false);
  });

  it('credits a pack once per payment, even if Stripe retries', () => {
    const p = game.join(undefined, 'Patron') as PlayerRec;
    expect(creditPack(game, p.id, 'crowns-500', 'cs_1')).toBe(true);
    expect(creditPack(game, p.id, 'crowns-500', 'cs_1')).toBe(true);
    expect(p.crowns).toBe(500);
    expect(creditPack(game, p.id, 'crowns-1100', 'cs_2')).toBe(true);
    expect(p.crowns).toBe(1600);
    expect(creditPack(game, p.id, 'nope', 'cs_3')).toBe(false);
    expect(creditPack(game, 'nobody', 'crowns-500', 'cs_4')).toBe(false);
  });

  it('spends Crowns on a civilization, equips it, and shows it to everyone', () => {
    const p = game.join(undefined, 'Collector') as PlayerRec;
    expect(buyCiv(game, p, 'roman')).toBe('Not enough Crowns');
    p.crowns = 600;
    expect(buyCiv(game, p, 'roman')).toBeNull();
    expect(p.crowns).toBe(100);
    expect(p.civs).toEqual(['roman']);
    expect(game.publicPlayer(p).civ).toBe('roman');
    expect(buyCiv(game, p, 'roman')).toBeNull(); // already owned: free, no double charge
    expect(p.crowns).toBe(100);
    expect(buyCiv(game, p, 'atlantean')).toBe('No such civilization');
  });
});
