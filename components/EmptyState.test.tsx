import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Coffee, Plus } from 'lucide-react';
import { EmptyState } from './EmptyState';

describe('EmptyState', () => {
  it('renders default variant with primary and secondary actions', () => {
    const onPrimary = jest.fn();
    const onSecondary = jest.fn();

    render(
      <EmptyState
        icon={Coffee}
        title="Lobi boş"
        description="Henüz aktif oyun yok."
        action={{ label: 'Oyun kur', onClick: onPrimary, icon: Plus }}
        secondaryAction={{ label: 'Yenile', onClick: onSecondary }}
      />
    );

    expect(screen.getByTestId('empty-state-title')).toHaveTextContent('Lobi boş');
    expect(screen.getByTestId('empty-state-description')).toHaveTextContent('Henüz aktif oyun yok.');

    fireEvent.click(screen.getByRole('button', { name: /Oyun kur/i }));
    fireEvent.click(screen.getByRole('button', { name: 'Yenile' }));

    expect(onPrimary).toHaveBeenCalledTimes(1);
    expect(onSecondary).toHaveBeenCalledTimes(1);
  });

  it('renders compact variant with compact test id and action', () => {
    const onPrimary = jest.fn();

    render(
      <EmptyState
        icon={Coffee}
        title="Boş"
        description="Veri yok"
        variant="compact"
        action={{ label: 'Tekrar dene', onClick: onPrimary }}
      />
    );

    expect(screen.getByTestId('empty-state-compact')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Tekrar dene' }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });
});
