import React from 'react';
import { render, screen } from '@testing-library/react';
import { Games } from './Games';

describe('Games', () => {
  it('renders the club game list', () => {
    render(<Games />);

    expect(screen.getByTestId('games-main-heading')).toBeInTheDocument();
    expect(screen.getByTestId('games-main-heading')).toHaveTextContent('Hangisini oynuyoruz?');

    expect(screen.getByText('Retro Satranç')).toBeInTheDocument();
    expect(screen.getByText('Bilgi Yarışı')).toBeInTheDocument();
    expect(screen.getByText('Nişancı Düellosu')).toBeInTheDocument();

    expect(screen.getByText('Tahtaya geç')).toBeInTheDocument();
    expect(screen.getByText('Yarışmaya katıl')).toBeInTheDocument();
    expect(screen.getByText('Düelloya başla')).toBeInTheDocument();
  });
});
