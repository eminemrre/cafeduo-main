import React from 'react';
import { render, screen } from '@testing-library/react';
import { About } from './About';

describe('About', () => {
  it('explains the same-cafe games and cafe-defined rewards', () => {
    render(<About />);
    expect(screen.getByTestId('about-main-heading')).toHaveTextContent(
      'Bir sonraki masada kim var?'
    );
    expect(screen.getByText(/aynı kafedeki açık oyunları/)).toBeInTheDocument();
    expect(screen.getByText(/ödülleri kafen belirler/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Hesaptan ilk oyuna/ })).toHaveAttribute(
      'href',
      '#features'
    );
  });
});
