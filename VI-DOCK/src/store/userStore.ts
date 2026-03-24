import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
    currentUser: string | null;
    login: (username: string) => void;
    logout: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set) => ({
            currentUser: null,
            login: (username) => set({ currentUser: username }),
            logout: () => set({ currentUser: null }),
        }),
        {
            name: 'simdock-user-storage',
        }
    )
);
