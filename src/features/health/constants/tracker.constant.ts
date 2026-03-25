import { TabItem } from '../../../components/Tabs';

export const enum TabId {
  DailyStats = 1,
  NutritionGoal = 2,
}

export const TABS: TabItem<TabId>[] = [
  { id: TabId.DailyStats, label: 'Daily Stats', value: TabId.DailyStats },
  {
    id: TabId.NutritionGoal,
    label: 'Nutrition & Goal',
    value: TabId.NutritionGoal,
  },
];

export const STEP_GOAL = 10000;

export const DAY_NAMES = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
