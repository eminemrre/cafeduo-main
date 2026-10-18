import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ClubLanding, LandingFooter, LandingHeader } from './ClubLanding';
import { GAMES, REWARDS, STEPS } from './landingContent';

jest.mock('./ToyStage', () => ({
  ToyStage: () => <div data-testid="toy-stage" />,
}));

const renderLanding = (isLoggedIn = false) => {
  const props = { onJoin: jest.fn(), onLogin: jest.fn(), onLogout: jest.fn() };
  render(
    <MemoryRouter>
      <LandingHeader isLoggedIn={isLoggedIn} {...props} />
      <main>
        <ClubLanding isLoggedIn={isLoggedIn} {...props} />
      </main>
      <LandingFooter />
    </MemoryRouter>
  );
  return props;
};

describe('ClubLanding', () => {
  it('keeps join and login in the header and repeats join in the hero and the close', () => {
    const { onJoin, onLogin } = renderLanding();
    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('button', { name: 'Masaya katıl' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Giriş yap' }));
    expect(screen.getAllByRole('button', { name: 'Masaya katıl' })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Zaten üyeyim' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Rakibin yan masada.');
    expect(screen.getByTestId('toy-stage')).toBeInTheDocument();
  });

  it('offers the player panel and logout to a signed-in visitor', () => {
    const { onJoin, onLogout } = renderLanding(true);
    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('button', { name: 'Panele geç' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Çıkış yap' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onLogout).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Zaten üyeyim' })).not.toBeInTheDocument();
  });

  it('shows the three real games, the real reward catalogue and the steps', () => {
    renderLanding();
    for (const game of GAMES) {
      expect(screen.getByRole('heading', { level: 3, name: game.name })).toBeInTheDocument();
      expect(screen.getByText(game.meta)).toBeInTheDocument();
    }
    const rewards = screen.getByRole('region', { name: 'Puanın kafede ödüle döner' });
    for (const reward of REWARDS) {
      expect(within(rewards).getByText(reward.name)).toBeInTheDocument();
      expect(within(rewards).getByText(`${reward.cost} puan`)).toBeInTheDocument();
    }
    expect(within(rewards).getByText(/Her yeni üye 100 puanla başlar/)).toBeInTheDocument();
    expect(within(rewards).getByText(/Örnek kupon/)).toBeInTheDocument();
    for (const step of STEPS) {
      expect(screen.getByRole('heading', { level: 3, name: step.title })).toBeInTheDocument();
    }
  });

  it('keeps the footer links for social accounts, privacy and the café owners page', () => {
    renderLanding();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'Instagram' })).toHaveAttribute(
      'href',
      'https://instagram.com/cafeduotr'
    );
    expect(within(footer).getByRole('link', { name: /Twitter/ })).toHaveAttribute(
      'href',
      'https://x.com/cafeduotr'
    );
    expect(within(footer).getByRole('link', { name: 'Gizlilik' })).toHaveAttribute(
      'href',
      '/gizlilik'
    );
    expect(within(footer).getByRole('link', { name: 'Kafeler için' })).toHaveAttribute(
      'href',
      '/kafeler'
    );
  });
});
