import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Navbar } from './Navbar';

const mockNavigate = jest.fn();
const mockUseLocation = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  useLocation: () => mockUseLocation(),
}));

jest.mock('framer-motion', () => ({
  motion: {
    button: ({ children, onClick, ...props }: any) => <button onClick={onClick} {...props}>{children}</button>,
    div: ({ children, onClick, ...props }: any) => <div onClick={onClick} {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Dummy constants
jest.mock('../constants', () => ({
  NAV_ITEMS: [
    { id: 'features', label: 'ÖZELLİKLER' },
    { id: 'games', label: 'OYUNLAR' }
  ]
}));

describe('Navbar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseLocation.mockReturnValue({ pathname: '/' });
    document.body.style.overflow = '';
  });

  it('renders public nav items when logged out', () => {
    render(<Navbar isLoggedIn={false} />);
    expect(screen.getByText('CafeDuo')).toBeInTheDocument();
    expect(screen.getByText('ÖZELLİKLER')).toBeInTheDocument();
  });

  it('scrolls to section on same page for logged out users', () => {
    const section = document.createElement('div');
    section.id = 'features';
    section.scrollIntoView = jest.fn();
    document.body.appendChild(section);

    render(<Navbar isLoggedIn={false} />);
    fireEvent.click(screen.getByText('ÖZELLİKLER'));

    expect(section.scrollIntoView).toHaveBeenCalled();
    section.remove();
  });

  it('navigates to home before scrolling when not on home route', () => {
    jest.useFakeTimers();
    mockUseLocation.mockReturnValue({ pathname: '/dashboard' });

    const section = document.createElement('div');
    section.id = 'games';
    section.scrollIntoView = jest.fn();
    document.body.appendChild(section);

    render(<Navbar isLoggedIn={false} />);
    fireEvent.click(screen.getByText('OYUNLAR'));

    expect(mockNavigate).toHaveBeenCalledWith('/');
    act(() => {
      jest.advanceTimersByTime(120);
    });
    expect(section.scrollIntoView).toHaveBeenCalled();
    section.remove();
    jest.useRealTimers();
  });

  it('shows logout action and triggers callback for logged in users', () => {
    const onLogout = jest.fn();
    render(<Navbar isLoggedIn={true} onLogout={onLogout} />);

    fireEvent.click(screen.getByTestId('logout-button'));
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
