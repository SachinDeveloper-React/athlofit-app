export function calcCoinsFromSteps(steps: number, ratePerHundred: number = 0.095) {
  // Coins = Math.floor(steps / 100) * rate_per_100_steps
  // Keeps 2 decimal places for fractional coin display
  // Max daily earn limit handled by backend (250), but cap locally at a sane max
  const coins = Math.floor(steps / 100) * ratePerHundred;
  return parseFloat(Math.min(250, Math.max(0, coins)).toFixed(2));
}

export function getTrackerMessage(params: {
  steps: number;
  goalSteps: number;
  streakDays: number;
  coinsToday: number;
}) {
  const { steps, goalSteps, streakDays, coinsToday } = params;

  const progress = goalSteps > 0 ? steps / goalSteps : 0;

  if (steps === 0) {
    return {
      title: 'Start small.\nStart now.',
      subtitle: 'A 5-minute walk is still a win.',
      hint: `Earn coins as you move • Today: ${coinsToday.toFixed(2)} coins`,
    };
  }

  if (progress < 0.5) {
    const remaining = Math.max(0, goalSteps - steps);
    return {
      title: 'Keep going 💪',
      subtitle: `Just ${remaining.toLocaleString()} steps to get closer to your goal.`,
      hint:
        streakDays > 0
          ? `Streak: ${streakDays} day${streakDays === 1 ? '' : 's'}`
          : 'Build your first streak today',
    };
  }

  if (progress < 1) {
    const remaining = Math.max(0, goalSteps - steps);
    return {
      title: 'You’re close 🔥',
      subtitle: `${remaining.toLocaleString()} steps left — don’t break the flow.`,
      hint: `Coins today: ${coinsToday.toFixed(2)} • Streak: ${streakDays}d`,
    };
  }

  // Goal completed
  return {
    title: 'Goal crushed 🎯',
    subtitle: 'Consistency beats intensity. See you tomorrow.',
    hint: `Coins today: ${coinsToday.toFixed(2)} (max 10) • Streak continues: ${
      streakDays + 1
    }d`,
  };
}
