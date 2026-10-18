import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { LandingFlow } from './LandingFlow';

type Callback = (entries: Array<Partial<IntersectionObserverEntry>>) => void;

describe('LandingFlow', () => {
  // test-setup defines IntersectionObserver as writable, not configurable.
  const scope = window as unknown as { IntersectionObserver: unknown };
  const original = scope.IntersectionObserver;
  let callback: Callback = () => undefined;
  beforeEach(() => {
    scope.IntersectionObserver = jest.fn((cb: Callback) => {
      callback = cb;
      return { observe: jest.fn(), disconnect: jest.fn(), unobserve: jest.fn() };
    });
  });
  afterEach(() => {
    scope.IntersectionObserver = original;
  });

  it('changes the pinned fragment state with the statement in view', () => {
    const { container } = render(<LandingFlow />);
    const states = () =>
      Array.from(container.querySelectorAll('.cdl-panel-state')).map((node) =>
        node.getAttribute('data-active')
      );
    expect(states()).toEqual(['true', 'false', 'false']);
    expect(screen.getByText('Önce kafede check-in yap.').parentElement).toHaveClass('is-active');

    const third = screen.getByText('Kazandığını kafede harca.').parentElement as HTMLElement;
    act(() => callback([{ isIntersecting: true, target: third }]));
    expect(states()).toEqual(['false', 'false', 'true']);
    expect(third).toHaveClass('is-active');
    // The numbers follow the real rules: 100 start, +20 stake, a 100-point reward.
    // The pinned panel and the phone's inline copy both carry the reward state.
    expect(screen.getAllByText('Bakiyen 120 puan')).toHaveLength(2);
    expect(screen.getAllByText('Oyun Jetonu x5')).toHaveLength(2);
  });

  it('renders every statement without IntersectionObserver', () => {
    scope.IntersectionObserver = undefined;
    render(<LandingFlow />);
    expect(screen.getByRole('heading', { level: 2, name: 'Masadan ödüle' })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 3 })).toHaveLength(3);
  });
});
