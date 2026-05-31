import { describe, expect, it } from 'vitest';
import { EventNames } from '../src/shared/eventNames';
import { IpcChannels } from '../src/shared/ipcChannels';

describe('shared protocols', () => {
  it('keeps event names unique and non-empty', () => {
    const values = Object.values(EventNames);

    expect(values.every(Boolean)).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });

  it('keeps IPC channels unique and namespaced', () => {
    const values = Object.values(IpcChannels);

    expect(values.every((value) => value.includes(':'))).toBe(true);
    expect(new Set(values).size).toBe(values.length);
  });
});
