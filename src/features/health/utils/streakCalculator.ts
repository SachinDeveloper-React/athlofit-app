export function calcCoinsFromSteps(steps: number) {
  // Sweatcoin style:
  // 1000 steps = 0.95 coin
  // Max 10 coins/day
  const coins = (steps / 1000) * 0.95;
  return Math.min(10, Math.max(0, coins));
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
