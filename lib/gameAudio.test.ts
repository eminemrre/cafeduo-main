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

    expect(() => playGameSfx('win')).not.toThrow();
  });
});
