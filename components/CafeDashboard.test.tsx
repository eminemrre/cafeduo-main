import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CafeDashboard } from './CafeDashboard';
import { api } from '../lib/api';
import { User } from '../types';

jest.mock('../lib/api', () => ({
  api: {
    cafes: {
      list: jest.fn(),
      updateLocation: jest.fn(),
    },
    rewards: {
      list: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    coupons: {
      use: jest.fn(),
    },
  },
}));

jest.mock('./RetroButton', () => ({
  RetroButton: ({ children, ...props }: any) => <button {...props}>{children}</button>,
}));

describe('CafeDashboard', () => {
  const currentUser: User = {
    id: 99,
    username: 'cafeadmin',
    email: 'admin@cafe.com',
    points: 0,
    wins: 0,
    gamesPlayed: 0,
    role: 'cafe_admin',
    cafe_id: 7,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (api.cafes.list as jest.Mock).mockResolvedValue([{ id: 7, latitude: 37.741, longitude: 29.101, radius: 150 }]);
    (api.rewards.list as jest.Mock).mockResolvedValue([
      { id: 1, title: 'Americano', description: 'Hot', cost: 120, icon: 'coffee' },
    ]);
    (api.coupons.use as jest.Mock).mockResolvedValue({
      success: true,
      item: { item_title: 'Latte', code: 'ABC123' },
    });
  });

  it('verifies coupon successfully', async () => {
    render(<CafeDashboard currentUser={currentUser} />);

    fireEvent.change(screen.getByPlaceholderText('Kupon kodunu girin...'), {
      target: { value: 'abc123' },
    });
    fireEvent.click(screen.getByText('KUPONU ONAYLA'));

    await waitFor(() => {
      expect(api.coupons.use).toHaveBeenCalledWith('ABC123');
    });
    expect(screen.getByText('Kupon başarıyla kullanıldı!')).toBeInTheDocument();
    expect(screen.getByText('Latte')).toBeInTheDocument();
  });

  it('shows coupon error from backend payload', async () => {
    (api.coupons.use as jest.Mock).mockRejectedValueOnce({
      response: { data: { error: 'Kupon geçersiz' } },
    });

    render(<CafeDashboard currentUser={currentUser} />);
    fireEvent.change(screen.getByPlaceholderText('Kupon kodunu girin...'), {
      target: { value: 'bad' },
    });
    fireEvent.click(screen.getByText('KUPONU ONAYLA'));

    await waitFor(() => {
      expect(screen.getByText('Kupon geçersiz')).toBeInTheDocument();
    });
  });

  it('loads rewards on rewards tab and creates reward', async () => {
    render(<CafeDashboard currentUser={currentUser} />);
    fireEvent.click(screen.getByText('Ödül Yönetimi'));

    await waitFor(() => {
      expect(api.rewards.list).toHaveBeenCalledTimes(1);
    });
    expect(screen.getByText('Americano')).toBeInTheDocument();

    const textboxes = screen.getAllByRole('textbox');
    fireEvent.change(textboxes[0], { target: { value: 'Muffin' } });
    fireEvent.change(screen.getByRole('spinbutton'), { target: { value: '200' } });
    fireEvent.change(textboxes[1], { target: { value: 'Chocolate' } });
    fireEvent.click(screen.getByText('Ödülü Oluştur'));

    await waitFor(() => {
      expect(api.rewards.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Muffin',
          cost: 200,
          description: 'Chocolate',
          cafeId: 7,
        })
      );
    });
  });

  it('deletes reward when trash action confirmed', async () => {
    const { container } = render(<CafeDashboard currentUser={currentUser} />);
    fireEvent.click(screen.getByText('Ödül Yönetimi'));

    await waitFor(() => {
      expect(screen.getByText('Americano')).toBeInTheDocument();
    });

    const deleteButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.className.includes('hover:text-red-500')
    );
    expect(deleteButton).toBeTruthy();
    fireEvent.click(deleteButton as HTMLButtonElement);
    await waitFor(() => {
      expect(api.rewards.delete).toHaveBeenCalledWith(1);
    });
  });

  it('validates coordinates before location update', async () => {
    render(<CafeDashboard currentUser={currentUser} />);
    fireEvent.click(screen.getByText('Konum Ayarları'));

    await waitFor(() => {
      expect(api.cafes.list).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Enlem (Latitude)'), {
      target: { value: '200' },
    });
    fireEvent.click(screen.getByText('KONUMU KAYDET'));

    expect(api.cafes.updateLocation).not.toHaveBeenCalled();
    expect(screen.getByText('Enlem -90 ile 90 arasında olmalıdır.')).toBeInTheDocument();
  });

  it('updates location when valid values are submitted', async () => {
    render(<CafeDashboard currentUser={currentUser} />);
    fireEvent.click(screen.getByText('Konum Ayarları'));

    await waitFor(() => {
      expect(api.cafes.list).toHaveBeenCalled();
    });

    fireEvent.change(screen.getByLabelText('Enlem (Latitude)'), {
      target: { value: '37.742001' },
    });
    fireEvent.change(screen.getByLabelText('Boylam (Longitude)'), {
      target: { value: '29.102001' },
    });
    fireEvent.change(screen.getByLabelText('Doğrulama Yarıçapı (metre)'), {
      target: { value: '220' },
    });
    fireEvent.click(screen.getByText('KONUMU KAYDET'));

    await waitFor(() => {
      expect(api.cafes.updateLocation).toHaveBeenCalledWith(7, {
        latitude: 37.742001,
        longitude: 29.102001,
        radius: 220,
        secondaryLatitude: null,
        secondaryLongitude: null,
        secondaryRadius: null,
      });
    });
    expect(screen.getByText('Kafe konumu güncellendi.')).toBeInTheDocument();
  });
});
