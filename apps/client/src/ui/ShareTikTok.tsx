// Share a battle clip to TikTok (docs/specs/tiktok.md). The clip renders in the
// browser; the post form follows TikTok's Content Posting UX rules: the creator
// is shown, privacy has no default, interactions start off (and stay off where
// the creator disabled them), commercial content is disclosed, and the player
// agrees to TikTok's terms on the button itself.
import { useEffect, useRef, useState } from 'react';
import { useUI } from '../store.ts';
import { recordClip, type ClipData, type Recording } from '../game/clip.ts';
import { Icon } from './Icon.tsx';
import { SheetGrab } from './SheetGrab.tsx';

const get = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const CLIP_KEY = 'owc.clip';

/** The TikTok mark, for buttons that sign in with or post to TikTok. */
export function TikTokMark({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
      <path d="M12.53.02C13.84 0 15.14.01 16.44 0c.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
    </svg>
  );
}

/** Start TikTok sign-in (or connecting it to this empire), landing back on `then`. */
export function tiktokStart(then = '') {
  const q = new URLSearchParams({ token: get('owc.token') ?? '' });
  if (then) q.set('then', then);
  return `/auth/tiktok/start?${q}`;
}

/** Keep the clip across the TikTok sign-in round trip. */
export function stashClip(d: ClipData) { try { sessionStorage.setItem(CLIP_KEY, JSON.stringify(d)); } catch { /* private mode */ } }
export function unstashClip(): ClipData | null { try { const s = sessionStorage.getItem(CLIP_KEY); sessionStorage.removeItem(CLIP_KEY); return s ? JSON.parse(s) : null; } catch { return null; } }

type Me = {
  enabled: boolean; connected?: boolean; name?: string; username?: string; avatar?: string; blocked?: string;
  privacy?: string[]; commentOff?: boolean; duetOff?: boolean; stitchOff?: boolean; maxSec?: number;
};
const PRIVACY: Record<string, string> = { PUBLIC_TO_EVERYONE: 'Everyone', MUTUAL_FOLLOW_FRIENDS: 'Friends', FOLLOWER_OF_CREATOR: 'Followers', SELF_ONLY: 'Only me' };
const call = (path: string, init: RequestInit = {}) => fetch(path, { ...init, headers: { 'x-owc-token': get('owc.token') ?? '', ...(init.headers ?? {}) } });

export function ShareTikTok() {
  const ui = useUI();
  const d = ui.share;
  const canvas = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [rec, setRec] = useState<Recording | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [caption, setCaption] = useState('');
  const [privacy, setPrivacy] = useState('');
  const [allow, setAllow] = useState({ comment: false, duet: false, stitch: false });
  const [disclose, setDisclose] = useState(false);
  const [brand, setBrand] = useState({ yours: false, branded: false });
  const [sending, setSending] = useState<null | 'direct' | 'draft'>(null);
  const [sent, setSent] = useState<{ id: string; mode: 'direct' | 'draft'; status: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Render the clip as soon as the sheet opens.
  useEffect(() => {
    if (!d || !canvas.current) return;
    let live = true;
    setRec(null); setSent(null); setError(null); setProgress(0);
    recordClip(d, canvas.current, (f) => live && setProgress(f)).then((r) => { if (!live) return; setRec(r); setUrl(URL.createObjectURL(r.blob)); })
      .catch(() => live && setError('This browser could not record the clip.'));
    return () => { live = false; };
  }, [d]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  const loadMe = () => call('/tiktok/me').then((r) => r.json()).then(setMe).catch(() => setMe({ enabled: false }));
  useEffect(() => { if (d) loadMe(); }, [d]);

  // Follow the post until TikTok has it (webhooks also tell the player in game).
  useEffect(() => {
    if (!sent || /COMPLETE|INBOX|FAILED/.test(sent.status)) return;
    const t = setTimeout(() => call(`/tiktok/status?id=${encodeURIComponent(sent.id)}`).then((r) => r.json()).then((s) => setSent({ ...sent, status: s.status ?? sent.status })).catch(() => {}), 3000);
    return () => clearTimeout(t);
  }, [sent]);

  if (!d) return null;
  const close = () => ui.set({ share: null });
  const secs = rec ? Math.round(rec.ms / 1000) : 0;
  const tooLong = !!(me?.maxSec && secs > me.maxSec);
  const brandNeeded = disclose && !brand.yours && !brand.branded;
  const canPost = !!rec && !!privacy && !brandNeeded && !tooLong && !sending && !me?.blocked;

  const post = async (mode: 'direct' | 'draft') => {
    if (!rec) return;
    setSending(mode); setError(null);
    const meta = { title: caption, privacy, comment: allow.comment, duet: allow.duet, stitch: allow.stitch, yourBrand: disclose && brand.yours, branded: disclose && brand.branded };
    try {
      const r = await call(`/tiktok/post?mode=${mode}`, { method: 'POST', body: rec.blob, headers: { 'content-type': rec.type, 'x-owc-meta': encodeURIComponent(JSON.stringify(meta)) } });
      const j = await r.json();
      if (!r.ok || !j.publishId) throw new Error(j.error || 'TikTok did not accept the clip');
      setSent({ id: j.publishId, mode, status: 'PROCESSING_UPLOAD' });
    } catch (e) { setError((e as Error).message); }
    setSending(null);
  };

  const label = (t: string) => ({ yours: 'Promotional content', branded: 'Paid partnership' } as Record<string, string>)[t];
  const statusText = (s: string) =>
    s === 'PUBLISH_COMPLETE' ? 'Posted. It may take a few minutes to appear on your profile.'
      : s === 'SEND_TO_USER_INBOX' ? 'Sent to your TikTok inbox. Open TikTok to finish editing and post it.'
        : s === 'FAILED' ? 'TikTok could not process the clip. Try again.'
          : 'Sent to TikTok. It may take a few minutes to process.';

  return (
    <div className="sheet-backdrop" onClick={(e) => e.target === e.currentTarget && !sending && close()}>
      <div className="sheet share-sheet">
        <SheetGrab onClose={() => { if (!sending) close(); }} />
        <div className="share-head">
          <h3>Share this battle</h3>
          <button className="icon-btn" aria-label="Close" onClick={close} disabled={!!sending}><Icon name="close" size={18} /></button>
        </div>
        <div className="share-body">
          <div className="share-preview">
            <canvas ref={canvas} hidden={!!rec} />
            {rec && url && <video src={url} controls autoPlay loop playsInline muted />}
            {!rec && !error && <div className="share-progress"><span style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
            {!rec && !error && <p className="muted small">Rendering your clip… {Math.round(progress * 100)}%</p>}
          </div>
          <div className="share-form">
            {me && !me.enabled && <p className="muted">Sharing to TikTok isn't available yet.</p>}
            {me?.enabled && !me.connected && <>
              <p>Post a replay of this battle to your TikTok, or save it to your drafts.</p>
              <a className="btn big tiktok" href={tiktokStart('share')} onClick={() => stashClip(d)}><TikTokMark /> Connect TikTok</a>
            </>}
            {me?.connected && !sent && <>
              <div className="creator">
                {me.avatar ? <img src={me.avatar} alt="" /> : <span className="creator-dot"><TikTokMark size={16} /></span>}
                <div><div className="muted small">Posting to TikTok as</div><b>{me.name}</b>{me.username && <span className="muted"> @{me.username}</span>}</div>
              </div>
              {me.blocked && <p className="field-error">{me.blocked}</p>}
              <label className="field">Caption
                <textarea value={caption} maxLength={2200} rows={3} placeholder="Say something about this battle" onChange={(e) => setCaption(e.target.value)} />
              </label>
              <label className="field">Who can see this video
                <select value={privacy} onChange={(e) => setPrivacy(e.target.value)}>
                  <option value="" disabled>Choose…</option>
                  {(me.privacy ?? []).map((p) => <option key={p} value={p} disabled={p === 'SELF_ONLY' && disclose && brand.branded}>{PRIVACY[p] ?? p}{p === 'SELF_ONLY' && disclose && brand.branded ? ' (not allowed for branded content)' : ''}</option>)}
                </select>
              </label>
              <div className="field">Allow users to
                <div className="checks">
                  {(['comment', 'duet', 'stitch'] as const).map((k) => {
                    const off = k === 'comment' ? me.commentOff : k === 'duet' ? me.duetOff : me.stitchOff;
                    return <label key={k} className={off ? 'off' : ''}><input type="checkbox" disabled={off} checked={!off && allow[k]} onChange={(e) => setAllow({ ...allow, [k]: e.target.checked })} /> {k[0].toUpperCase() + k.slice(1)}</label>;
                  })}
                </div>
              </div>
              <div className="field">
                <label className="toggle"><input type="checkbox" checked={disclose} onChange={(e) => { setDisclose(e.target.checked); if (!e.target.checked) setBrand({ yours: false, branded: false }); }} /> Disclose video content</label>
                {disclose && <>
                  <p className="muted small">Turn on to disclose that this video promotes goods or services in exchange for something of value. Your video could promote yourself, a third party, or both.</p>
                  <div className="checks col">
                    <label><input type="checkbox" checked={brand.yours} onChange={(e) => setBrand({ ...brand, yours: e.target.checked })} /> Your brand <span className="muted small">You are promoting yourself or your own business.</span></label>
                    <label><input type="checkbox" checked={brand.branded} onChange={(e) => { setBrand({ ...brand, branded: e.target.checked }); if (e.target.checked && privacy === 'SELF_ONLY') setPrivacy(''); }} /> Branded content <span className="muted small">You are promoting another brand or a third party.</span></label>
                  </div>
                  {brandNeeded
                    ? <p className="field-error">You need to indicate if your content promotes yourself, a third party, or both.</p>
                    : <p className="muted small">Your video will be labeled "{label(brand.branded ? 'branded' : 'yours')}".</p>}
                </>}
              </div>
              {tooLong && <p className="field-error">This clip is {secs}s; your account can post up to {me.maxSec}s.</p>}
              <p className="muted small consent">
                By posting, you agree to TikTok's {disclose && brand.branded && <><a href="https://www.tiktok.com/legal/page/global/bc-policy/en" target="_blank" rel="noopener">Branded Content Policy</a> and </>}
                <a href="https://www.tiktok.com/legal/page/global/music-usage-confirmation/en" target="_blank" rel="noopener">Music Usage Confirmation</a>.
              </p>
              {error && <p className="field-error">{error}</p>}
              <button className="btn big tiktok" disabled={!canPost} onClick={() => post('direct')}><TikTokMark /> {sending === 'direct' ? 'Posting…' : 'Post to TikTok'}</button>
              <button className="btn ghost" style={{ width: '100%', marginTop: 8 }} disabled={!rec || !!sending || tooLong} onClick={() => post('draft')}>{sending === 'draft' ? 'Sending…' : 'Save to TikTok drafts instead'}</button>
            </>}
            {sent && <div className="share-done">
              <Icon name={sent.status === 'FAILED' ? 'alert' : 'check'} size={28} />
              <p>{statusText(sent.status)}</p>
              <button className="btn" onClick={close}>Back to the world</button>
            </div>}
            {rec && url && !sent && <a className="btn ghost small save-video" href={url} download={`battle-${d.battleId}.${rec.type.includes('mp4') ? 'mp4' : 'webm'}`}>Save video to this device</a>}
          </div>
        </div>
      </div>
    </div>
  );
}
