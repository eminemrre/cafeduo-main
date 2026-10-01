import React from 'react';
import { render, screen } from '@testing-library/react';
import { HowItWorks } from './HowItWorks';

describe('HowItWorks', () => {
  it('renders three-step flow in the correct order', () => {
    render(<HowItWorks />);

    expect(screen.getByTestId('flow-main-heading')).toHaveTextContent(
      '3 adımda eşleş, oyna, ödüle yaklaş.'
    );

    expect(screen.getAllByText('Hesabını aç').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Kafeye bağlan').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Eşleş ve kazan').length).toBeGreaterThan(0);

    expect(screen.getByTestId('how-step-01')).toHaveTextContent('Hesabını aç');
    expect(screen.getByTestId('how-step-02')).toHaveTextContent('Kafeye bağlan');
    expect(screen.getByTestId('how-step-03')).toHaveTextContent('Eşleş ve kazan');
  });
});
