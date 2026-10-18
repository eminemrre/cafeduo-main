import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ClubLanding, LandingFooter, LandingHeader } from './ClubLanding';
import { CREDITS, HERO_DISTRICTS } from './landingContent';

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
  it('keeps the join and login actions in the header and repeats them in the hero and close', () => {
    const { onJoin, onLogin } = renderLanding();
    const header = screen.getByRole('banner');
    fireEvent.click(within(header).getByRole('button', { name: 'Masaya katıl' }));
    fireEvent.click(within(header).getByRole('button', { name: 'Giriş yap' }));
    expect(screen.getAllByRole('button', { name: 'Masaya katıl' })).toHaveLength(3);
    fireEvent.click(screen.getByRole('button', { name: 'Zaten üyeyim' }));
    expect(onJoin).toHaveBeenCalledTimes(1);
    expect(onLogin).toHaveBeenCalledTimes(2);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Yan masayla oyna.Kafede harca.'
    );
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

  it('brings the first district into focus after MASA07 replies', async () => {
    renderLanding();
    expect(screen.getByText(/MASA07’nin yanıtı bir İzmir semtini/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('preview-square-g1'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true')
    );
    fireEvent.click(screen.getByTestId('preview-square-f3'));
    expect(await screen.findByText(HERO_DISTRICTS[0].district)).toBeInTheDocument();
    expect(screen.getByText(`Fotoğraf netleşti: ${HERO_DISTRICTS[0].alt}.`)).toBeInTheDocument();
  });

  it('switches the showcase caption with the row controls', () => {
    renderLanding();
    const showcase = screen.getByRole('region', { name: 'Oyunlar ve ödüller' });
    expect(within(showcase).getByText('1 / 5')).toBeInTheDocument();
    expect(within(showcase).getByRole('button', { name: 'Önceki' })).toBeDisabled();
    fireEvent.click(within(showcase).getByRole('button', { name: 'Sonraki' }));
    expect(within(showcase).getByText('2 / 5')).toBeInTheDocument();
    expect(within(showcase).getByText(/On kısa soru/)).toBeInTheDocument();
  });

  it('lists the districts honestly and credits every found picture', () => {
    renderLanding();
    expect(screen.getByText(/kafeleri değil/)).toBeInTheDocument();
    expect(screen.getByText('Ege Üniversitesi')).toBeInTheDocument();
    for (const credit of CREDITS) {
      const link = screen.getByRole('link', { name: `${credit.label}, ${credit.creator}` });
      expect(link).toHaveAttribute('href', credit.source);
    }
    expect(screen.getByText(/hiçbiri CafeDuo’nun ortak kafesi değildir/)).toBeInTheDocument();
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
