import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ToyStage } from './ToyStage';

const scene = {
  resize: jest.fn(),
  setRunning: jest.fn(),
  setPointer: jest.fn(),
  setScroll: jest.fn(),
  playKnightMove: jest.fn(() => Promise.resolve()),
  renderOnce: jest.fn(),
  dispose: jest.fn(),
};
const createToyScene = jest.fn(() => scene);
jest.mock('../../lib/createToyScene', () => ({
  createToyScene: (...args: unknown[]) => createToyScene(...(args as [])),
}));

describe('ToyStage', () => {
  const getContext = HTMLCanvasElement.prototype.getContext;
  // test-setup defines IntersectionObserver as writable, not configurable.
  const scope = window as unknown as { IntersectionObserver: unknown };
  const observer = scope.IntersectionObserver;
  beforeEach(() => {
    scope.IntersectionObserver = class {
      constructor(private callback: IntersectionObserverCallback) {}
      observe(target: Element) {
        this.callback(
          [{ isIntersecting: true, target } as IntersectionObserverEntry],
          this as unknown as IntersectionObserver
        );
      }
      disconnect() {}
    };
  });
  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = getContext;
    scope.IntersectionObserver = observer;
    jest.clearAllMocks();
  });

  it('works as a picture without WebGL: the knight move swaps to its end pose', () => {
    HTMLCanvasElement.prototype.getContext = jest.fn((): null => null) as never;
    const { container } = render(<ToyStage />);
    const play = screen.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' });
    expect(screen.getByRole('img')).toHaveAttribute(
      'alt',
      expect.stringContaining('MASA07 tabelası')
    );
    fireEvent.click(play);
    return waitFor(() => {
      expect(screen.getByRole('button', { name: 'Atı geri çek' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByText(/Gerçek maçta kazandığın puan/)).toBeInTheDocument();
      expect(container.querySelector('.cdl-stage')).toHaveAttribute('data-live', 'false');
      expect(createToyScene).not.toHaveBeenCalled();
    });
  });

  it('builds the 3D scene when WebGL exists and plays the move there', async () => {
    HTMLCanvasElement.prototype.getContext = jest.fn(() => ({})) as never;
    const { container, unmount } = render(<ToyStage />);
    await waitFor(() => expect(createToyScene).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(container.querySelector('.cdl-stage')).toHaveAttribute('data-live', 'true')
    );
    expect(createToyScene.mock.calls[0]).toBeDefined();
    fireEvent.click(screen.getByRole('button', { name: 'Ata dokun, ilk hamleni yap' }));
    await waitFor(() => expect(scene.playKnightMove).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole('button', { name: 'Atı geri çek' })).toBeInTheDocument();
    unmount();
    expect(scene.dispose).toHaveBeenCalled();
  });
});
