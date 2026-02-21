import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { Hero } from './Hero';

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('./ABTest', () => ({
  ABTest: ({ variantA }: { variantA: React.ReactNode }) => <>{variantA}</>,
}));

jest.mock('framer-motion', () => {
  const ReactLib = require('react');
  const stripMotionProps = (props: Record<string, unknown>) => {
    const {
      initial,
      animate,
      exit,
      transition,
      whileInView,
      whileHover,
      whileTap,
      viewport,
      ...rest
    } = props;
    return rest;
  };

  const motion = new Proxy(
    {},
    {
      get: (_target, key) => {
        const tag = typeof key === 'string' ? key : 'div';
        return ({ children, ...props }: any) =>
          ReactLib.createElement(tag, stripMotionProps(props), children);
      },
    }
  );

  return {
    motion,
    useMotionValue: () => ({ set: jest.fn(), get: () => 0 }),
    useSpring: (value: unknown) => value,
    useTransform: () => '50%',
    useScroll: () => ({ scrollYProgress: 0 }),
    useReducedMotion: () => false,
  };
});

describe('Hero', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders logged-out CTAs and triggers register/login callbacks', () => {
    const onLogin = jest.fn();
    const onRegister = jest.fn();

    render(<Hero onLogin={onLogin} onRegister={onRegister} isLoggedIn={false} />);

    expect(screen.getByText('BEKLEME')).toBeInTheDocument();
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
