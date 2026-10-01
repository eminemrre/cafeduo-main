import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ClubBoardPreview } from './ClubBoardPreview';

describe('ClubBoardPreview', () => {
  it('provides one Tab stop for the board and moves focus with arrow keys', () => {
    render(<ClubBoardPreview />);
    const start = screen.getByTestId('preview-square-g1');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowUp' });
    expect(screen.getByTestId('preview-square-g2')).toHaveFocus();
    expect(screen.getByTestId('preview-square-g2')).toHaveAttribute('tabindex', '0');
    expect(start).toHaveAttribute('tabindex', '-1');
  });

  it('plays a legal white move, replies as black, and resets the position', async () => {
    render(<ClubBoardPreview />);
    const knight = screen.getByTestId('preview-square-g1');
    knight.focus();
    fireEvent.click(knight);
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true')
    );
    expect(knight).toHaveFocus();
    fireEvent.click(screen.getByTestId('preview-square-f3'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-f3')).toHaveAttribute('aria-label', 'f3, beyaz at')
    );
    expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-label', 'g1, boş');
    expect(screen.getByLabelText('Oynanan hamleler')).toHaveTextContent('2. Nf3 d6');
    expect(screen.getByText(/puan kazanılmaz/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Baştan' }));
    expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-label', 'g1, beyaz at');
    expect(screen.getByTestId('preview-square-f3')).toHaveAttribute('aria-label', 'f3, boş');
  });

  it('keeps the piece in place when a destination is not legal', async () => {
    render(<ClubBoardPreview />);
    fireEvent.click(screen.getByTestId('preview-square-g1'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true')
    );
    fireEvent.click(screen.getByTestId('preview-square-g4'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'false')
    );
    expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-label', 'g1, beyaz at');
    expect(screen.getByTestId('preview-square-g4')).toHaveAttribute('aria-label', 'g4, boş');
  });
});
