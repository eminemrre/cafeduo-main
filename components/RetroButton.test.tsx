import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { RetroButton } from './RetroButton';

describe('RetroButton', () => {
  it('renders with default props', () => {
    render(<RetroButton>Click me</RetroButton>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('handles click events', () => {
    const handleClick = jest.fn();
    render(<RetroButton onClick={handleClick}>Click me</RetroButton>);
    
    fireEvent.click(screen.getByRole('button', { name: 'Click me' }));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled when disabled prop is true', () => {
    render(<RetroButton disabled>Disabled</RetroButton>);
    expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled();
  });

  it('does not call onClick when disabled', () => {
    const handleClick = jest.fn();
    render(
      <RetroButton onClick={handleClick} disabled>
        Disabled
      </RetroButton>
    );
    
    fireEvent.click(screen.getByRole('button', { name: 'Disabled' }));
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('renders with different variants', () => {
    const { rerender } = render(<RetroButton variant="primary">Primary</RetroButton>);
    expect(screen.getByRole('button', { name: 'Primary' })).toBeInTheDocument();

    rerender(<RetroButton variant="secondary">Secondary</RetroButton>);
    expect(screen.getByRole('button', { name: 'Secondary' })).toBeInTheDocument();

    rerender(<RetroButton variant="danger">Danger</RetroButton>);
    expect(screen.getByRole('button', { name: 'Danger' })).toBeInTheDocument();
  });

  it('renders with different sizes', () => {
    const { rerender } = render(<RetroButton size="sm">Small</RetroButton>);
    expect(screen.getByRole('button', { name: 'Small' })).toBeInTheDocument();

    rerender(<RetroButton size="md">Medium</RetroButton>);
    expect(screen.getByRole('button', { name: 'Medium' })).toBeInTheDocument();

    rerender(<RetroButton size="lg">Large</RetroButton>);
    expect(screen.getByRole('button', { name: 'Large' })).toBeInTheDocument();
  });

  it('renders as submit button when type is submit', () => {
    render(<RetroButton type="submit">Submit</RetroButton>);
    expect(screen.getByRole('button', { name: 'Submit' })).toHaveAttribute('type', 'submit');
  });
});
