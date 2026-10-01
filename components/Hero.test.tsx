import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from './Hero';

const mockNavigate = jest.fn();

jest.mock('react-router', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Hero', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the decorative floating square field', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={false} />);

    const squares = screen.getAllByTestId('hero-floating-square');
    expect(squares.length).toBeGreaterThanOrEqual(8);
    expect(squares.every((square) => square.getAttribute('aria-hidden') === 'true')).toBe(true);
  });

  it('renders the CafeDuo headline', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={false} />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Kahve hazır. Oyun başlasın.'
    );
  });

  it('renders logged-out CTAs and triggers register/login callbacks', () => {
    const onLogin = jest.fn();
    const onRegister = jest.fn();

    render(<Hero onLogin={onLogin} onRegister={onRegister} isLoggedIn={false} />);

    expect(screen.getByText("CafeDuo'ya Başla")).toBeInTheDocument();
    expect(screen.getByText('Oturum Aç')).toBeInTheDocument();

    fireEvent.click(screen.getByText("CafeDuo'ya Başla"));
    fireEvent.click(screen.getByText('Oturum Aç'));

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('routes logged-in standard user to dashboard panel', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={true} userRole="user" />);

    fireEvent.click(screen.getByText('Panele Geç'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('routes admin user to admin panel', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={true} isAdmin={true} />);

    fireEvent.click(screen.getByText('Panele Geç'));
    expect(mockNavigate).toHaveBeenCalledWith('/admin');
  });

  it('routes cafe_admin user to cafe-admin panel', () => {
    render(
      <Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={true} userRole="cafe_admin" />
    );

    fireEvent.click(screen.getByText('Panele Geç'));
    expect(mockNavigate).toHaveBeenCalledWith('/cafe-admin');
  });
});
