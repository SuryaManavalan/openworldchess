// One lesson (lessons.ts), in its three layers: the plain rule, then the fine print and the
// tactics to open when you want everything (campaign.md §5.7).
import type { Lesson } from '@owc/shared';
import { useUI } from '../store.ts';

/** Lessons are written for touch; on a computer they say click. */
const forDevice = (s: string, phone: boolean) => (phone ? s : s.replace(/\bTap\b/g, 'Click').replace(/\btap\b/g, 'click').replace(/\btapping\b/g, 'clicking'));

/** `bare` leaves the title out, for lists whose row already shows it. */
export function LessonView({ l, open, bare }: { l: Lesson; open?: boolean; bare?: boolean }) {
  const phone = useUI((s) => s.layout === 'phone');
  const d = (t: string) => forDevice(t, phone);
  return (
    <div className="lesson">
      <p>{!bare && <b>{l.title}. </b>}{d(l.text)}</p>
      <details open={open}>
        <summary>Fine print</summary>
        <ul>{l.fine.map((f, i) => <li key={i}>{d(f)}</li>)}</ul>
      </details>
      {l.tips?.length ? (
        <details>
          <summary>Tactics</summary>
          <ul>{l.tips.map((t, i) => <li key={i}>{d(t)}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}
