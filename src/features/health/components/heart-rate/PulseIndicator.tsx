import { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';

export function PulseIndicator({ active }: { active: boolean }) {
  const scale = useRef(new Animated.Value(1)).current;
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    if (!active) return;
    const anim = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1.6,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(scale, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: 0.4,
            duration: 500,
            useNativeDriver: true,
          }),
        ]),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active]);
  return (
    <AppView style={s.pulseRow}>
      <Animated.View
        style={[s.pulseDot, { transform: [{ scale }], opacity }]}
      />
      <AppText style={s.pulseTxt}>
        {active ? 'Detecting pulse…' : 'Ready'}
      </AppText>
    </AppView>
  );
}

const s = StyleSheet.create({
  pulseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 24,
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#D85A30',
  },
  pulseTxt: { fontSize: 14, color: '#fff' },
});
