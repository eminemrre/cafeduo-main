import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { LandingPage, LandingFooter, LandingHeader } from './LandingPage';
import { FOOTER_COLUMNS, GAMES, MENU, SHOWCASE_TABS, SLIP } from './landingContent';

jest.mock('./ToyStage', () => ({
  ToyStage: () => <div data-testid="toy-stage" />,
}));

const renderLanding = (isLoggedIn = false) => {
  const props = { onJoin: jest.fn(), onLogin: jest.fn(), onLogout: jest.fn() };
  render(
    <MemoryRouter>
      <LandingHeader isLoggedIn={isLoggedIn} {...props} />
      <main>
        <LandingPage isLoggedIn={isLoggedIn} {...props} />
      </main>
      <LandingFooter />
    </MemoryRouter>
  );
  return props;
};

/**
 * The slip writes "150 m" with a non-breaking space so the number never splits from its unit;
 * the matcher treats either space as the same.
 */
const slipText = (value: string) =>
  new RegExp(
    `^${value
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\u00A0/g, '\\s')}$`
  );

describe('LandingPage', () => {
  it('keeps one sign-up action in the header, one beside the live table and the sentence at the close', () => {
    const { onJoin, onLogin } = renderLanding();
    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('button', { name: 'Kaydol' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Giriş yap' }));
    expect(onJoin).toHaveBeenCalledWith();
    expect(onLogin).toHaveBeenCalledTimes(1);
    // Header, showcase and the closing sentence: no other sign-up button on the page.
    expect(screen.getAllByRole('button', { name: 'Kaydol' })).toHaveLength(3);
    expect(screen.queryByRole('button', { name: /Zaten üyeyim/ })).not.toBeInTheDocument();
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
    expect(screen.queryByRole('button', { name: 'Giriş yap' })).not.toBeInTheDocument();
  });

  it('prints the steps as the order slip, with the real numbers', () => {
    renderLanding();
    for (const group of SLIP) {
      expect(screen.getByRole('heading', { level: 3, name: group.label })).toBeInTheDocument();
      for (const row of group.rows) {
        expect(screen.getByText(slipText(row.what))).toBeInTheDocument();
        expect(screen.getAllByText(row.value).length).toBeGreaterThan(0);
      }
    }
    expect(screen.getByText('Bittiğinde puan ve kupon hesabında')).toBeInTheDocument();
  });

  it('stacks the three real games as colour sheets', () => {
    renderLanding();
    for (const game of GAMES) {
      expect(screen.getByRole('heading', { level: 3, name: game.name })).toBeInTheDocument();
      expect(screen.getByText(game.text)).toBeInTheDocument();
      expect(screen.getByRole('img', { name: game.toyAlt })).toBeInTheDocument();
    }
  });

  it('switches what the live table explains without leaving the page', () => {
    renderLanding();
    expect(screen.getByRole('heading', { level: 2, name: SHOWCASE_TABS[0].title })).toBeVisible();
    for (const tab of SHOWCASE_TABS) {
      const button = screen.getByRole('button', { name: tab.label });
      fireEvent.click(button);
      expect(button).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('heading', { level: 2, name: tab.title })).toBeVisible();
      expect(screen.getByText(tab.text)).toBeVisible();
    }
  });

  it('fills the reward menu with the catalogue and the sample-price note', () => {
    renderLanding();
    const menu = screen.getByRole('region', { name: 'Menü' });
    for (const group of MENU) {
      expect(within(menu).getByText(group.label)).toBeInTheDocument();
      for (const item of group.items) {
        expect(within(menu).getByText(item.name)).toBeInTheDocument();
        expect(within(menu).getAllByText(`${item.cost} puan`).length).toBeGreaterThan(0);
      }
    }
    expect(within(menu).getByText(/fiyatlar örnektir/)).toBeInTheDocument();
  });

  it('passes the e-mail typed into the closing sentence to the sign-up modal', () => {
    const { onJoin } = renderLanding();
    const input = screen.getByLabelText('İlk 100 puanın için');
    fireEvent.change(input, { target: { value: 'emin@example.com' } });
    const form = input.closest('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form as HTMLFormElement);
    expect(onJoin).toHaveBeenLastCalledWith('emin@example.com');
  });

  it('keeps the footer links for social accounts, privacy and the café owners page', () => {
    renderLanding();
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('img', { name: 'CafeDuo' })).toBeInTheDocument();
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
    for (const column of FOOTER_COLUMNS) {
      expect(within(footer).getByRole('heading', { level: 2, name: column.label })).toBeVisible();
    }
  });
});
