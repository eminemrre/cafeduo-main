import React from 'react';
import { render, screen } from '@testing-library/react';
import Skeleton, {
  SkeletonText,
  SkeletonCard,
  SkeletonGrid,
  SkeletonStats,
  ButtonSkeleton,
  LoadingSpinner,
  LoadingOverlay,
  DotLoader,
} from './Skeleton';

describe('Skeleton components', () => {
  it('renders base skeleton with custom classes', () => {
    const { container } = render(<Skeleton className="h-8 w-20" />);

    const root = container.firstElementChild as HTMLElement;
    expect(root).toHaveClass('relative', 'overflow-hidden', 'h-8', 'w-20');
    expect(container.querySelectorAll('.absolute').length).toBeGreaterThan(0);
  });

  it('renders requested number of text lines', () => {
    const { container } = render(<SkeletonText lines={3} />);

    const lines = container.querySelectorAll('.h-4');
    expect(lines).toHaveLength(3);
    expect(lines[2]).toHaveClass('w-3/4');
  });

  it('renders card, grid, and stats skeleton variants', () => {
    const card = render(<SkeletonCard />);
    expect(card.container.querySelectorAll('.relative.overflow-hidden').length).toBeGreaterThanOrEqual(5);

    const grid = render(<SkeletonGrid count={4} columns={2} />);
    expect(grid.container.querySelector('div.md\\:grid-cols-2')).toBeInTheDocument();
    expect(grid.container.querySelectorAll('div.border-gray-800')).toHaveLength(4);

    const stats = render(<SkeletonStats />);
    expect(stats.container.querySelectorAll('.relative.overflow-hidden')).toHaveLength(7);
  });

  it('renders button skeleton with width variants', () => {
    const full = render(<ButtonSkeleton fullWidth={true} />);
    expect(full.container.firstElementChild).toHaveClass('w-full');

    const fixed = render(<ButtonSkeleton />);
    expect(fixed.container.firstElementChild).toHaveClass('w-32');
  });

  it('renders loading spinner sizes and text', () => {
    render(<LoadingSpinner size="sm" text="Yükleniyor..." />);

    expect(screen.getByText('Yükleniyor...')).toBeInTheDocument();
    const spinner = screen.getByText('Yükleniyor...').previousElementSibling as HTMLElement;
    expect(spinner).toHaveClass('w-6', 'h-6');
  });

  it('shows overlay only while loading', () => {
    const hidden = render(
      <LoadingOverlay isLoading={false} text="Bekleniyor">
        <div>İçerik</div>
      </LoadingOverlay>
    );
    expect(hidden.getByText('İçerik')).toBeInTheDocument();
    expect(hidden.queryByText('Bekleniyor')).not.toBeInTheDocument();
    hidden.unmount();

    const shown = render(
      <LoadingOverlay isLoading={true} text="Bekleniyor">
        <div>İçerik</div>
      </LoadingOverlay>
    );
    expect(shown.getByText('İçerik')).toBeInTheDocument();
    expect(shown.getByText('Bekleniyor')).toBeInTheDocument();
  });

  it('renders three-dot loader animation nodes', () => {
    const { container } = render(<DotLoader className="loader-test" />);
    expect(container.querySelector('.loader-test')).toBeInTheDocument();
    expect(container.querySelectorAll('.bg-blue-500')).toHaveLength(3);
  });
});
