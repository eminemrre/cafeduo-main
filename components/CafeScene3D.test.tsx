import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { CafeScene3D } from './CafeScene3D';
import { createCafeScene } from '../lib/createCafeScene';
import { useLandingMotion } from './LandingExperience';

jest.mock('../lib/createCafeScene', () => ({ createCafeScene: jest.fn() }));
jest.mock('./LandingExperience', () => ({ useLandingMotion: jest.fn() }));
const mockCreate = jest.mocked(createCafeScene);
const mockMotion = jest.mocked(useLandingMotion);
let intersect: IntersectionObserverCallback;
const originalObserver = window.IntersectionObserver;
const scene = {
  setRunning: jest.fn(),
  setPointer: jest.fn(),
  setChapter: jest.fn(),
  resize: jest.fn(),
  dispose: jest.fn(),
};
const visible = async (value: boolean) => {
  await act(async () => {
    intersect([{ isIntersecting: value } as IntersectionObserverEntry], {} as IntersectionObserver);
    await Promise.resolve();
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockCreate.mockReturnValue(scene);
  mockMotion.mockReturnValue({ running: true, enabled: true, reduced: false, toggle: jest.fn() });
  window.IntersectionObserver = jest.fn((callback) => {
    intersect = callback;
    return { observe: jest.fn(), disconnect: jest.fn() };
  }) as unknown as typeof IntersectionObserver;
});
afterEach(() => {
  window.IntersectionObserver = originalObserver;
});

test('loads only when visible, keeps the initialized scene across renders, and disposes on unmount', async () => {
  const view = render(<CafeScene3D />);
  expect(mockCreate).not.toHaveBeenCalled();
  await visible(true);
  expect(mockCreate).toHaveBeenCalledTimes(1);
  expect(view.container.querySelector('.cafe-scene')).toHaveAttribute('data-renderer', 'webgl');
  expect(scene.dispose).not.toHaveBeenCalled();
  view.rerender(<CafeScene3D />);
  expect(scene.dispose).not.toHaveBeenCalled();
  view.unmount();
  expect(scene.dispose).toHaveBeenCalledTimes(1);
});

test('stops offscreen and resumes without constructing another scene', async () => {
  render(<CafeScene3D />);
  await visible(true);
  expect(scene.setRunning).toHaveBeenLastCalledWith(true);
  await visible(false);
  expect(scene.setRunning).toHaveBeenLastCalledWith(false);
  await visible(true);
  expect(scene.setRunning).toHaveBeenLastCalledWith(true);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});

test('honors the landing pause and reduced-motion state', async () => {
  const view = render(<CafeScene3D />);
  await visible(true);
  mockMotion.mockReturnValue({ running: false, enabled: false, reduced: true, toggle: jest.fn() });
  view.rerender(<CafeScene3D />);
  expect(scene.setRunning).toHaveBeenLastCalledWith(false);
  expect(view.container.querySelector('.cafe-scene')).toHaveAttribute('data-running', 'false');
});

test('keeps the local illustration and accessible chapter controls when WebGL is unavailable', async () => {
  mockCreate.mockImplementation(() => {
    throw new Error('WebGL unavailable');
  });
  const view = render(<CafeScene3D />);
  await visible(true);
  expect(view.container.querySelector('.cafe-scene')).toHaveAttribute(
    'data-renderer',
    'illustration'
  );
  fireEvent.click(screen.getByRole('button', { name: 'Oyuna katıl' }));
  expect(screen.getByRole('button', { name: 'Oyuna katıl' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
});

test('responds to chapter selection and hides the canvas after context loss', async () => {
  const view = render(<CafeScene3D />);
  await visible(true);
  fireEvent.click(screen.getByRole('button', { name: 'Ödülünü seç' }));
  expect(scene.setChapter).toHaveBeenLastCalledWith(2);
  fireEvent(view.container.querySelector('canvas')!, new Event('webglcontextlost'));
  expect(view.container.querySelector('.cafe-scene')).toHaveAttribute(
    'data-renderer',
    'illustration'
  );
});

test('cancels initialization when the component unmounts before the dynamic import resolves', async () => {
  const view = render(<CafeScene3D />);
  act(() =>
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  );
  view.unmount();
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockCreate).not.toHaveBeenCalled();
});

test('cancels a pending scene load offscreen and retries when visible again', async () => {
  render(<CafeScene3D />);
  act(() =>
    intersect([{ isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver)
  );
  act(() =>
    intersect([{ isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver)
  );
  await act(async () => {
    await Promise.resolve();
  });
  expect(mockCreate).not.toHaveBeenCalled();
  await visible(true);
  expect(mockCreate).toHaveBeenCalledTimes(1);
});
