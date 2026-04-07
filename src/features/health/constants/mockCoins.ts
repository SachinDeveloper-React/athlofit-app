import { CoinData } from '../types/gamification.type';

export const MOCK_COIN_DATA: CoinData = {
  balance: 1250,
  transactions: [
    {
      id: '1',
      type: 'EARNED',
      amount: 50,
      source: 'Morning 5km Run',
      createdAt: new Date().toISOString(),
    },
    {
      id: '2',
      type: 'SPENT',
      amount: 100,
      source: 'Premium Avatar Unlock',
      createdAt: new Date(Date.now() - 86400000).toISOString(),
    },
    {
      id: '3',
      type: 'EARNED',
      amount: 25,
      source: 'Daily Login Streak',
      createdAt: new Date(Date.now() - 172800000).toISOString(),
    },
    {
      id: '4',
      type: 'EXPIRED',
      amount: 10,
      source: 'Legacy Rewards',
      createdAt: new Date(Date.now() - 259200000).toISOString(),
    },
    {
       id: '5',
       type: 'EARNED',
       amount: 15,
       source: 'Hydro Milestone',
       createdAt: new Date(Date.now() - 345600000).toISOString(),
    },
  ],
  claimable: [
    {
      id: 'c1',
      title: 'Walk 10,000 Steps',
      threshold: 10000,
      reward: 50,
      currentValue: 8450,
      isClaimed: false,
    },
    {
      id: 'c2',
      title: 'Daily Water Goal',
      threshold: 8,
      reward: 20,
      currentValue: 8,
      isClaimed: false,
    },
    {
      id: 'c3',
      title: 'Complete Weekly Streak',
      threshold: 7,
      reward: 200,
      currentValue: 5,
      isClaimed: false,
    },
  ],
};
