import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { UserProfileModal } from './UserProfileModal';
import { api } from '../lib/api';
import { User } from '../types';

jest.mock('../lib/api', () => ({
  api: {
    users: {
      update: jest.fn(),
    },
  },
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

    const { container } = render(
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

    const saveButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.className.includes('text-emerald-400')
    );
    expect(saveButton).toBeTruthy();
    fireEvent.click(saveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(onSaveProfile).toHaveBeenCalledWith('Bilgisayar Mühendisliği');
    });
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('shows alert when save fails', async () => {
    const user = createUser();
    const onSaveProfile = jest.fn().mockRejectedValueOnce(new Error('db down'));
    const alertSpy = jest.spyOn(window, 'alert').mockImplementation(() => { });

    const { container } = render(
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
    const saveButton = Array.from(container.querySelectorAll('button')).find((btn) =>
      btn.className.includes('text-emerald-400')
    );
    expect(saveButton).toBeTruthy();
    fireEvent.click(saveButton as HTMLButtonElement);

    await waitFor(() => {
      expect(alertSpy).toHaveBeenCalledWith('Güncelleme başarısız.');
    });
    alertSpy.mockRestore();
  });

  it('calls onClose from close button and backdrop', () => {
    const user = createUser();
    const onClose = jest.fn();
    const { container } = render(
      <UserProfileModal isOpen={true} onClose={onClose} user={user} />
    );

    fireEvent.click(screen.getAllByRole('button')[0]);
    expect(onClose).toHaveBeenCalledTimes(1);

    const backdrop = container.querySelector('.absolute.inset-0');
    expect(backdrop).toBeTruthy();
    fireEvent.click(backdrop as HTMLDivElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
