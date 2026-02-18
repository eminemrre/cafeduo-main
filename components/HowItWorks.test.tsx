import React from 'react';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders three-step flow with timing hints', () => {
    render(<HowItWorks />);

    expect(screen.getByTestId('flow-main-heading')).toHaveTextContent(
      '3 adımda eşleş, oyna, ödüle yaklaş.'
    );

    expect(screen.getAllByText('Hesabını aç').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kafeye bağlan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eşleş ve kazan').length).toBeGreaterThan(0);

    expect(screen.getAllByText('20 sn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('15 sn').length).toBeGreaterThan(0);
    expect(screen.getAllByText('45 sn').length).toBeGreaterThan(0);
  });
});
