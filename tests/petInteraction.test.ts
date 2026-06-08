/**
 * 桌宠鼠标交互测试
 *
 * 直接测试 src/renderer/src/pet/interactionDecider.ts ——
 * 和 usePetInteraction hook 使用的是同一套逻辑。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CLICK_THRESHOLD,
  DOUBLE_CLICK_WINDOW,
  HOVER_DELAY,
  createInteractionDecider
} from '../src/renderer/src/pet/interactionDecider';

/** 模拟一次完整点击：mousedown 设起点，mousemove 可能产生拖拽偏移，mouseup 裁决 */
function tap(decider: ReturnType<typeof createInteractionDecider>, dx: number, dy: number): void {
  decider.setStartPoint({ screenX: 0, screenY: 0 });
  if (dx !== 0 || dy !== 0) {
    decider.onDragMove({ screenX: dx, screenY: dy });
  }
  decider.onMouseUp({ screenX: dx, screenY: dy });
}

function makeDecider() {
  const single = vi.fn();
  const double = vi.fn();
  const hover = vi.fn();
  const cb = { current: { onSingleClick: single, onDoubleClick: double, onHoverStart: hover } };
  const d = createInteractionDecider(cb);
  return { d, single, double, hover };
}

describe('interactionDecider', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── 单击 ──────────────────────────────────────────

  it('移动 < 阈值 且 350ms 无第二次点击 → 触发单击', () => {
    const { d, single } = makeDecider();
    tap(d, 0, 0);

    expect(single).not.toHaveBeenCalled();
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW + 1);
    expect(single).toHaveBeenCalledTimes(1);
  });

  it('移动 >= 阈值 → 不触发单击', () => {
    const { d, single } = makeDecider();
    tap(d, CLICK_THRESHOLD, 0);

    vi.advanceTimersByTime(500);
    expect(single).not.toHaveBeenCalled();
  });

  // ── 双击 ──────────────────────────────────────────

  it('两次 mouseUp 间隔 < 350ms → 触发双击，单击被抑制', () => {
    const { d, single, double } = makeDecider();

    tap(d, 1, 0); // 第一次点击，移动 1px (< 阈值)
    vi.advanceTimersByTime(200);

    tap(d, 1, 0); // 第二次点击
    expect(double).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(500);
    expect(single).not.toHaveBeenCalled();
  });

  it('两次 mouseUp 间隔 > 350ms → 两次独立单击', () => {
    const { d, single, double } = makeDecider();

    tap(d, 0, 0);
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW + 1);
    expect(single).toHaveBeenCalledTimes(1);

    tap(d, 0, 0);
    vi.advanceTimersByTime(DOUBLE_CLICK_WINDOW + 1);
    expect(single).toHaveBeenCalledTimes(2);
    expect(double).not.toHaveBeenCalled();
  });

  // ── 拖拽 ──────────────────────────────────────────

  it('onDragMove 返回从上次位置的 delta', () => {
    const { d } = makeDecider();
    d.setStartPoint({ screenX: 100, screenY: 50 });

    expect(d.onDragMove({ screenX: 130, screenY: 50 })).toEqual({ dx: 30, dy: 0 });
    expect(d.onDragMove({ screenX: 133, screenY: 50 })).toEqual({ dx: 3, dy: 0 });
    expect(d.onDragMove({ screenX: 133, screenY: 50 })).toBeNull(); // 零移动返回 null
  });

  it('累计移动 >= 阈值后 mouseUp 不触发点击', () => {
    const { d, single } = makeDecider();
    d.setStartPoint({ screenX: 0, screenY: 0 });
    d.onDragMove({ screenX: 2, screenY: 0 });
    d.onDragMove({ screenX: 5, screenY: 0 }); // 累计 5px
    d.onMouseUp({ screenX: 0, screenY: 0 });

    vi.advanceTimersByTime(500);
    expect(single).not.toHaveBeenCalled();
  });

  // ── 鼠标离开 ──────────────────────────────────────

  it('mouseLeave 重置状态，挂起的单击被取消', () => {
    const { d, single } = makeDecider();

    tap(d, 0, 0);
    d.onMouseLeave();

    vi.advanceTimersByTime(500);
    expect(single).not.toHaveBeenCalled();
  });

  // ── 公开常量 ──────────────────────────────────────

  it('导出悬停延迟常量', () => {
    expect(HOVER_DELAY).toBe(500);
  });
});
