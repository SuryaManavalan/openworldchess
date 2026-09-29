// One lesson (lessons.ts), in its three layers: the plain rule, then the fine print and the
// tactics to open when you want everything (campaign.md §5.7).
import type { Lesson } from '@owc/shared';

export function LessonView({ l, open }: { l: Lesson; open?: boolean }) {
  return (
    <div className="lesson">
      <p><b>{l.title}.</b> {l.text}</p>
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
