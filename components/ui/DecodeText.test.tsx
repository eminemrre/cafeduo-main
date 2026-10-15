import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { DecodeText } from './DecodeText';

// jsdom has no frame clock. Frames are queued by the rAF mock and run on
// demand so the component's elapsed-time logic stays deterministic.
let pendingFrames: FrameRequestCallback[] = [];
let clock = 0;

const runFrames = (count: number) => {
  for (let index = 0; index < count; index += 1) {
    const callbacks = pendingFrames;
    pendingFrames = [];
    clock += 16;
    callbacks.forEach((callback) => callback(clock));
  }
};

describe('DecodeText', () => {
  beforeEach(() => {
    pendingFrames = [];
    clock = 0;
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      pendingFrames.push(callback);
      return pendingFrames.length;
    });
    jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('reveals the text and settles on the final value', () => {
    render(<DecodeText text="MERHABA" data-testid="decode" />);
    const node = screen.getByTestId('decode');

    expect(node.textContent).toBe('');

    act(() => {
      runFrames(40);
    });

    expect(node.textContent).toBe('MERHABA');
  });

  it('exposes the final text to assistive tech from the first frame', () => {
    render(<DecodeText text="YÜKLENİYOR" data-testid="decode" />);

    expect(screen.getByLabelText('YÜKLENİYOR')).toBeInTheDocument();
    expect(screen.getByTestId('decode').querySelector('[aria-hidden="true"]')).not.toBeNull();
  });

  it('paints a partial value while the tail is still chasing', () => {
    render(<DecodeText text="CAFEDUO" data-testid="decode" />);
    const node = screen.getByTestId('decode');

    act(() => {
      runFrames(10);
    });

    expect(node.textContent).not.toBe('');
    expect(node.textContent).not.toBe('CAFEDUO');
    expect(node.textContent?.length).toBeLessThanOrEqual('CAFEDUO'.length);
  });
});
