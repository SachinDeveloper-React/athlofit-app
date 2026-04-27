import { useEffect, useRef } from 'react';
import { Animated } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { makeStyles } from '../../../../hooks/makeStyles';

const useStyles = makeStyles(({ colors, spacing, radius, fontSize }) => ({
  pulseRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2.5],
    marginBottom: spacing[6],
  },
  pulseDot: {
    width: 14,
    height: 14,
    borderRadius: radius.full,
    backgroundColor: '#D85A30',
  },
  pulseTxt: { fontSize: fontSize.md, color: '#fff' },
}));

export function PulseIndicator({ active }: { active: boolean }) {
  const styles = useStyles();
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
    <AppView style={styles.pulseRow}>
      <Animated.View
        style={[styles.pulseDot, { transform: [{ scale }], opacity }]}
      />
      <AppText style={styles.pulseTxt}>
        {active ? 'Detecting pulse…' : 'Ready'}
      </AppText>
    </AppView>
  );
}
