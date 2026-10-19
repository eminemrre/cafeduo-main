import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LandingExperience, useLandingMotion } from './LandingExperience';

const MotionProbe: React.FC = () => {
  const motion = useLandingMotion();
  return <p data-testid="probe">{motion?.running ? 'running' : 'still'}</p>;
};

const content = (
  <LandingExperience>
    <h1>Visible landing</h1>
    <MotionProbe />
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

test('motion runs by default, has no toggle and never hides the content', () => {
  const view = render(content);
  expect(screen.getByTestId('probe')).toHaveTextContent('running');
  expect(document.documentElement.dataset.landingMotion).toBe('on');
  expect(screen.queryByRole('button', { name: /Hareket/ })).not.toBeInTheDocument();
  expect(screen.getByRole('heading')).toBeVisible();
  view.unmount();
  expect(document.documentElement.dataset.landingMotion).toBeUndefined();
});

test('system reduced motion stops motion and reacts to preference changes', () => {
  Object.defineProperty(media, 'matches', { value: true, configurable: true });
  render(content);
  expect(document.documentElement.dataset.landingMotion).toBe('off');
  expect(screen.getByTestId('probe')).toHaveTextContent('still');
  Object.defineProperty(media, 'matches', { value: false, configurable: true });
  act(() => mediaChanged());
  expect(document.documentElement.dataset.landingMotion).toBe('on');
});

test('hidden tabs suspend motion until they are visible again', () => {
  const hidden = jest.spyOn(document, 'hidden', 'get').mockReturnValue(false);
  const { container } = render(content);
  hidden.mockReturnValue(true);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('.cdl-page')).toHaveAttribute('data-motion', 'off');
  hidden.mockReturnValue(false);
  act(() => document.dispatchEvent(new Event('visibilitychange')));
  expect(container.querySelector('.cdl-page')).toHaveAttribute('data-motion', 'on');
  expect(screen.getByRole('button', { name: 'Join' })).toBeVisible();
});
