import { AdminGameRow, Cafe, User } from '../../types';

export type { AdminGameRow };

export type AdminRole = 'user' | 'admin' | 'cafe_admin';

export interface AdminUserFormData {
  username: string;
  email: string;
  password: string;
  department: string;
  role: AdminRole;
  cafe_id: string;
}

export interface AdminCafeFormData {
  name: string;
  address: string;
  total_tables: number;
  latitude: string;
  longitude: string;
  radius: number;
  secondaryLatitude: string;
  secondaryLongitude: string;
  secondaryRadius: number;
}

export interface AdminCafeEditData {
  address: string;
  total_tables: number;
  latitude: string;
  longitude: string;
  radius: number;
  secondaryLatitude: string;
  secondaryLongitude: string;
  secondaryRadius: number;
}

export type AdminUserRow = User;

export interface AddUserModalProps {
  isOpen: boolean;
  cafes: Cafe[];
  isSubmitting: boolean;
  formData: AdminUserFormData;
  onFormChange: (next: AdminUserFormData) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export interface AddCafeModalProps {
  isOpen: boolean;
  formData: AdminCafeFormData;
  onFormChange: (next: AdminCafeFormData) => void;
  onClose: () => void;
  onSubmit: () => void;
}

export interface AssignCafeAdminModalProps {
  isOpen: boolean;
  cafes: Cafe[];
  selectedUser: AdminUserRow | null;
  selectedCafeId: string;
  onCafeChange: (nextCafeId: string) => void;
  onClose: () => void;
  onConfirm: () => void;
}
