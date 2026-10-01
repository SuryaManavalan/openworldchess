// How to play it with your hands (ux.md §3): the controls for this device only. A phone never
// sees a mouse button and a desktop never sees "pinch". Reachable from Settings, the top of the
// rulebook, the "?" on the drawing tool bar, and (desktop) the ? key.
import { useUI } from '../store.ts';

type Row = [string, string];
interface Section { id: string; title: string; rows: Row[] }

const PHONE: Section[] = [
  { id: 'map', title: 'The map', rows: [
    ['Move around', 'Drag with one finger'], ['Zoom', 'Pinch'], ['Turn the board', 'Twist with two fingers'],
    ['See what something is', 'Tap it'], ['Drop a flag', 'Long-press empty ground'],
  ] },
  { id: 'pieces', title: 'Pieces and troops', rows: [
    ['Select a king and its army', 'Tap the king'], ['Select one piece', 'Tap it'], ['Select everything near a king', 'Double-tap it'],
    ['Select many', 'Long-press, then draw around them'], ['Add or drop pieces', '+ Add, then tap pieces; or the − / + by each kind'],
    ['Move', 'Tap the ground, then tap the marker again (or Move here)'], ['Attack', 'Tap an enemy king or camp'],
    ['Drag an order', 'Drag from a selected piece to where it should go'], ['Deselect', 'The ×, or tap the one selected piece again'],
  ] },
  { id: 'build', title: 'Building', rows: [
    ['Build', 'The hammer, then a building; drag the outline, then Build'], ['See or change a building', 'Tap it: Pause, Move, Demolish'],
    ['Amber outline', 'It can stand there, but won\'t produce without its resource nearby'],
  ] },
  { id: 'tools', title: 'Streets, decorations and planting', rows: [
    ['Pick a tool', 'The hammer, then Streets, Adorn or Plant'], ['Draw', 'One finger: tap to place one, drag for a line or an area'],
    ['Move the map while drawing', 'Two fingers'], ['Street width', 'Narrow, Wide or Square on the tool bar'],
    ['Remove', 'Erase on the tool bar, then drag over it'], ['Take back your last stroke', 'Undo on the tool bar'], ['Finish', 'Done'],
  ] },
  { id: 'works', title: 'Work crews', rows: [
    ['Pave (knights only)', 'Pave, then tap where the road goes'], ['Clear land (elephants only)', 'Clear land, then drag over the area'],
    ['Haul (elephants only)', 'Haul, tap a rock or ore deposit, then tap where to set it down'], ['Raise an altar (a bishop)', 'Raise altar'],
  ] },
  { id: 'battle', title: 'Battles', rows: [['Move a piece', 'Tap it, then tap its square (or drag it)'], ['Leave', 'Resign, or wait for the end']] },
];

const DESKTOP: Section[] = [
  { id: 'map', title: 'The map', rows: [
    ['Move around', 'Right-drag, middle-drag, Space + drag or Ctrl + drag; arrow keys or WASD'], ['Zoom', 'Mouse wheel or + / −'],
    ['Turn the board', 'Q / E'], ['Your Emperor', 'H'], ['Drop a flag', 'F (at the cursor)'], ['What something is', 'Hover it'],
  ] },
  { id: 'pieces', title: 'Pieces and troops', rows: [
    ['Select a king and its army', 'Click the king'], ['Select one piece', 'Click it'], ['Select everything near a king', 'Double-click it'],
    ['Select many', 'Drag a box'], ['Add or drop pieces', 'Shift-click; or the − / + by each kind'], ['Select all', 'Ctrl + A'],
    ['Move', 'Right-click the ground'], ['Attack', 'Right-click an enemy king or camp'], ['Stop', 'S'], ['Deselect', 'Esc, or the ×'],
  ] },
  { id: 'build', title: 'Building', rows: [
    ['Build', 'B, then a building; click to place'], ['See or change a building', 'Click it: Pause, Move, Demolish'],
    ['Amber outline', 'It can stand there, but won\'t produce without its resource nearby'],
  ] },
  { id: 'tools', title: 'Streets, decorations and planting', rows: [
    ['Pick a tool', 'Streets, Adorn or Plant in the Build panel'], ['Draw', 'Click to place one; drag for a line or an area'],
    ['Move the map while drawing', 'Right-drag or Space + drag'], ['Street width', 'Narrow, Wide or Square on the tool bar'],
    ['Erase', 'X, then drag over it'], ['Take back your last stroke', 'Ctrl + Z, or Undo'], ['Finish', 'Esc or Done'],
  ] },
  { id: 'works', title: 'Work crews', rows: [
    ['Pave (knights only)', 'Pave, then click where the road goes'], ['Clear land (elephants only)', 'Clear land, then drag over the area'],
    ['Haul (elephants only)', 'Haul, click a rock or ore deposit, then click where to set it down'], ['Raise an altar (a bishop)', 'Raise altar'],
  ] },
  { id: 'battle', title: 'Battles', rows: [['Move a piece', 'Click it, then its square (or drag it)'], ['Leave', 'Resign, or wait for the end']] },
  { id: 'keys', title: 'Other keys', rows: [['This guide', '?'], ['Build panel', 'B']] },
];

/** The controls for this device. `open`: the section to show open first (say, 'tools'). */
export function Controls({ open }: { open?: string }) {
  const ui = useUI();
  const sections = ui.layout === 'phone' ? PHONE : DESKTOP;
  return (
    <div className="controls">
      <h3>Controls</h3>
      {sections.map((s) => (
        <details key={s.id} className="lesson-row" open={s.id === (open ?? 'map')}>
          <summary>{s.title}</summary>
          <dl className="controls-list">{s.rows.map(([what, how]) => <div key={what} className="ctl"><dt>{what}</dt><dd>{how}</dd></div>)}</dl>
        </details>
      ))}
    </div>
  );
}
