import React from 'react';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders three-step flow with timing hints', () => {
    render(<HowItWorks />);

    expect(screen.getByText('Akışı 3 adımda çalıştır.')).toBeInTheDocument();

    expect(screen.getAllByText('Hesabını aç').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Masanı doğrula').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Yarış ve kazan').length).toBeGreaterThan(0);

    expect(screen.getAllByText('20 sn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15 sn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('45 sn').length).toBeGreaterThan(0);
  });
});
