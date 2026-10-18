import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { TableMatchBoard } from './TableMatchBoard';
import { HERO_DISTRICTS } from './landingContent';

const renderBoard = (revealed = false) => {
  const onReply = jest.fn();
  const onReset = jest.fn();
  render(
    <TableMatchBoard
      district={HERO_DISTRICTS[0]}
      revealed={revealed}
      onReply={onReply}
      onReset={onReset}
    />
  );
  return { onReply, onReset };
};

describe('TableMatchBoard', () => {
  it('provides one Tab stop for the board and moves focus with arrow keys', () => {
    renderBoard();
    const start = screen.getByTestId('preview-square-g1');
    start.focus();
    fireEvent.keyDown(start, { key: 'ArrowUp' });
    expect(screen.getByTestId('preview-square-g2')).toHaveFocus();
    expect(screen.getByTestId('preview-square-g2')).toHaveAttribute('tabindex', '0');
    expect(start).toHaveAttribute('tabindex', '-1');
    // Moving right off the h-file does not wrap onto the next rank.
    const edge = screen.getByTestId('preview-square-h1');
    edge.focus();
    fireEvent.keyDown(edge, { key: 'ArrowRight' });
    expect(edge).toHaveFocus();
  });

  it('plays a legal move, lets MASA07 answer, reports the reply and resets', async () => {
    const { onReply, onReset } = renderBoard();
    fireEvent.click(screen.getByTestId('preview-square-g1'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true')
    );
    fireEvent.click(screen.getByTestId('preview-square-f3'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-f3')).toHaveAttribute('aria-label', 'f3, beyaz at')
    );
    expect(screen.getByLabelText('Oynanan hamleler')).toHaveTextContent('2. Nf3 d6');
    expect(screen.getByText(/MASA07 d6 ile yanıt verdi/)).toBeInTheDocument();
    expect(screen.getByText('MASA07 oynadı')).toBeInTheDocument();
    expect(onReply).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/puan kazanılmaz/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Baştan' }));
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-label', 'g1, beyaz at');
    expect(screen.getByLabelText('Oynanan hamleler')).toHaveTextContent('1. e4 c5');
  });

  it('keeps the piece in place when a destination is not legal', async () => {
    const { onReply } = renderBoard();
    fireEvent.click(screen.getByTestId('preview-square-g1'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'true')
    );
    fireEvent.click(screen.getByTestId('preview-square-g4'));
    await waitFor(() =>
      expect(screen.getByTestId('preview-square-g1')).toHaveAttribute('aria-pressed', 'false')
    );
    expect(screen.getByTestId('preview-square-g4')).toHaveAttribute('aria-label', 'g4, boş');
    expect(onReply).not.toHaveBeenCalled();
  });

  it('names the revealed district and credits its photograph', () => {
    renderBoard(true);
    const district = HERO_DISTRICTS[0];
    expect(screen.getByText(district.district)).toBeInTheDocument();
    const credit = screen.getByRole('link', { name: new RegExp(district.creator) });
    expect(credit).toHaveAttribute('href', district.source);
    expect(credit).toHaveTextContent(district.licence);
  });
});
