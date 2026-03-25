import React from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

interface AmountDisplayProps {
  consumed: number;
  dailyGoal: number;
  percentage: number;
}

export const AmountDisplay: React.FC<AmountDisplayProps> = ({
  consumed,
  dailyGoal,
  percentage,
}) => {
  const amountColor =
    percentage >= 100 ? '#4ade80' : percentage >= 50 ? '#38bdf8' : '#7dd3fc';

  return (
    <View style={styles.container}>
      <Text style={styles.label}>ml consumed</Text>

      <Text style={[styles.value, { color: amountColor }]}>{consumed}</Text>

      <Text style={styles.goalText}>/ {dailyGoal} ml</Text>

      {/* Circular ring indicator */}
      <View style={styles.ringOuter}>
        <View
          style={[
            styles.ringFill,
            { transform: [{ rotate: `${(percentage / 100) * 360}deg` }] },
          ]}
        />
        <View style={styles.ringInner}>
          <Text style={styles.ringPct}>{Math.round(percentage)}%</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
  },
  label: {
    fontSize: 10,
    color: '#64748b',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  value: {
    fontSize: 48,
    fontWeight: '900',
    letterSpacing: -2,
  },
  goalText: {
    fontSize: 13,
    color: '#334155',
    marginBottom: 16,
  },
  ringOuter: {
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: 'rgba(56,189,248,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  ringFill: {
    position: 'absolute',
    width: 70,
    height: 70,
    borderRadius: 35,
    borderWidth: 5,
    borderColor: '#0ea5e9',
    borderTopColor: 'transparent',
    borderRightColor: 'transparent',
  },
  ringInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringPct: {
    fontSize: 14,
    fontWeight: '700',
    color: '#38bdf8',
  },
});
