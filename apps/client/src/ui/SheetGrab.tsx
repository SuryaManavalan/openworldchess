// A bottom sheet's handle (ux.md §3): easy to hit, and it follows a swipe down.
import { useRef } from 'react';

/**
 * The handle on top of a bottom sheet: a full-width strip, big enough for a thumb. Tap it or
 * swipe it down to close; the sheet follows your finger while you drag.
 */
export function SheetGrab({ onClose }: { onClose: () => void }) {
  const start = useRef<{ y: number; id: number } | null>(null);
  const sheetOf = (el: HTMLElement) => el.closest('.sheet') as HTMLElement | null;
  return (
    <div className="sheet-grab" role="button" aria-label="Close"
      onPointerDown={(e) => { start.current = { y: e.clientY, id: e.pointerId }; e.currentTarget.setPointerCapture(e.pointerId); }}
      onPointerMove={(e) => { if (!start.current) return; const dy = Math.max(0, e.clientY - start.current.y); const s = sheetOf(e.currentTarget); if (s) { s.style.transition = 'none'; s.style.transform = `translateY(${dy}px)`; } }}
      onPointerUp={(e) => {
        if (!start.current) return;
        const dy = e.clientY - start.current.y;
        start.current = null;
        const s = sheetOf(e.currentTarget);
        if (s) { s.style.transition = 'transform 0.18s'; s.style.transform = ''; }
        if (dy > 60 || Math.abs(dy) < 6) onClose();
      }}
      onPointerCancel={(e) => { start.current = null; const s = sheetOf(e.currentTarget); if (s) s.style.transform = ''; }}>
      <div className="grabber" />
    </div>
  );
}
