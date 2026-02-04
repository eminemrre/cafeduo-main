/**
 * AdminDashboard Component Tests
 * 
 * @description Admin panel CRUD operations tests
 */

import React from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminDashboard } from './AdminDashboard';
import * as apiModule from '../lib/api';

// Mock api
jest.mock('../lib/api', () => ({
  api: {
    admin: {
      getUsers: jest.fn(),
      getGames: jest.fn(),
      updateUserRole: jest.fn(),
      updateCafe: jest.fn(),
      createCafe: jest.fn(),
    },
    cafes: {
      list: jest.fn(),
    },
    games: {
      delete: jest.fn(),
    },
  },
}));

// Mock window.alert
Object.defineProperty(window, 'alert', {
  writable: true,
  value: jest.fn(),
});

// Mock window.confirm
Object.defineProperty(window, 'confirm', {
  writable: true,
  value: jest.fn(),
});

describe('AdminDashboard', () => {
  const mockCurrentUser = {
    id: 1,
    username: 'admin_user',
    email: 'admin@example.com',
    role: 'admin',
    isAdmin: true,
    points: 1000,
    department: 'Bilgisayar',
  };

  const mockUsers = [
    { id: 1, username: 'user1', email: 'user1@test.com', role: 'user', points: 500, department: 'Makine', isAdmin: false },
    { id: 2, username: 'cafe_admin1', email: 'cafe@test.com', role: 'cafe_admin', points: 300, department: 'Elektrik', isAdmin: false, cafe_name: 'Kafe 1' },
  ];

  const mockGames = [
    { id: 1, host_name: 'user1', guest_name: 'user2', game_type: 'tictactoe', status: 'finished', created_at: '2024-01-01', cafe_name: 'Kafe 1', table_code: 'A1' },
    { id: 2, host_name: 'user3', guest_name: null, game_type: 'arena', status: 'waiting', created_at: '2024-01-02', cafe_name: 'Kafe 2', table_code: 'B2' },
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
  });

  it('renders dashboard title and admin username', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('YÖNETİM PANELİ')).toBeInTheDocument();
      expect(screen.getByText(/SİSTEM YÖNETİCİSİ: admin_user/)).toBeInTheDocument();
    });
  });

  it('renders all tab buttons', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('Kullanıcılar')).toBeInTheDocument();
      expect(screen.getByText('Oyunlar')).toBeInTheDocument();
      expect(screen.getByText('Kafeler')).toBeInTheDocument();
    });
  });

  it('displays users in users tab by default', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
      expect(screen.getByText('cafe_admin1')).toBeInTheDocument();
    });
  });

  it('switches to games tab when clicked', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('Kullanıcı Listesi')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Oyunlar'));

    await waitFor(() => {
      expect(screen.getByText('Oyun Geçmişi')).toBeInTheDocument();
      expect(screen.getByText(/user1 vs/)).toBeInTheDocument();
    });
  });

  it('switches to cafes tab when clicked', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('Kullanıcı Listesi')).toBeInTheDocument());

    fireEvent.click(screen.getByText('Kafeler'));

    await waitFor(() => {
      expect(screen.getByText('Kafe Yönetimi')).toBeInTheDocument();
    });
  });

  it('shows user roles with correct badges', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('USER')).toBeInTheDocument();
      expect(screen.getByText('CAFE ADMIN')).toBeInTheDocument();
    });
  });

  it('filters users by search term', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('user1')).toBeInTheDocument());

    const searchInput = screen.getByPlaceholderText('Ara...');
    fireEvent.change(searchInput, { target: { value: 'cafe' } });

    await waitFor(() => {
      expect(screen.queryByText('user1')).not.toBeInTheDocument();
      expect(screen.getByText('cafe_admin1')).toBeInTheDocument();
    });
  });

  it('shows promote button for regular users', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    // Wait for users to be rendered in the table
    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    // Wait a bit more for buttons to render
    await waitFor(() => {
      const promoteButtons = screen.queryAllByText('YÖNETİCİ YAP');
      expect(promoteButtons.length).toBeGreaterThan(0);
    });
  });

  it('shows demote button for cafe admins', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(screen.getByText('YÖNETİCİLİĞİ AL')).toBeInTheDocument();
    });
  });

  it('opens cafe admin modal when promoting user', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    // Wait for all data to fully load including cafes
    await waitFor(() => {
      expect(screen.getByText('Kullanıcı Listesi')).toBeInTheDocument();
    });

    // Wait for user data to be rendered
    await waitFor(() => {
      expect(screen.getByText('user1')).toBeInTheDocument();
    });

    // Find and click "YÖNETİCİ YAP" button (for user who has role 'user')
    const promoteButtons = screen.queryAllByText('YÖNETİCİ YAP');
    expect(promoteButtons.length).toBeGreaterThan(0);
    
    // Click the first promote button
    fireEvent.click(promoteButtons[0]);

    // Modal should open
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Kafe Yöneticisi Ata' })).toBeInTheDocument();
    });
  });

  it('confirms demotion with window.confirm', async () => {
    (window.confirm as jest.Mock).mockReturnValue(true);
    (apiModule.api.admin.updateUserRole as jest.Mock).mockResolvedValue({});

    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => expect(screen.getByText('YÖNETİCİLİĞİ AL')).toBeInTheDocument());

    fireEvent.click(screen.getByText('YÖNETİCİLİĞİ AL'));

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalled();
    });
  });

  it('shows game status badges', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByText('Oyunlar'));

    await waitFor(() => {
      expect(screen.getByText('TAMAMLANDI')).toBeInTheDocument();
      expect(screen.getByText('DEVAM EDİYOR')).toBeInTheDocument();
    });
  });

  it('shows delete game button', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByText('Oyunlar'));

    await waitFor(() => {
      expect(screen.getAllByText(/SİL/i).length).toBeGreaterThan(0);
    });
  });

  it('confirms before deleting game', async () => {
    (window.confirm as jest.Mock).mockReturnValue(true);
    (apiModule.api.games.delete as jest.Mock).mockResolvedValue({});

    render(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByText('Oyunlar'));

    await waitFor(() => expect(screen.getAllByText(/SİL/i)[0]).toBeInTheDocument());

    fireEvent.click(screen.getAllByText(/SİL/i)[0]);

    await waitFor(() => {
      expect(window.confirm).toHaveBeenCalledWith(
        expect.stringContaining('Geri alınamaz')
      );
    });
  });

  it('shows cafe list with edit form in cafes tab', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByText('Kafeler'));

    await waitFor(() => {
      expect(screen.getByText('Kafe Bilgilerini Düzenle')).toBeInTheDocument();
    });
  });

  it('shows add cafe button', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByText('Kafeler'));

    await waitFor(() => {
      expect(screen.getByText(/Yeni Kafe Ekle/)).toBeInTheDocument();
    });
  });

  it('opens add cafe modal when clicking add button', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    fireEvent.click(screen.getByText('Kafeler'));

    await waitFor(() => expect(screen.getByText(/Yeni Kafe Ekle/)).toBeInTheDocument());

    fireEvent.click(screen.getByText(/Yeni Kafe Ekle/));

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Yeni Kafe Ekle' })).toBeInTheDocument();
    });
  });

  it('loads data on mount', async () => {
    render(<AdminDashboard currentUser={mockCurrentUser} />);

    await waitFor(() => {
      expect(apiModule.api.admin.getUsers).toHaveBeenCalled();
      expect(apiModule.api.admin.getGames).toHaveBeenCalled();
      expect(apiModule.api.cafes.list).toHaveBeenCalled();
    });
  });
});
