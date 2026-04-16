import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { ABTest } from './ABTest';

describe('ABTest', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders stored variant A without reassignment', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('A');

    render(
      <ABTest
        testName="hero_cta"
        variantA={<button>A variant</button>}
        variantB={<button>B variant</button>}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A variant' })).toBeInTheDocument();
    });
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('renders stored variant B without reassignment', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue('B');

    render(
      <ABTest
        testName="hero_cta"
        variantA={<button>A variant</button>}
        variantB={<button>B variant</button>}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'B variant' })).toBeInTheDocument();
    });
    expect(window.localStorage.setItem).not.toHaveBeenCalled();
  });

  it('assigns and persists a random variant when user has no assignment', async () => {
    (window.localStorage.getItem as jest.Mock).mockReturnValue(null);
    const randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9);

    render(
      <ABTest
        testName="hero_cta"
        variantA={<button>A variant</button>}
        variantB={<button>B variant</button>}
      />
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'A variant' })).toBeInTheDocument();
    });
    expect(window.localStorage.setItem).toHaveBeenCalledWith('ab_test_hero_cta', 'A');

    randomSpy.mockRestore();
  });
});
