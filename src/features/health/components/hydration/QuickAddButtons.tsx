import React from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { DrinkSize } from '../../types/hydration.type';

const DRINK_OPTIONS: {
  ml: DrinkSize;
  color: string;
  bg: string;
  emoji: string;
}[] = [
  { ml: 100, color: '#0ea5e9', bg: 'rgba(14,165,233,0.15)', emoji: '🥛' },
  { ml: 200, color: '#38bdf8', bg: 'rgba(56,189,248,0.15)', emoji: '🥤' },
  { ml: 500, color: '#7dd3fc', bg: 'rgba(125,211,252,0.15)', emoji: '🍶' },
];

interface QuickAddButtonsProps {
  onAdd: (amount: DrinkSize) => void;
  onReset: () => void;
}

export const QuickAddButtons: React.FC<QuickAddButtonsProps> = ({
  onAdd,
  onReset,
}) => {
  return (
    <View style={[styles.container]}>
      <Text style={styles.sectionTitle}>Quick Add</Text>

      <View style={styles.btnRow}>
        {DRINK_OPTIONS.map(btn => (
          <TouchableOpacity
            key={btn.ml}
            style={[
              styles.addBtn,
              { backgroundColor: btn.bg, borderColor: btn.color },
            ]}
            onPress={() => onAdd(btn.ml)}
            activeOpacity={0.7}
          >
            <Text style={styles.addBtnEmoji}>{btn.emoji}</Text>
            <Text style={[styles.addBtnText, { color: btn.color }]}>
              +{btn.ml}
            </Text>
            <Text style={[styles.addBtnUnit, { color: btn.color }]}>ml</Text>
          </TouchableOpacity>
        ))}
      </View>

      <TouchableOpacity
        style={styles.resetBtn}
        onPress={onReset}
        activeOpacity={0.8}
      >
        <Text style={styles.resetBtnText}>↺ Reset Day</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    letterSpacing: 1,
    color: '#475569',
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 12,
  },
  addBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
  },
  addBtnEmoji: {
    fontSize: 20,
    marginBottom: 4,
  },
  addBtnText: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  addBtnUnit: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    opacity: 0.8,
  },
  resetBtn: {
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: 'rgba(239,68,68,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)',
  },
  resetBtnText: {
    fontSize: 14,
    color: '#f87171',
    fontWeight: '600',
    letterSpacing: 1,
  },
});
