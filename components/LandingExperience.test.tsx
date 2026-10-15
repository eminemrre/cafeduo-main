import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { LandingExperience, LandingMotionControl } from './LandingExperience';

const content = (
  <LandingExperience>
    <LandingMotionControl />
    <h1>Visible landing</h1>
    <button>Join</button>
  </LandingExperience>
);
const originalStorage = Object.getOwnPropertyDescriptor(window, 'sessionStorage');
let media: MediaQueryList;
let mediaChanged: () => void;
beforeEach(() => {
  const values = new Map<string, string>();
  Object.defineProperty(window, 'sessionStorage', {
    configurable: true,
    value: {
      getItem: jest.fn((key: string) => values.get(key) ?? null),
      setItem: jest.fn((key: string, value: string) => values.set(key, value)),
      clear: jest.fn(() => values.clear()),
    },
  });
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
  if (originalStorage) Object.defineProperty(window, 'sessionStorage', originalStorage);
});

test('motion can be paused, persists across remount, and resumes without hiding the content', () => {
  const view = render(content);
  const pause = screen.getByRole('button', { name: 'Hareketi durdur' });
  expect(pause.textContent).toBe('');
  expect(pause).not.toHaveAttribute('title');
  pause.focus();
  fireEvent.click(pause);
  expect(screen.getByRole('button', { name: 'Hareketi aç' })).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Hareketi aç' }).textContent).toBe('');
  expect(document.documentElement.dataset.landingMotion).toBe('off');
  expect(sessionStorage.getItem('cafeduo_landing_motion')).toBe('off');
  expect(screen.getByRole('heading')).toBeVisible();
  view.unmount();
  expect(document.documentElement.dataset.landingMotion).toBeUndefined();
  render(content);
  fireEvent.click(screen.getByRole('button', { name: 'Hareketi aç' }));
  expect(document.documentElement.dataset.landingMotion).toBe('on');
});
test('system reduced motion takes priority and reacts to preference changes', () => {
  Object.defineProperty(media, 'matches', { value: true, configurable: true });
  render(content);
  expect(screen.getByRole('button', { name: 'Hareket azaltıldı' })).toBeDisabled();
  expect(document.documentElement.dataset.landingMotion).toBe('off');
  Object.defineProperty(media, 'matches', { value: false, configurable: true });
  act(() => mediaChanged());
  expect(screen.getByRole('button', { name: 'Hareketi durdur' })).toBeEnabled();
});
test('motion controls still work when browser storage is unavailable', () => {
  jest.spyOn(window.sessionStorage, 'getItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  jest.spyOn(window.sessionStorage, 'setItem').mockImplementation(() => {
    throw new Error('Storage unavailable');
  });
  render(content);
  fireEvent.click(screen.getByRole('button', { name: 'Hareketi durdur' }));
  expect(screen.getByRole('button', { name: 'Hareketi aç' })).toHaveAttribute(
    'aria-pressed',
    'false'
  );
  expect(screen.getByRole('button', { name: 'Join' })).toBeVisible();
});

test('hidden tabs suspend motion without losing the user preference', () => {
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const { container } = render(content);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'off');
  expect(screen.getByRole('button', { name: 'Hareketi durdur' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('.club-landing')).toHaveAttribute('data-motion', 'on');
});
