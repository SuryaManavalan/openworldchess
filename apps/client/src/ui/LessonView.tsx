// One lesson (lessons.ts), in its three layers: the plain rule, then the fine print and the
// tactics to open when you want everything (campaign.md §5.7).
import type { Lesson } from '@owc/shared';

/** `bare` leaves the title out, for lists whose row already shows it. */
export function LessonView({ l, open, bare }: { l: Lesson; open?: boolean; bare?: boolean }) {
  return (
    <div className="lesson">
      <p>{!bare && <b>{l.title}. </b>}{l.text}</p>
      <details open={open}>
        <summary>Fine print</summary>
        <ul>{l.fine.map((f, i) => <li key={i}>{f}</li>)}</ul>
      </details>
      {l.tips?.length ? (
        <details>
          <summary>Tactics</summary>
          <ul>{l.tips.map((t, i) => <li key={i}>{t}</li>)}</ul>
        </details>
      ) : null}
    </div>
  );
}
