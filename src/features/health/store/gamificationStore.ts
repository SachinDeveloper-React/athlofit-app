// ─── gamificationStore.ts ───────────────────────────────────────────────────

import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { mmkvStorage } from '../../../store';
import { GamificationStore } from '../types/gamification.type';

export const useGamificationStore = create<GamificationStore>()(
  persist(
    subscribeWithSelector((set, get) => ({
      coinsBalance: 0,
      streakDays: 0,
      bestStreakDays: 0,
      lastActiveDate: null,
      coinsEarnedToday: 0,
      lastCoinDate: null,

      setCoinsBalance: (balance) => set({ coinsBalance: balance }),
      
      syncDailyProgress: (coinsEarnedThisDay, metGoal) => {
        const { coinsEarnedToday, coinsBalance, lastCoinDate, lastActiveDate, streakDays, bestStreakDays } = get();
        const todayStr = new Date().toDateString();
        const updates: Partial<GamificationStore> = {};
        
        // Coins logic
        let currentToday = lastCoinDate === todayStr ? coinsEarnedToday : 0;
        // The server's cap is 250. We use Math.round to prevent floating point issues.
        const newToday = Math.round(Math.min(250, coinsEarnedThisDay));
        const actualAdded = newToday - currentToday;

        if (actualAdded > 0) {
          updates.coinsEarnedToday = newToday;
          updates.coinsBalance = Math.round(coinsBalance + actualAdded);
          updates.lastCoinDate = todayStr;
        }

        // Streak logic
        if (metGoal && lastActiveDate !== todayStr) {
          let newStreak = streakDays;
          const yesterday = new Date();
          yesterday.setDate(yesterday.getDate() - 1);
          
          if (lastActiveDate === yesterday.toDateString() || !lastActiveDate) {
            newStreak += 1;
          } else {
             newStreak = 1;
          }
          
          updates.streakDays = newStreak;
          updates.bestStreakDays = Math.max(bestStreakDays, newStreak);
          updates.lastActiveDate = todayStr;
        }

        if (Object.keys(updates).length > 0) {
          set(updates);
        }
      },

      checkAndResetDaily: () => {
         const today = new Date();
         const todayStr = today.toDateString();
         const yesterday = new Date();
         yesterday.setDate(yesterday.getDate() - 1);
         const yesterdayStr = yesterday.toDateString();
         
         const { lastActiveDate, lastCoinDate } = get();
         
         const updates: Partial<GamificationStore> = {};
         
         if (lastCoinDate && lastCoinDate !== todayStr) {
            updates.coinsEarnedToday = 0;
            // Note: we don't update lastCoinDate here until they actually earn a coin
         }
         
         // If last active was before yesterday, streak is broken
         if (lastActiveDate && lastActiveDate !== todayStr && lastActiveDate !== yesterdayStr) {
            updates.streakDays = 0;
         }
         
         if (Object.keys(updates).length > 0) {
            set(updates);
         }
      },
      
      syncWithService: (data) => set(data),
    })),
    {
      name: 'gamification-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
