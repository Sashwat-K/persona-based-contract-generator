import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export const useThemeStore = create(
  persist(
    (set, get) => ({
      theme: 'g100', // 'white' for light mode, 'g100' for dark mode
      
      toggleTheme: () => set((state) => ({
        theme: state.theme === 'white' ? 'g100' : 'white'
      })),
      
      setTheme: (theme) => set({ theme }),
      
      isDarkMode: () => get().theme === 'g100'
    }),
    {
      name: 'hpcr-theme-storage'
    }
  )
);

// Made with Bob
