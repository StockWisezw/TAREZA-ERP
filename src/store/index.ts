import { create } from 'zustand';

interface UserProfile {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  role?: string;
}

interface AuthState {
  user: UserProfile | null;
  loading: boolean;
  setUser: (user: UserProfile | null) => void;
  setLoading: (loading: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user }),
  setLoading: (loading) => set({ loading }),
  logout: () => set({ user: null }),
}));

interface BusinessProfile {
  id: string;
  name: string;
  tax_number: string | null;
}

interface Branch {
  id: string;
  name: string;
  type: string;
}

interface BusinessState {
  currentBusiness: BusinessProfile | null;
  branches: Branch[];
  activeBranch: Branch | null;
  setCurrentBusiness: (business: BusinessProfile | null) => void;
  setBranches: (branches: Branch[]) => void;
  setActiveBranch: (branch: Branch | null) => void;
}

export const useBusinessStore = create<BusinessState>((set) => ({
  currentBusiness: null,
  branches: [],
  activeBranch: null,
  setCurrentBusiness: (business) => set({ currentBusiness: business }),
  setBranches: (branches) => set({ branches }),
  setActiveBranch: (branch) => set({ activeBranch: branch }),
}));

export interface AppNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  message: string;
  timestamp: string;
}

interface NotificationState {
  notifications: AppNotification[];
  addNotification: (message: string, type?: AppNotification['type']) => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  notifications: [],
  addNotification: (message, type = 'info') => set((state) => ({
    notifications: [
      ...state.notifications,
      {
        id: crypto.randomUUID(),
        type,
        message,
        timestamp: new Date().toISOString(),
      },
    ],
  })),
  removeNotification: (id) => set((state) => ({
    notifications: state.notifications.filter((n) => n.id !== id),
  })),
  clearAll: () => set({ notifications: [] }),
}));
