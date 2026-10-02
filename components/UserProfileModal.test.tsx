import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfileModal } from './UserProfileModal';
import { User } from '../types';
import { api } from '../lib/api';

jest.mock('../lib/api', () => ({
  api: {
    users: {
      update: jest.fn(),
      getGameHistory: jest.fn().mockResolvedValue([]),
    },
    store: {
      inventory: jest.fn().mockResolvedValue({ success: true, inventory: [] }),
    },
  },
}));

const mockToast = {
  success: jest.fn(),
  error: jest.fn(),
  warning: jest.fn(),
  loading: jest.fn(),
  dismiss: jest.fn(),
};
jest.mock('../contexts/ToastContext', () => ({
  ...jest.requireActual('../contexts/ToastContext'),
  useToast: () => mockToast,
}));

describe('UserProfileModal', () => {
  const createUser = (): User => ({
    id: 7,
    username: 'emin',
    email: 'emin@example.com',
    points: 1230,
    wins: 9,
    gamesPlayed: 12,
    department: '',
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not render when closed or user is null', () => {
    const user = createUser();
    const { rerender, container } = render(
      <UserProfileModal isOpen={false} onClose={jest.fn()} user={user} />
    );
    expect(container.firstChild).toBeNull();

    rerender(<UserProfileModal isOpen={true} onClose={jest.fn()} user={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders profile stats and computed level info', () => {
    const user = createUser();
    render(<UserProfileModal isOpen={true} onClose={jest.fn()} user={user} />);

    expect(screen.getByText('emin')).toBeInTheDocument();
    expect(screen.getByText('ID: #000007')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(screen.getByText('LEVEL 3')).toBeInTheDocument();
    expect(screen.getByText('LEVEL 4')).toBeInTheDocument();
  });

  it('edits department and saves successfully', async () => {
    const user = createUser();
    const onSaveProfile = jest.fn().mockResolvedValueOnce(undefined);

    render(
      <UserProfileModal
        isOpen={true}
        onClose={jest.fn()}
        user={user}
        isEditable={true}
        onSaveProfile={onSaveProfile}
      />
    );
    fireEvent.click(screen.getByText('Bölüm Girilmedi'));

    const select = screen.getByRole('combobox');
    fireEvent.change(select, { target: { value: 'Bilgisayar Mühendisliği' } });

    fireEvent.click(screen.getByRole('button', { name: 'Bölümü kaydet' }));

    await waitFor(() => {
      expect(onSaveProfile).toHaveBeenCalledWith('Bilgisayar Mühendisliği');
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows toast error when save fails', async () => {
    const user = createUser();
    const onSaveProfile = jest.fn().mockRejectedValueOnce(new Error('db down'));

    render(
      <UserProfileModal
        isOpen={true}
        onClose={jest.fn()}
        user={user}
        isEditable={true}
        onSaveProfile={onSaveProfile}
      />
    );
    fireEvent.click(screen.getByText('Bölüm Girilmedi'));
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'İşletme' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Bölümü kaydet' }));

    await waitFor(() => {
      expect(mockToast.error).toHaveBeenCalledWith('Güncelleme başarısız.');
      expect(screen.getByRole('alert')).toHaveTextContent('Bölüm güncellenemedi');
    });
  });

  it('does not invent stats or fetch private data for an opponent preview', () => {
    const user = { ...createUser(), id: 0, username: 'other', points: 0, wins: 0, gamesPlayed: 0 };
    render(<UserProfileModal isOpen onClose={jest.fn()} user={user} isPreview />);
    expect(screen.getByText('Bu oyuncunun ayrıntılı profili paylaşılmıyor.')).toBeInTheDocument();
    expect(screen.queryByText('ID: #000000')).not.toBeInTheDocument();
    expect(screen.queryByText('LEVEL 1')).not.toBeInTheDocument();
    expect(screen.queryByText('Galibiyet')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Envanterin' })).not.toBeInTheDocument();
    expect(screen.queryByRole('region', { name: 'Son oyunların' })).not.toBeInTheDocument();
    expect(api.store.inventory).not.toHaveBeenCalled();
    expect(api.users.getGameHistory).not.toHaveBeenCalled();
  });

  it('keeps supplied read-only stats while withholding private history and inventory', () => {
    render(<UserProfileModal isOpen onClose={jest.fn()} user={createUser()} />);
    expect(screen.getByText('75%')).toBeInTheDocument();
    expect(api.store.inventory).not.toHaveBeenCalled();
    expect(api.users.getGameHistory).not.toHaveBeenCalled();
  });

  it('waits for the shared avatar save and keeps the confirmed choice on failure', async () => {
    const user = {
      ...createUser(),
      avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=kahve',
    };
    let reject!: (reason: Error) => void;
    const pending = new Promise<void>((_, fail) => {
      reject = fail;
    });
    const onSaveAvatar = jest.fn().mockReturnValueOnce(pending).mockResolvedValueOnce(undefined);
    render(
      <UserProfileModal
        isOpen
        onClose={jest.fn()}
        user={user}
        isEditable
        onSaveAvatar={onSaveAvatar}
      />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Avatar seç' }));
    fireEvent.click(screen.getByTestId('avatar-option-duo'));
    expect(screen.getByText('Avatar kaydediliyor…')).toHaveAttribute('role', 'status');
    expect(screen.getByTestId('avatar-option-duo')).toBeDisabled();
    const profile = screen.getByRole('dialog', { name: 'emin profili' });
    expect(profile.querySelector('img')).toHaveAttribute('src', '/avatars/pixel-art-v9/kahve.svg');
    reject(new Error('save failed'));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('Avatar kaydedilemedi')
    );
    expect(screen.getByTestId('avatar-option-kahve')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByTestId('avatar-option-duo'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Avatar seçimi' })).not.toBeInTheDocument()
    );
    expect(profile.querySelector('img')).toHaveAttribute('src', '/avatars/pixel-art-v9/duo.svg');
    expect(onSaveAvatar).toHaveBeenCalledTimes(2);
    expect(onSaveAvatar).toHaveBeenLastCalledWith(
      'https://api.dicebear.com/9.x/pixel-art/svg?seed=duo'
    );
    expect(api.users.update).not.toHaveBeenCalled();
  });

  it('syncs external avatar changes without clearing an in-progress department edit', () => {
    const user = createUser();
    const { rerender } = render(
      <UserProfileModal isOpen onClose={jest.fn()} user={user} isEditable />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Bölümü düzenle' }));
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'İşletme' } });
    rerender(
      <UserProfileModal
        isOpen
        onClose={jest.fn()}
        user={{ ...user, avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=masa' }}
        isEditable
      />
    );
    expect(screen.getByRole('combobox')).toHaveValue('İşletme');
    expect(screen.getByRole('dialog').querySelector('img')).toHaveAttribute(
      'src',
      '/avatars/pixel-art-v9/masa.svg'
    );
  });

  it('keeps the standalone API fallback when no shared avatar callback is supplied', async () => {
    const user = createUser();
    (api.users.update as jest.Mock).mockResolvedValueOnce({
      ...user,
      avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=duo',
    });
    render(<UserProfileModal isOpen onClose={jest.fn()} user={user} isEditable />);
    fireEvent.click(screen.getByRole('button', { name: 'Avatar seç' }));
    fireEvent.click(screen.getByTestId('avatar-option-duo'));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: 'Avatar seçimi' })).not.toBeInTheDocument()
    );
    expect(api.users.update).toHaveBeenCalledWith({
      ...user,
      avatar_url: 'https://api.dicebear.com/9.x/pixel-art/svg?seed=duo',
    });
  });

  it('calls onClose from close button and backdrop', () => {
    const user = createUser();
    const onClose = jest.fn();
    render(<UserProfileModal isOpen={true} onClose={onClose} user={user} />);

    fireEvent.click(screen.getByRole('button', { name: 'Profili kapat' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = screen
      .getByRole('dialog', { name: 'emin profili' })
      .querySelector('.absolute.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as HTMLDivElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
