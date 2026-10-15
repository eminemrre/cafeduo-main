import { decodeFrame } from './decodeText';

describe('decodeFrame', () => {
  it('shows nothing before the first character resolves', () => {
    expect(decodeFrame('MERHABA', 0, { random: () => 0 })).toEqual({ value: '', done: false });
    expect(decodeFrame('MERHABA', -50, { random: () => 0 })).toEqual({ value: '', done: false });
  });

  it('resolves the text left to right with a noise tail', () => {
    // 150 ms at 40 chars/s reveals 6 characters: 1 fixed + 5 noise.
    const frame = decodeFrame('MERHABA', 150, { random: () => 0 });
    expect(frame.value).toBe(`M${'!'.repeat(5)}`);
    expect(frame.done).toBe(false);
  });

  it('keeps the noise tail at most maxRandomChars long', () => {
    // 175 ms at 40 chars/s reveals exactly the target length: 5 fixed + 2 noise.
    const frame = decodeFrame('MERHABA', 175, { random: () => 0, maxRandomChars: 2 });
    expect(frame.value).toBe('MERHA!!');
    expect(frame.done).toBe(false);
  });

  it('never paints more characters than the target has', () => {
    for (const elapsed of [100, 200, 400, 800]) {
      const frame = decodeFrame('AK', elapsed, { random: () => 0.5 });
      expect(frame.value.length).toBeLessThanOrEqual(2);
    }
  });

  it('settles on the exact text once the tail has passed the end', () => {
    const frame = decodeFrame('MERHABA', 300, { random: () => 0.99 });
    expect(frame).toEqual({ value: 'MERHABA', done: true });
  });

  it('stays done for any later frame', () => {
    expect(decodeFrame('MERHABA', 5000, { random: () => 0.99 }).done).toBe(true);
  });

  it('fills the tail with printable ASCII only', () => {
    const frame = decodeFrame('AK', 100, { random: () => 0.999 });
    for (const char of frame.value) {
      const code = char.charCodeAt(0);
      expect(code).toBeGreaterThanOrEqual(33);
      expect(code).toBeLessThanOrEqual(125);
    }
  });

  it('is deterministic for a fixed random source', () => {
    const first = decodeFrame('CAFEDUO', 250, { random: () => 0.25 });
    const second = decodeFrame('CAFEDUO', 250, { random: () => 0.25 });
    expect(first).toEqual(second);
  });
});
