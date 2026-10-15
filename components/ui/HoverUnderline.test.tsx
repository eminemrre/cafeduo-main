import React from 'react';
import { render, screen } from '@testing-library/react';
import { HoverUnderline } from './HoverUnderline';

describe('HoverUnderline', () => {
  it('renders the label and a decorative ink path', () => {
    render(<HoverUnderline>ÖZELLİKLER</HoverUnderline>);

    expect(screen.getByText('ÖZELLİKLER')).toBeInTheDocument();

    const svg = document.querySelector('svg[aria-hidden="true"]');
    expect(svg).not.toBeNull();

    const path = svg?.querySelector('path');
    expect(path?.getAttribute('d')).toContain('C');
    expect(path?.getAttribute('stroke')).toBe('currentColor');
  });

  it('keeps the underline out of the accessibility tree and pointer events', () => {
    render(<HoverUnderline>OYUNLAR</HoverUnderline>);

    const svg = document.querySelector('svg');
    expect(svg?.getAttribute('aria-hidden')).toBe('true');
    expect(svg?.getAttribute('class')).toContain('pointer-events-none');
  });
});
