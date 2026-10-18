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
  setProgress: jest.fn(),
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
  mockMotion.mockReturnValue({
    running: true,
    enabled: true,
    reduced: false,
    finePointer: true,
  });
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
  mockMotion.mockReturnValue({
    running: false,
    enabled: false,
    reduced: true,
    finePointer: true,
  });
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

test('a sideways touch drag spins the scene and releasing hands it back to the scroll', async () => {
  mockMotion.mockReturnValue({
    running: true,
    enabled: true,
    reduced: false,
    finePointer: false,
  });
  const view = render(<CafeScene3D />);
  await visible(true);
  const host = view.container.querySelector<HTMLElement>('.cafe-scene')!;
  jest.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 200,
  } as DOMRect);
  const touch = (type: string, clientX: number) => {
    const event = new MouseEvent(type, { bubbles: true, clientX });
    Object.defineProperties(event, { pointerType: { value: 'touch' }, pointerId: { value: 3 } });
    fireEvent(host, event);
  };
  touch('pointerdown', 100);
  touch('pointermove', 150);
  expect(scene.setPointer).toHaveBeenLastCalledWith(1.25, 0);
  touch('pointermove', 400);
  expect(scene.setPointer).toHaveBeenLastCalledWith(3, 0);
  touch('pointerup', 400);
  expect(scene.setPointer).toHaveBeenLastCalledWith(0, 0);
});

test('mouse hover still tilts the scene and leaving recenters it', async () => {
  const view = render(<CafeScene3D />);
  await visible(true);
  const host = view.container.querySelector<HTMLElement>('.cafe-scene')!;
  jest.spyOn(host, 'getBoundingClientRect').mockReturnValue({
    left: 0,
    top: 0,
    width: 200,
    height: 100,
  } as DOMRect);
  const mouse = (type: string, clientX: number, clientY: number, relatedTarget?: Element) => {
    const event = new MouseEvent(type, { bubbles: true, clientX, clientY, relatedTarget });
    Object.defineProperty(event, 'pointerType', { value: 'mouse' });
    fireEvent(host, event);
  };
  mouse('pointermove', 150, 25);
  expect(scene.setPointer).toHaveBeenLastCalledWith(0.25, -0.25);
  // React derives onPointerLeave from pointerout towards an element outside the host.
  mouse('pointerout', 300, 25, document.body);
  expect(scene.setPointer).toHaveBeenLastCalledWith(0, 0);
});

test('the chapter list drives the story and the chapter buttons scroll to their chapter', async () => {
  const frames: FrameRequestCallback[] = [];
  jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: 1000 });
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1400 });
  const list = document.createElement('ol');
  const steps = [0, 1, 2].map(() => {
    const step = document.createElement('li');
    step.setAttribute('data-story-step', '');
    step.scrollIntoView = jest.fn();
    list.appendChild(step);
    return step;
  });
  document.body.appendChild(list);
  const position = jest.spyOn(list, 'getBoundingClientRect');
  position.mockReturnValue({ top: 1200, height: 600 } as DOMRect);
  const story = { current: list };

  render(<CafeScene3D story={story} />);
  await visible(true);
  expect(scene.setProgress).toHaveBeenLastCalledWith(-1);
  expect(screen.getByRole('button', { name: 'Kahveni al' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );

  // Anchor at 55% of 1000 px sits on the middle of the second 200 px block.
  position.mockReturnValue({ top: 250, height: 600 } as DOMRect);
  act(() => {
    window.dispatchEvent(new Event('scroll'));
    frames.splice(0).forEach((callback) => callback(0));
  });
  expect(scene.setProgress).toHaveBeenLastCalledWith(1);
  expect(screen.getByRole('button', { name: 'Oyuna katıl' })).toHaveAttribute(
    'aria-pressed',
    'true'
  );
  expect(scene.setChapter).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole('button', { name: 'Ödülünü seç' }));
  expect(steps[2].scrollIntoView).toHaveBeenCalledWith({ behavior: 'smooth', block: 'center' });
  list.remove();
  jest.restoreAllMocks();
});
