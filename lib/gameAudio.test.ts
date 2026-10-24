import { playGameSfx } from './gameAudio';

describe('gameAudio', () => {
  const originalAudio = global.Audio;
  const originalUserAgent = navigator.userAgent;

  afterEach(() => {
    jest.restoreAllMocks();
    Object.defineProperty(global, 'Audio', {
      configurable: true,
      value: originalAudio,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: originalUserAgent,
    });
  });

  it('does nothing in jsdom runtime', () => {
    const audioCtor = jest.fn();
    Object.defineProperty(global, 'Audio', {
      configurable: true,
      value: audioCtor,
    });

    playGameSfx('hit');

    expect(audioCtor).not.toHaveBeenCalled();
  });

  it('clones cached audio, clamps volume, and ignores play failures', () => {
    const play = jest.fn().mockResolvedValue(undefined);
    const cloneNode = jest.fn(() => ({
      volume: 0,
      play,
    }));
    const audioInstance = {
      preload: '',
      cloneNode,
    };
    const audioCtor = jest.fn(() => audioInstance);

    Object.defineProperty(global, 'Audio', {
      configurable: true,
      value: audioCtor,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0',
    });

    playGameSfx('hit', 5);
    playGameSfx('hit', -2);

    expect(audioCtor).toHaveBeenCalledTimes(1);
    expect(cloneNode).toHaveBeenCalledTimes(2);
    expect((cloneNode.mock.results[0].value as { volume: number }).volume).toBe(1);
    expect((cloneNode.mock.results[1].value as { volume: number }).volume).toBe(0);
    expect(play).toHaveBeenCalledTimes(2);
  });

  const installAudio = (play: jest.Mock) => {
    const audioCtor = jest.fn(() => ({ preload: '', cloneNode: () => ({ volume: 0, play }) }));
    Object.defineProperty(global, 'Audio', { configurable: true, value: audioCtor });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0',
    });
    return audioCtor;
  };

  /** A fresh module, so the cached base audio of earlier tests is not reused. */
  const freshPlay = (): typeof playGameSfx => {
    let fresh: typeof playGameSfx = playGameSfx;
    jest.isolateModules(() => {
      fresh = (require('./gameAudio') as typeof import('./gameAudio')).playGameSfx;
    });
    return fresh;
  };

  const setUserActivation = (value: { hasBeenActive: boolean } | undefined) =>
    Object.defineProperty(window.navigator, 'userActivation', { configurable: true, value });

  afterEach(() => setUserActivation(undefined));

  // Sentry JAVASCRIPT-REACT-8/9/A: iOS refuses play() without a user gesture;
  // the rejected promise escaped the try/catch as an unhandled rejection.
  it('handles a refused play() without an unhandled promise rejection', async () => {
    const refused = new DOMException('The request is not allowed', 'NotAllowedError');
    const playback = Promise.reject(refused);
    // A rejection is handled once a reaction is attached (catch() calls then()).
    const then = jest.spyOn(playback, 'then');
    installAudio(jest.fn(() => playback));
    const play = freshPlay();
    try {
      expect(() => play('hit')).not.toThrow();
      expect(then).toHaveBeenCalled();
    } finally {
      // Keep a failing run from crashing the worker on the unhandled rejection.
      await expect(playback).rejects.toBe(refused);
    }
  });

  it('does not try to play before the page has had a user gesture', () => {
    const play = jest.fn().mockResolvedValue(undefined);
    installAudio(play);
    const sfx = freshPlay();
    setUserActivation({ hasBeenActive: false });
    sfx('hit');
    expect(play).not.toHaveBeenCalled();

    setUserActivation({ hasBeenActive: true });
    sfx('hit');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('swallows clone/play errors to avoid blocking gameplay', () => {
    const audioCtor = jest.fn(() => ({
      preload: '',
      cloneNode: () => {
        throw new Error('audio failed');
      },
    }));

    Object.defineProperty(global, 'Audio', {
      configurable: true,
      value: audioCtor,
    });
    Object.defineProperty(window.navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0',
    });

    expect(() => playGameSfx('hit')).not.toThrow();
  });
});
