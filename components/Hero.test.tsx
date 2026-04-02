import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from './Hero';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

describe('Hero', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the new slogan "Kafenin Oyun Platformu"', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={false} />);

    expect(screen.getByText('Kafenin')).toBeInTheDocument();
    expect(screen.getByText('Oyun Platformu')).toBeInTheDocument();
  });

  it('renders logged-out CTAs and triggers register/login callbacks', () => {
    const onLogin = jest.fn();
    const onRegister = jest.fn();

    render(<Hero onLogin={onLogin} onRegister={onRegister} isLoggedIn={false} />);

    expect(screen.getByText('OYUNA GİR')).toBeInTheDocument();
    expect(screen.getByText('OTURUM AÇ')).toBeInTheDocument();

    fireEvent.click(screen.getByText('OYUNA GİR'));
    fireEvent.click(screen.getByText('OTURUM AÇ'));

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
      <Hero
        onLogin={jest.fn()}
        onRegister={jest.fn()}
        isLoggedIn={true}
        userRole="cafe_admin"
      />
    );

    fireEvent.click(screen.getByText('Panele Geç'));
    expect(mockNavigate).toHaveBeenCalledWith('/cafe-admin');
  });
});
