import React from 'react';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders three-step flow with timing hints', () => {
    render(<HowItWorks />);

    expect(screen.getByText('Akışı 3 adımda çalıştır.')).toBeInTheDocument();

    expect(screen.getByText('Hesabını aç')).toBeInTheDocument();
    expect(screen.getByText('Masanı doğrula')).toBeInTheDocument();
    expect(screen.getByText('Yarış ve kazan')).toBeInTheDocument();

    expect(screen.getByText('20 sn')).toBeInTheDocument();
    expect(screen.getByText('15 sn')).toBeInTheDocument();
    expect(screen.getByText('45 sn')).toBeInTheDocument();
  });
});
