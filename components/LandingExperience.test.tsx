import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LandingExperience } from './LandingExperience';

const content = (
  <LandingExperience>
    <h1>Visible landing</h1>
    <button>Join</button>
  </LandingExperience>
);
let media: MediaQueryList;
let mediaChanged: () => void;
beforeEach(() => {
  media = {
    matches: false,
    addEventListener: jest.fn((_event, callback) => {
      mediaChanged = callback;
    }),
    removeEventListener: jest.fn(),
  } as unknown as MediaQueryList;
  jest.spyOn(window, 'matchMedia').mockReturnValue(media);
});
afterEach(() => {
  jest.restoreAllMocks();
});

test('motion is always on and offers no pause control', () => {
  const view = render(content);
  expect(view.container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'on');
  expect(document.documentElement.dataset.landingMotion).toBe('on');
  expect(screen.getAllByRole('button')).toHaveLength(1);
  view.unmount();
  expect(document.documentElement.dataset.landingMotion).toBeUndefined();
});

test('system reduced motion turns motion off and reacts to preference changes', () => {
  Object.defineProperty(media, 'matches', { value: true, configurable: true });
  const { container } = render(content);
  expect(container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'off');
  expect(document.documentElement.dataset.landingMotion).toBe('off');
  expect(screen.getByRole('heading')).toBeVisible();
  Object.defineProperty(media, 'matches', { value: false, configurable: true });
  act(() => mediaChanged());
  expect(container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'on');
});

test('hidden tabs suspend motion and resume when visible again', () => {
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const { container } = render(content);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'off');
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'on');
});

test('the cursor follower exists only for a fine pointer without reduced motion', () => {
  const reduced = { ...media, matches: false } as MediaQueryList;
  const fine = { ...media, matches: true } as MediaQueryList;
  jest
    .spyOn(window, 'matchMedia')
    .mockImplementation((query) => (query.includes('pointer: fine') ? fine : reduced));
  const { container } = render(content);
  expect(container.querySelector('.club-cursor')).toHaveAttribute('aria-hidden', 'true');
  expect(container.querySelector('.club-ink-layer')).toHaveAttribute('aria-hidden', 'true');
  Object.defineProperty(reduced, 'matches', { value: true, configurable: true });
  act(() => mediaChanged());
  expect(container.querySelector('.club-cursor')).toBeNull();
});

test('touch devices get no cursor follower', () => {
  const { container } = render(content);
  expect(container.querySelector('.club-cursor')).toBeNull();
});
