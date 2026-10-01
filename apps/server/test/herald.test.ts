// The Herald (docs/specs/discord.md): pulses only from 3 players, rate-limited; a daily digest of
// who finished which chapter; nothing about bots; player names can't ping or format.
import { afterAll, describe, expect, it } from 'vitest';
import { Game, type PlayerRec } from '../src/game.ts';
import { clean, type Post } from '../src/herald.ts';

const game = new Game({ seed: 2, speed: 1, wilds: false });
afterAll(() => game.battles.ai.stop());
const posts: Post[] = [];
game.herald.send = async (p) => { posts.push(p); };
const pdt = (h: number) => Date.parse(`2026-10-05T${String(h).padStart(2, '0')}:00:00-07:00`);

describe('the Herald', () => {
  it('never pulses below 3 players, then at most every 3 hours unless the crowd grows by 3', () => {
    game.now = pdt(9);
    game.herald.tick(pdt(9), 2);
    expect(posts.length).toBe(0);
    game.herald.tick(pdt(9) + 60_000, 3);
    expect(posts.at(-1)?.content).toMatch(/3 rulers/);
    game.herald.tick(pdt(10), 4);
    expect(posts.length).toBe(1);
    game.herald.tick(pdt(10) + 60_000, 6);
    expect(posts.at(-1)?.content).toMatch(/6 rulers/);
    game.herald.tick(pdt(13) + 120_000, 3);
    expect(posts.at(-1)?.content).toMatch(/3 rulers/);
  });

  it('collects the day: chapters by player (not bots), quests and battles, and posts one digest at 7 pm', () => {
    posts.length = 0;
    const a = game.join(undefined, 'Ada') as PlayerRec, b = game.join(undefined, 'Bea') as PlayerRec;
    const bot = game.join(undefined, 'Botty') as PlayerRec; bot.isBot = true;
    game.herald.chapter(a.id, 2); game.herald.chapter(a.id, 3); game.herald.chapter(b.id, 1); game.herald.chapter(bot.id, 4);
    game.herald.side(a.id, 'bounty'); game.herald.side(b.id, 'shrine'); game.herald.side(bot.id, 'bounty');
    game.herald.battle('field', a.id, b.id, false);
    game.herald.tick(pdt(18), 1);
    expect(posts.length).toBe(0);
    game.herald.tick(pdt(19) + 60_000, 1);
    const d = posts.at(-1)!.embeds![0].description!;
    expect(d).toMatch(/\*\*Ada\*\*: ch\. 2 \*First Hunt\*, ch\. 3 \*Village\*/);
    expect(d).toMatch(/\*\*Bea\*\*: ch\. 1/);
    expect(d).not.toMatch(/Botty/);
    expect(d).toMatch(/2 side quests\*\*/);
    expect(d).toMatch(/1 battle\*\* between empires/);
    game.herald.tick(pdt(20), 1);
    expect(posts.length).toBe(1); // once a day
  });

  it("player names can't mention everyone or break the formatting", () => {
    expect(clean('@everyone **x**')).toBe('everyone x');
    expect(clean('<@123> [link](http://x)')).toBe('<123 linkhttp://x');
    expect(clean('')).toBe('someone');
  });
});
