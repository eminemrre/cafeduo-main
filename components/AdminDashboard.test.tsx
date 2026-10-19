/**
 * AdminDashboard Component Tests
 *
 * Behavior-focused after the visual rewrite: queries target roles, labels,
 * data-testids, and stable strings (user/cafe names, status semantics) rather
 * than the brittle ALL-CAPS retro chrome of the previous design.
 *
 * window.confirm/alert replaced with ConfirmDialog (useConfirm) + Toast.
 * Tüm render çağrıları ToastProvider ile sarılıdır.
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminDashboard } from './AdminDashboard';
import { User } from '../types';
import * as apiModule from '../lib/api';
import { ToastProvider } from '../contexts/ToastContext';

jest.mock('../lib/api', () => ({
  api: {
    admin: {
      getUsers: jest.fn(),
      createUser: jest.fn(),
      deleteUser: jest.fn(),
      updateUserPoints: jest.fn(),
      getGames: jest.fn(),
      updateUserRole: jest.fn(),
      updateCafe: jest.fn(),
      createCafe: jest.fn(),
      deleteCafe: jest.fn(),
    },
    cafes: { list: jest.fn() },
    games: { delete: jest.fn() },
  },
}));

const renderWithProviders = (ui: React.ReactElement) => render(<ToastProvider>{ui}</ToastProvider>);

describe('AdminDashboard', () => {
  const mockCurrentUser: User = {
    id: 1,
    username: 'admin_user',
    email: 'admin@example.com',
    role: 'admin',
    isAdmin: true,
    points: 1000,
    wins: 50,
    gamesPlayed: 100,
    department: 'Bilgisayar',
  };

  const mockUsers = [
    {
      id: 1,
      username: 'user1',
      email: 'user1@test.com',
      role: 'user',
      points: 500,
      department: 'Makine',
      isAdmin: false,
    },
    {
      id: 2,
      username: 'cafe_admin1',
      email: 'cafe@test.com',
      role: 'cafe_admin',
      points: 300,
      department: 'Elektrik',
      isAdmin: false,
      cafe_name: 'Kafe 1',
    },
  ];

  const mockGames = [
    {
      id: 1,
      host_name: 'user1',
      guest_name: 'user2',
      game_type: 'tictactoe',
      status: 'finished',
      created_at: '2024-01-01',
      cafe_name: 'Kafe 1',
      table_code: 'A1',
    },
    {
      id: 2,
      host_name: 'user3',
      guest_name: null,
      game_type: 'arena',
      status: 'waiting',
      created_at: '2024-01-02',
      cafe_name: 'Kafe 2',
      table_code: 'B2',
    },
  ];

  const mockCafes = [
    { id: 1, name: 'Kafe 1', address: 'Adres 1', total_tables: 20, pin: '1234' },
    { id: 2, name: 'Kafe 2', address: 'Adres 2', total_tables: 15, pin: '5678' },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (apiModule.api.admin.getUsers as jest.Mock).mockResolvedValue(mockUsers);
    (apiModule.api.admin.getGames as jest.Mock).mockResolvedValue(mockGames);
    (apiModule.api.cafes.list as jest.Mock).mockResolvedValue(mockCafes);
    (apiModule.api.admin.updateCafe as jest.Mock).mockResolvedValue({});
    (apiModule.api.admin.deleteCafe as jest.Mock).mockResolvedValue({
      success: true,
      deletedCafe: { id: 1, name: 'Kafe 1' },
      cleanup: {
        detachedUsers: 1,
        cafeAdminsDemoted: 1,
        rewardsDeleted: 2,
        gamesForceClosed: 1,
      },
    });
  });

  it('renders dashboard heading and current admin username', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Yönetim' })).toBeInTheDocument();
      expect(screen.getByText(/admin_user/)).toBeInTheDocument();
    });
  });

  it('renders all tab buttons', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Kullanıcılar/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Oyunlar/ })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Kafeler/ })).toBeInTheDocument();
    });
  });

  it('displays users in users tab by default', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('cafe_admin1')).toBeInTheDocument();
    });
  });

  it('switches to games tab when clicked', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Oyunlar/ }));

    await waitFor(() => {
      // Game rows surface host names on the games tab
      expect(screen.getByText(/user1/)).toBeInTheDocument();
      expect(screen.getByText(/user3/)).toBeInTheDocument();
    });
  });

  it('switches to cafes tab when clicked', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      // The selected cafe's location editor appears
      expect(screen.getByRole('heading', { name: 'Haritadan konum seç' })).toBeInTheDocument();
    });
  });

  it('shows user roles with correct badges', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('Oyuncu')).toBeInTheDocument();
      expect(screen.getByText('Kafe yöneticisi')).toBeInTheDocument();
    });
  });

  it('filters users by search term', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText(/Kullanıcı adı veya e-posta ara/i);
    fireEvent.change(searchInput, { target: { value: 'cafe' } });

    await waitFor(() => {
      expect(screen.queryByText('user1')).not.toBeInTheDocument();
      expect(screen.getByText('cafe_admin1')).toBeInTheDocument();
    });
  });

  it('shows promote button for regular users', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    await waitFor(() => {
      const promoteButtons = screen.queryAllByRole('button', { name: /Yönetici Yap/ });
      expect(promoteButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows demote button for cafe admins', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Yetkiyi Al/ })).toBeInTheDocument();
    });
  });

  it('opens cafe admin modal when promoting user', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    const promoteButtons = screen.queryAllByRole('button', { name: /Yönetici Yap/ });
    expect(promoteButtons.length).toBeGreaterThan(0);

    fireEvent.click(promoteButtons[0]);

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kafe Yöneticisi Ata' })).toBeInTheDocument();
    });
  });

  it('confirms demotion via dialog and calls API', async () => {
    (apiModule.api.admin.updateUserRole as jest.Mock).mockResolvedValue({});

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Yetkiyi Al/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Yetkiyi Al/ }));

    // ConfirmDialog açılır — "Evet" butonuna tıkla
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Evet/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Evet/ }));

    await waitFor(() => {
      expect(apiModule.api.admin.updateUserRole).toHaveBeenCalledWith(2, 'user', null);
    });
  });

  it('shows game status badges', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Oyunlar/ }));

    await waitFor(() => {
      expect(screen.getByText('Tamamlandı')).toBeInTheDocument();
      expect(screen.getByText('Devam ediyor')).toBeInTheDocument();
    });
  });

  it('shows delete game button', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Oyunlar/ }));

    await waitFor(() => {
      const deleteButtons = screen.queryAllByRole('button', { name: /^Sil$/ });
      expect(deleteButtons.length).toBeGreaterThan(0);
    });
  });

  it('confirms before deleting game and calls API', async () => {
    (apiModule.api.games.delete as jest.Mock).mockResolvedValue({});

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Oyunlar/ }));

    await waitFor(() => {
      expect(screen.queryAllByRole('button', { name: /^Sil$/ }).length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.queryAllByRole('button', { name: /^Sil$/ })[0]);

    // ConfirmDialog içeriği 'Geri alınamaz' geçiyor
    await waitFor(() => {
      expect(screen.getByText(/Geri alınamaz/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Evet/ }));

    await waitFor(() => {
      expect(apiModule.api.games.delete).toHaveBeenCalled();
    });
  });

  it('shows cafe edit form when a cafe is selected', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      // Selected cafe surfaces its name in the detail card heading
      expect(screen.getByRole('heading', { name: 'Kafe 1' })).toBeInTheDocument();
    });
  });

  it('updates selected cafe with parsed location values', async () => {
    (apiModule.api.cafes.list as jest.Mock).mockResolvedValueOnce([
      {
        id: 11,
        name: 'Konumlu Kafe',
        address: 'Eski adres',
        total_tables: 12,
        latitude: '37.739058',
        longitude: '29.103837',
        radius: 500,
        secondary_latitude: '37.739100',
        secondary_longitude: '29.103900',
        secondary_radius: 300,
      },
      { id: 12, name: 'Yedek Kafe', address: 'Adres', total_tables: 8, pin: '5678' },
    ]);

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Haritadan konum seç' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByRole('slider'), { target: { value: '720' } });
    fireEvent.click(screen.getByRole('button', { name: /Değişiklikleri Kaydet/ }));

    await waitFor(() => {
      expect(apiModule.api.admin.updateCafe).toHaveBeenCalledWith(
        11,
        expect.objectContaining({
          address: 'Eski adres',
          total_tables: 12,
          latitude: 37.739058,
          longitude: 29.103837,
          radius: 720,
          secondary_latitude: 37.7391,
          secondary_longitude: 29.1039,
          secondary_radius: 300,
        })
      );
    });
  });

  it('shows add cafe button', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Yeni Kafe/ })).toBeInTheDocument();
    });
  });

  it('shows delete cafe button in cafes tab', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      expect(screen.getByTestId('delete-cafe-button')).toBeInTheDocument();
    });
  });

  it('deletes selected cafe when confirmed via dialog', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      expect(screen.getByTestId('delete-cafe-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('delete-cafe-button'));

    // ConfirmDialog açılır — onay ver
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Evet/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Evet/ }));

    await waitFor(() => {
      expect(apiModule.api.admin.deleteCafe).toHaveBeenCalledWith(1);
    });
  });

  it('disables delete cafe button when only one cafe exists', async () => {
    (apiModule.api.cafes.list as jest.Mock).mockResolvedValueOnce([
      { id: 9, name: 'Tek Kafe', address: 'Adres', total_tables: 10, pin: '1234' },
    ]);

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() => {
      expect(screen.getByTestId('delete-cafe-button')).toBeDisabled();
    });

    expect(screen.getByText(/Güvenlik kuralı: Son kafe silinemez./)).toBeInTheDocument();
  });

  it('opens add cafe modal when clicking add button', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByRole('button', { name: /Kafeler/ }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Yeni Kafe/ })).toBeInTheDocument()
    );

    fireEvent.click(screen.getByRole('button', { name: /Yeni Kafe/ }));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kafe Ekle' })).toBeInTheDocument();
    });
  });

  it('loads data on mount', async () => {
    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(apiModule.api.admin.getUsers).toHaveBeenCalled();
      expect(apiModule.api.admin.getGames).toHaveBeenCalled();
      expect(apiModule.api.cafes.list).toHaveBeenCalled();
    });
  });

  it('updates user points from users table', async () => {
    (apiModule.api.admin.updateUserPoints as jest.Mock).mockResolvedValue({});

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    const pointsInput = screen.getByLabelText('user1 puan');
    fireEvent.change(pointsInput, { target: { value: '875' } });

    const saveButtons = screen.getAllByRole('button', { name: /kaydet/i });
    fireEvent.click(saveButtons[0]);

    await waitFor(() => {
      expect(apiModule.api.admin.updateUserPoints).toHaveBeenCalledWith(1, 875);
    });
  });

  it('deletes user when confirmed via dialog', async () => {
    (apiModule.api.admin.deleteUser as jest.Mock).mockResolvedValue({});

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    // Two non-admin users → two delete buttons in the user table; click the second (cafe_admin1, id=2).
    const deleteButtons = screen.getAllByRole('button', { name: /^Sil$/ });
    fireEvent.click(deleteButtons[1]);

    // ConfirmDialog açılır — onay ver
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Evet/ })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: /Evet/ }));

    await waitFor(() => {
      expect(apiModule.api.admin.deleteUser).toHaveBeenCalledWith(2);
    });
  });

  it('creates new user from modal', async () => {
    (apiModule.api.admin.createUser as jest.Mock).mockResolvedValue({ id: 99 });

    renderWithProviders(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Yeni Kullanıcı/i }));
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Yeni Kullanıcı Ekle' })).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText(/Kullanıcı Adı/), { target: { value: 'newguy' } });
    fireEvent.change(screen.getByLabelText(/E-posta/), {
      target: { value: 'newguy@test.com' },
    });
    fireEvent.change(screen.getByLabelText(/Şifre/), { target: { value: 'secret123' } });
    fireEvent.click(screen.getByRole('button', { name: /Kullanıcıyı Ekle/ }));

    await waitFor(() => {
      expect(apiModule.api.admin.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          username: 'newguy',
          email: 'newguy@test.com',
          password: 'secret123',
          role: 'user',
        })
      );
    });
  });
});
