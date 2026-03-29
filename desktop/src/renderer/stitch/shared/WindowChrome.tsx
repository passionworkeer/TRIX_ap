import React, { useCallback, useRef } from 'react';

const EDGE = 6;
type Edge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se' | null;

function hitEdge(x: number, y: number): Edge {
  const w = window.innerWidth, h = window.innerHeight;
  const t = y < EDGE, b = y > h - EDGE, l = x < EDGE, r = x > w - EDGE;
  if (t && l) return 'nw'; if (t && r) return 'ne';
  if (b && l) return 'sw'; if (b && r) return 'se';
  if (t) return 'n'; if (b) return 's'; if (l) return 'w'; if (r) return 'e';
  return null;
}

const CURSORS: Record<string, string> = {
  n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize',
  nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize',
};

/** Wraps the app: provides edge resize via JS + cursor feedback */
export function WindowChrome({ children }: { children: React.ReactNode }) {
  const resizing = useRef(false);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (resizing.current) return;
    const edge = hitEdge(e.clientX, e.clientY);
    (e.currentTarget as HTMLDivElement).style.cursor = edge ? CURSORS[edge] : '';
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    const edge = hitEdge(e.clientX, e.clientY);
    if (!edge) return;
    e.preventDefault();
    const api = window.electronAPI;
    if (!api?.windowGetBounds || !api?.windowSetBounds) return;
    resizing.current = true;
    const sx = e.screenX, sy = e.screenY;
    api.windowGetBounds().then((sb) => {
      const onMove = (me: MouseEvent) => {
        const dx = me.screenX - sx, dy = me.screenY - sy;
        let x = sb.x, y = sb.y, w = sb.width, h = sb.height;
        if (edge.includes('e')) w = Math.max(800, sb.width + dx);
        if (edge.includes('w')) { x = sb.x + dx; w = Math.max(800, sb.width - dx); }
        if (edge.includes('s')) h = Math.max(600, sb.height + dy);
        if (edge.includes('n')) { y = sb.y + dy; h = Math.max(600, sb.height - dy); }
        api.windowSetBounds({ x, y, width: w, height: h });
      };
      const onUp = () => {
        resizing.current = false;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }, []);

  return (
    <div
      onMouseMove={onMouseMove}
      onMouseDown={onMouseDown}
      style={{ width: '100%', height: '100%', position: 'relative' }}
    >
      {children}
    </div>
  );
}

/** Hook for title-bar drag — attach to the draggable element */
export function useTitleBarDrag() {
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (t.closest('button') || t.closest('[data-no-drag]')) return;
    const api = window.electronAPI;
    if (!api?.windowGetBounds || !api?.windowSetBounds) return;
    e.preventDefault();
    e.stopPropagation();
    const sx = e.screenX, sy = e.screenY;
    api.windowGetBounds().then((sb) => {
      let moved = false;
      const onMove = (me: MouseEvent) => {
        const dx = me.screenX - sx, dy = me.screenY - sy;
        if (Math.abs(dx) + Math.abs(dy) > 4) moved = true;
        if (moved) api.windowSetBounds({ x: sb.x + dx, y: sb.y + dy });
      };
      const onUp = () => {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      };
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });
  }, []);

  const onDoubleClick = useCallback(() => {
    window.electronAPI?.windowMaximize();
  }, []);

  return { onMouseDown, onDoubleClick };
}
