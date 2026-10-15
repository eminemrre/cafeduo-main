import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProfileActivity } from './ProfileActivity';
import type { useProfileData } from '../../hooks/useProfileData';

type Props = ReturnType<typeof useProfileData>;
const props = (): Props => ({
  history: { owner: '7:emin', status: 'success', data: [] },
  inventory: { owner: '7:emin', status: 'success', data: [] },
  retryHistory: jest.fn(),
  retryInventory: jest.fn(),
});

it('shows actual win, loss, draw and date data without inventing point gains', () => {
  const value = props();
  value.history.data = [
    {
      id: 1,
      gameType: 'Nişancı Düellosu',
      points: 50,
      status: 'finished',
      table: '7',
      opponentName: 'deniz',
      winner: 'emin',
      didWin: true,
      createdAt: '2026-10-02T09:00:00Z',
    },
    {
      id: 2,
      gameType: 'Bilgi Yarışı',
      points: 20,
      status: 'finished',
      table: '7',
      opponentName: 'ege',
      winner: 'ege',
      didWin: false,
      createdAt: 'invalid',
    },
    {
      id: 3,
      gameType: 'Retro Satranç',
      points: 0,
      status: 'finished',
      table: '7',
      opponentName: 'ada',
      winner: null,
      didWin: false,
      createdAt: '2026-10-01T09:00:00Z',
    },
  ];
  render(<ProfileActivity {...value} />);
  for (const text of ['Galibiyet', 'Mağlubiyet', 'Beraberlik', 'Rakip: deniz', 'Tarih bilgisi yok'])
    expect(screen.getByText(text)).toBeInTheDocument();
  expect(screen.queryByText('+50')).not.toBeInTheDocument();
  expect(
    screen.getByRole('region', { name: 'Son oyunların' }).querySelector('time')
  ).toHaveAttribute('datetime', '2026-10-02T09:00:00.000Z');
});

it('distinguishes loading, genuine emptiness and retryable errors while preserving focus', () => {
  const value = props();
  value.history.status = 'loading';
  value.inventory.status = 'loading';
  const { rerender } = render(<ProfileActivity {...value} />);
  expect(screen.getAllByRole('status')).toHaveLength(2);
  rerender(<ProfileActivity {...props()} />);
  expect(screen.getByText('Henüz envanterinde bir ürün yok.')).toBeInTheDocument();
  expect(
    screen.getByText('İlk oyunundan sonra sonuçlarını burada görebilirsin.')
  ).toBeInTheDocument();
  value.history.status = 'error';
  value.inventory.status = 'error';
  rerender(<ProfileActivity {...value} />);
  expect(screen.getAllByRole('alert')).toHaveLength(2);
  fireEvent.click(screen.getByRole('button', { name: 'Oyun geçmişini yeniden yükle' }));
  expect(value.retryHistory).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('region', { name: 'Son oyunların' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Envanteri yeniden yükle' }));
  expect(value.retryInventory).toHaveBeenCalledTimes(1);
  expect(screen.getByRole('region', { name: 'Envanterin' })).toHaveFocus();
});
