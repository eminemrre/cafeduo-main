import React from 'react';
import { render, screen } from '@testing-library/react';
import { About } from './About';

describe('About', () => {
  it('renders player benefits and cafe positioning', () => {
    render(<About />);

    expect(screen.getByTestId('about-main-heading')).toBeInTheDocument();
    expect(screen.getByTestId('about-main-heading')).toHaveTextContent(
      'Biraz rekabet. Bolca iyi vakit.'
    );

    expect(screen.getByText('Anlık Eşleşme')).toBeInTheDocument();
    expect(screen.getByText('Kısa Tur Dinamiği')).toBeInTheDocument();
    expect(screen.getByText('Güvenli Giriş')).toBeInTheDocument();
    expect(screen.getByText('Ödül Döngüsü')).toBeInTheDocument();

    expect(screen.getByText(/Yeni bir buluşma sebebi/)).toBeInTheDocument();
  });
});
