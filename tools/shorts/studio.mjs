// The studio's command line (docs/specs/studio.md): what the daily agent uses to talk to the game
// server. It needs OWC_STUDIO_KEY; the server holds the TikTok and voice credentials.
//
//   node tools/shorts/studio.mjs me                         who we post as, and what TikTok allows
//   node tools/shorts/studio.mjs log                        every video so far (day, hook, pillar, kind, status)
//   node tools/shorts/studio.mjs post <video.mp4> --caption "…" [--draft] [--private]
//                                                           posts it (public unless --private; --draft: to the
//                                                           account's TikTok drafts) and waits for TikTok's verdict
//   node tools/shorts/studio.mjs record <entry.json>        adds or updates a log entry ({ day, hook, pillar, kind,
//                                                           caption, publishId, status, notes, timeline, shots })
import { readFileSync } from 'node:fs';

const BASE = (process.env.OWC_BASE ?? 'https://openworldchess.com').replace(/\/$/, '');
const KEY = process.env.OWC_STUDIO_KEY ?? '';
if (!KEY) { console.error('OWC_STUDIO_KEY is not set'); process.exit(2); }
const call = async (path, init = {}) => {
  const r = await fetch(BASE + path, { ...init, headers: { 'x-studio-key': KEY, ...(init.headers ?? {}) } });
  const text = await r.text();
  let j; try { j = JSON.parse(text); } catch { j = { error: text.slice(0, 200) }; }
  return { ok: r.ok, status: r.status, ...j };
};
const [cmd, ...args] = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : undefined; };

if (cmd === 'me') {
  console.log(JSON.stringify(await call('/studio/tiktok/me'), null, 1));
} else if (cmd === 'log') {
  const r = await call('/studio/log');
  for (const e of r.log ?? []) console.log(`${e.day}\t${new Date(e.at).toISOString().slice(0, 16) + 'Z'}\t${e.kind ?? 'game'}\t${e.pillar ?? '-'}\t${e.status ?? '-'}\t${e.hook}`);
  console.log(`(${r.log?.length ?? 0} videos; ${r.postsToday ?? 0} posted in the last 24 h)`);
} else if (cmd === 'record') {
  console.log(JSON.stringify(await call('/studio/log', { method: 'POST', headers: { 'content-type': 'application/json' }, body: readFileSync(args[0]) })));
} else if (cmd === 'post') {
  const file = args[0], caption = opt('caption') ?? '';
  if (!file || !caption) { console.error('post <video.mp4> --caption "…"'); process.exit(2); }
  const me = await call('/studio/tiktok/me');
  if (!me.connected) { console.error('The studio account is not connected to TikTok:', me.error ?? me.blocked ?? ''); process.exit(1); }
  if (me.blocked) { console.error('TikTok will not take posts right now:', me.blocked); process.exit(1); }
  // Until TikTok approves Direct Post for the app, videos can only go to the account's drafts.
  const draft = flag('draft') || me.canPublish === false;
  if (me.canPublish === false && !flag('draft')) console.log('Direct Post is not approved for the app yet: sending to drafts');
  // Public if the account allows it; TikTok lists what it does.
  const privacy = flag('private') ? 'SELF_ONLY' : (me.privacy ?? []).includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : (me.privacy ?? [])[0];
  const meta = { title: caption, privacy, comment: !me.commentOff, duet: !me.duetOff, stitch: !me.stitchOff, yourBrand: true, branded: false };
  const video = readFileSync(file);
  console.log(`posting ${file} (${(video.length / 1e6).toFixed(1)} MB) as @${me.username ?? me.name}, ${draft ? 'to drafts' : privacy}`);
  const r = await call(`/studio/tiktok/post?mode=${draft ? 'draft' : 'direct'}`, { method: 'POST', headers: { 'content-type': 'video/mp4', 'x-owc-meta': encodeURIComponent(JSON.stringify(meta)) }, body: video });
  if (!r.publishId) { console.error('refused:', r.error ?? r.status); process.exit(1); }
  // TikTok processes the upload for a while; wait for its verdict (up to 5 minutes).
  let status = 'PROCESSING_UPLOAD', fail;
  for (let i = 0; i < 60 && /PROCESSING|UNKNOWN/.test(status); i++) {
    await new Promise((ok) => setTimeout(ok, 5000));
    const s = await call(`/studio/tiktok/status?id=${encodeURIComponent(r.publishId)}`);
    status = s.status ?? 'UNKNOWN'; fail = s.fail;
  }
  console.log(JSON.stringify({ publishId: r.publishId, status, fail, privacy: draft ? 'draft' : privacy }));
  if (status === 'FAILED') process.exit(1);
} else {
  console.error('commands: me | log | post <video.mp4> --caption "…" [--draft] [--private] | record <entry.json>');
  process.exit(2);
}
