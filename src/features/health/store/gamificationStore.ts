import { create } from 'zustand';
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import { mmkvStorage } from '../../../store';
import { GamificationStore } from '../types/gamification.type';

// BUG-049: Use local timezone date string instead of UTC ISO string.
// new Date().toISOString().slice(0,10) returns the UTC date, which is wrong
// for users in UTC+ timezones after midnight UTC but before local midnight.
const getLocalDateString = (): string => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

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
        const todayStr = getLocalDateString(); // BUG-049: local timezone, not UTC
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

        // Streak logic — use local date arithmetic to match the server
        if (metGoal && lastActiveDate !== todayStr) {
          let newStreak = streakDays;

          const yest = new Date();
          yest.setDate(yest.getDate() - 1);
          const yy = yest.getFullYear();
          const ym = String(yest.getMonth() + 1).padStart(2, '0');
          const yd = String(yest.getDate()).padStart(2, '0');
          const yesterdayStr = `${yy}-${ym}-${yd}`;
          
          if (lastActiveDate === yesterdayStr || !lastActiveDate) {
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
         const todayStr = getLocalDateString(); // BUG-049: local timezone, not UTC
         const yesterday = new Date();
         yesterday.setDate(yesterday.getDate() - 1);
         const yy = yesterday.getFullYear();
         const ym = String(yesterday.getMonth() + 1).padStart(2, '0');
         const yd = String(yesterday.getDate()).padStart(2, '0');
         const yesterdayStr = `${yy}-${ym}-${yd}`;
         
         const { lastActiveDate, lastCoinDate } = get();
         
         const updates: Partial<GamificationStore> = {};
         
         if (lastCoinDate && lastCoinDate !== todayStr) {
            updates.coinsEarnedToday = 0;
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

      // ── Reset all gamification data (called on logout) ──────────────────────
      reset: () => set({
        coinsBalance: 0,
        streakDays: 0,
        bestStreakDays: 0,
        lastActiveDate: null,
        coinsEarnedToday: 0,
        lastCoinDate: null,
      }),
    })),
    {
      name: 'gamification-store',
      storage: createJSONStorage(() => mmkvStorage),
    }
  )
);
