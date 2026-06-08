import { useCallback, useRef } from 'react';
import { createInteractionDecider, HOVER_DELAY, type MousePoint } from './interactionDecider';

interface PetInteractionCallbacks {
  onSingleClick: () => void;
  onDoubleClick: () => void;
  onHoverStart: () => void;
  onHoverEnd: () => void;
  onContextMenu: (event: React.MouseEvent) => void;
}

export function usePetInteraction({
  onSingleClick,
  onDoubleClick,
  onHoverStart,
  onHoverEnd,
  onContextMenu
}: PetInteractionCallbacks) {
  const cb = useRef({ onSingleClick, onDoubleClick, onHoverStart, onHoverEnd });
  cb.current = { onSingleClick, onDoubleClick, onHoverStart, onHoverEnd };
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanup = useCallback(() => {
    if (hoverTimer.current) { clearTimeout(hoverTimer.current); hoverTimer.current = null; }
  }, []);

  const callbacksRef = useRef({ onSingleClick, onDoubleClick, onHoverStart });
  callbacksRef.current = { onSingleClick, onDoubleClick, onHoverStart };
  const deciderRef = useRef(createInteractionDecider(callbacksRef));

  const onMouseDown = useCallback((event: React.MouseEvent) => {
    cleanup();
    const decider = deciderRef.current;

    hoverTimer.current = setTimeout(() => cb.current.onHoverStart(), HOVER_DELAY);
    const startPoint = { screenX: event.screenX, screenY: event.screenY };
    decider.setStartPoint(startPoint);

    const toPoint = (e: MouseEvent): MousePoint => ({ screenX: e.screenX, screenY: e.screenY });

    const onMouseMove = (e: MouseEvent) => {
      const delta = decider.onDragMove(toPoint(e));
      if (delta) {
        window.deskPet.app.moveWindow(delta.dx, delta.dy);
      }
    };

    const onMouseUp = (e: MouseEvent) => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      cleanup();
      cb.current.onHoverEnd();
      decider.onMouseUp(toPoint(e));
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [cleanup]);

  const onMouseLeave = useCallback(() => {
    cleanup();
    cb.current.onHoverEnd();
  }, [cleanup]);

  return { onMouseDown, onMouseLeave, onContextMenu };
}
