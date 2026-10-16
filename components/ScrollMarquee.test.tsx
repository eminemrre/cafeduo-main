import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { ScrollMarquee } from './ScrollMarquee';
import { useLandingMotion } from './LandingExperience';

jest.mock('./LandingExperience', () => ({ useLandingMotion: jest.fn() }));
const mockMotion = jest.mocked(useLandingMotion);
const motionState = (running: boolean) => ({
  running,
  enabled: running,
  reduced: false,
  finePointer: false,
});

let frames: FrameRequestCallback[];
let intersect: IntersectionObserverCallback;
const originalObserver = window.IntersectionObserver;
const flush = (time: number) => {
  const queued = frames;
  frames = [];
  queued.forEach((callback) => callback(time));
};

beforeEach(() => {
  frames = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  jest.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frames = [];
  });
  window.IntersectionObserver = jest.fn((callback) => {
    intersect = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  }) as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  window.IntersectionObserver = originalObserver;
  jest.restoreAllMocks();
});

const items = ['Satranç', 'Bilgi Yarışı'];

test('exposes one readable label and hides the duplicated ticker text', () => {
  mockMotion.mockReturnValue(motionState(false));
  const view = render(<ScrollMarquee items={items} label="Satranç / Bilgi Yarışı" />);
  expect(screen.getByText('Satranç / Bilgi Yarışı')).toHaveClass('sr-only');
  const track = view.container.querySelector('.club-marquee-track')!;
  expect(track).toHaveAttribute('aria-hidden', 'true');
  expect(track.querySelectorAll('.club-marquee-item')).toHaveLength(4);
  expect(frames).toHaveLength(0);
});

test('moves only while visible and running, and resets when motion stops', () => {
  mockMotion.mockReturnValue(motionState(true));
  const view = render(<ScrollMarquee items={items} label="Oyunlar" />);
  const track = view.container.querySelector<HTMLElement>('.club-marquee-track')!;
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 800 });
  expect(frames).toHaveLength(0);

  act(() => intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as never));
  flush(1000);
  flush(2000);
  expect(track.style.transform).toMatch(/^translate3d\(-\d+(\.\d+)?px, 0, 0\) skewX\(/);

  act(() => intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as never));
  flush(3000);
  expect(frames).toHaveLength(0);

  mockMotion.mockReturnValue(motionState(false));
  view.rerender(<ScrollMarquee items={items} label="Oyunlar" />);
  expect(track.style.transform).toBe('');
});
