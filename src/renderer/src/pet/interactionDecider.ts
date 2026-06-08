/**
 * 桌宠鼠标交互裁决器（纯函数，无 DOM / React / Electron 依赖）
 *
 * 职责：根据 mousedown / mouseup 的坐标和时间，判断用户意图。
 * 窗口拖拽由外部调用方通过 IPC 完成，不在本模块范围内。
 */

export const CLICK_THRESHOLD = 4; // px
export const DOUBLE_CLICK_WINDOW = 350; // ms
export const HOVER_DELAY = 500; // ms

export interface MousePoint {
  screenX: number;
  screenY: number;
}

export type DragUpdate = { dx: number; dy: number };

export interface DeciderState {
  setStartPoint: (point: MousePoint) => void;
  onDragMove: (point: MousePoint) => DragUpdate | null;
  onMouseUp: (point: MousePoint) => void;
  onMouseLeave: () => void;
  hoverDelay: number;
}

export interface DeciderCallbacks {
  onSingleClick: () => void;
  onDoubleClick: () => void;
  onHoverStart: () => void;
}

export function createInteractionDecider(callbacks: { current: DeciderCallbacks }): DeciderState {
  let lastPoint: MousePoint | null = null;
  let totalDx = 0;
  let totalDy = 0;
  let clickTimer: ReturnType<typeof setTimeout> | null = null;
  let clickCount = 0;

  function clearClickTimer(): void {
    if (clickTimer) { clearTimeout(clickTimer); clickTimer = null; }
  }

  function reset(): void {
    lastPoint = null;
    totalDx = 0;
    totalDy = 0;
    clearClickTimer();
    clickCount = 0;
  }

  /** hook 在 mousedown 时调用此方法，设初始坐标 */
  function setStartPoint(point: MousePoint): void {
    lastPoint = point;
    totalDx = 0;
    totalDy = 0;
  }

  function onDragMove(point: MousePoint): DragUpdate | null {
    if (!lastPoint) return null;
    const dx = point.screenX - lastPoint.screenX;
    const dy = point.screenY - lastPoint.screenY;
    if (dx === 0 && dy === 0) return null;
    lastPoint = point;
    totalDx += dx;
    totalDy += dy;
    return { dx, dy };
  }

  function onMouseUp(_point: MousePoint): void {
    lastPoint = null;
    const wasDrag = Math.abs(totalDx) >= CLICK_THRESHOLD || Math.abs(totalDy) >= CLICK_THRESHOLD;
    totalDx = 0;
    totalDy = 0;

    if (wasDrag) return;

    clickCount += 1;
    if (clickCount === 1) {
      clickTimer = setTimeout(() => {
        clickCount = 0;
        callbacks.current.onSingleClick();
      }, DOUBLE_CLICK_WINDOW);
    } else {
      clearClickTimer();
      clickCount = 0;
      callbacks.current.onDoubleClick();
    }
  }

  function onMouseLeave(): void {
    reset();
  }

  return {
    setStartPoint,
    onDragMove,
    onMouseUp,
    onMouseLeave,
    hoverDelay: HOVER_DELAY
  };
}
