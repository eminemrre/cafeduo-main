import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TermsUpdateBanner } from './TermsUpdateBanner';
import { api } from '../../lib/api';

jest.mock('../../lib/api', () => ({ api: { auth: { acceptTerms: jest.fn() } } }));

describe('TermsUpdateBanner', () => {
  beforeEach(() => jest.clearAllMocks());
  it('does not record agreement without an explicit action', () => {
    render(<TermsUpdateBanner termsVersion={null} onAccepted={jest.fn()} />);
    expect(screen.getByRole('link', { name: 'Kullanım koşulları' })).toHaveAttribute(
      'href',
      '/kosullar'
    );
    expect(api.auth.acceptTerms).not.toHaveBeenCalled();
  });

  it('acknowledges only after the server confirms the displayed version', async () => {
    const receipt = { termsVersion: '2026-10-27', termsAcceptedAt: '2026-10-27T12:00:00.000Z' };
    (api.auth.acceptTerms as jest.Mock).mockResolvedValueOnce(receipt);
    const onAccepted = jest.fn();
    render(<TermsUpdateBanner termsVersion={null} onAccepted={onAccepted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Okudum, kabul ediyorum' }));
    await waitFor(() => expect(onAccepted).toHaveBeenCalledWith(receipt));
    expect(api.auth.acceptTerms).toHaveBeenCalledWith('2026-10-27');
  });

  it('keeps a failed acknowledgement visible and allows retry', async () => {
    (api.auth.acceptTerms as jest.Mock).mockRejectedValueOnce(
      new Error('Koşul kabulü kaydedilemedi.')
    );
    const onAccepted = jest.fn();
    render(<TermsUpdateBanner termsVersion="old" onAccepted={onAccepted} />);
    fireEvent.click(screen.getByRole('button', { name: 'Okudum, kabul ediyorum' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Koşul kabulü kaydedilemedi.');
    expect(onAccepted).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Okudum, kabul ediyorum' })).toBeEnabled();
  });

  it('does not show the notice for the current version', () => {
    render(<TermsUpdateBanner termsVersion="2026-10-27" onAccepted={jest.fn()} />);
    expect(
      screen.queryByRole('button', { name: 'Okudum, kabul ediyorum' })
    ).not.toBeInTheDocument();
  });
});
