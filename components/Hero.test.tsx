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

    expect(screen.getByText(/Kafenin ritmini/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /HEMEN BAŞLA/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /GİRİŞ YAP/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /HEMEN BAŞLA/i }));
    fireEvent.click(screen.getByRole('button', { name: /GİRİŞ YAP/i }));

    expect(onRegister).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('routes logged-in standard user to dashboard panel', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={true} userRole="user" />);

    fireEvent.click(screen.getByRole('button', { name: /PANELE GEÇ/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('routes admin user to admin panel', () => {
    render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={true} isAdmin={true} />);

    fireEvent.click(screen.getByRole('button', { name: /PANELE GEÇ/i }));
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

    fireEvent.click(screen.getByRole('button', { name: /PANELE GEÇ/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/cafe-admin');
  });

  it('handles pointer move and leave events for parallax motion values', () => {
    const { container } = render(<Hero onLogin={jest.fn()} onRegister={jest.fn()} isLoggedIn={false} />);
    const heroSection = container.querySelector('#home') as HTMLElement;

    heroSection.getBoundingClientRect = () =>
      ({
        x: 0,
        y: 0,
        width: 1000,
        height: 700,
        top: 0,
        left: 0,
        right: 1000,
        bottom: 700,
        toJSON: () => ({}),
      }) as DOMRect;

    fireEvent.mouseMove(heroSection, { clientX: 500, clientY: 280 });
    fireEvent.mouseLeave(heroSection);

    expect(heroSection).toBeInTheDocument();
  });
});
