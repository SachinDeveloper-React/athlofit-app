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

/**
 * Daily step goal used when the user has none set on their profile.
 *
 * One constant because the fallback used to be written inline at each use site
 * and the values had drifted apart: the Tracker screen sent `|| 10000` to the
 * widget and notification while using `|| 8000` for its own progress ring and
 * its "goal met" verdict. The same step count therefore produced two different
 * percentages and, at counts between the two, the app said the goal was reached
 * while the widget did not.
 *
 * The value is 10,000 because that is `User.dailyStepGoal`'s schema default on the
 * backend, and the backend is what this has to agree with: it awards the daily
 * step-goal coins and persists `goalMet` against that number. A client fallback of
 * 8,000 meant a user whose profile had not loaded yet saw "goal met" at 8,000 while
 * the server scored them against 10,000 — the app claiming a reward the server had
 * not granted. `StepsWidgetProvider.DEFAULT_DAILY_STEP_GOAL` on the native side is
 * the same number for the same reason.
 *
 * Note this is NOT `APP_CONFIG_DEFAULTS.steps.defaultDailyGoal` (8,000), which is a
 * separate server-overridable knob that currently nothing reads. If that ever
 * starts driving a user's goal, it and `User.dailyStepGoal` have to be reconciled
 * first — they do not agree today.
 */
export const DEFAULT_DAILY_STEP_GOAL = 10000;

export const DAY_NAMES = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
] as const;
