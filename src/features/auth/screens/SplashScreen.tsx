import React, { memo, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  ActivityIndicator,
} from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { AppText, AppView } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { makeStyles } from '../../../hooks/makeStyles';

// ── Animated SVG runner figure ──────────────────────────────────────────
const AnimatedRunner = ({ color }: { color: string }) => {
  const bounce = useRef(new Animated.Value(0)).current;
  const legAngle = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, {
          toValue: -10,
          duration: 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(bounce, {
          toValue: 0,
          duration: 300,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(legAngle, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(legAngle, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  return (
    <Animated.View style={{ transform: [{ translateY: bounce }] }}>
      <Svg width={100} height={120} viewBox="0 0 100 120">
        <Circle cx="50" cy="18" r="12" fill={color} />
        <Path d="M50 30 L50 70" stroke={color} strokeWidth="5" strokeLinecap="round" />
        <Path d="M50 40 L30 58" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <Path d="M50 40 L70 52" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <Path d="M50 70 L32 95" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <Path d="M50 70 L68 90" stroke={color} strokeWidth="4" strokeLinecap="round" />
        <Path d="M32 95 L20 95" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <Path d="M68 90 L80 93" stroke={color} strokeWidth="3" strokeLinecap="round" />
      </Svg>
    </Animated.View>
  );
};

// ── Typing text animation ────────────────────────────────────────────────
const BRAND = 'Athlofit';

const TypingText = ({ onDone, colors }: { onDone: () => void; colors: any }) => {
  const [displayed, setDisplayed] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      if (i < BRAND.length) {
        setDisplayed(BRAND.slice(0, i + 1));
        i++;
      } else {
        clearInterval(interval);
        setTimeout(onDone, 400);
      }
    }, 120);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const blink = setInterval(() => setShowCursor(c => !c), 500);
    return () => clearInterval(blink);
  }, []);

  return (
    <AppView style={styles.textRow}>
      <AppText style={[styles.brand, { color: colors.foreground }]}>{displayed}</AppText>
      <AppText style={[styles.cursor, { opacity: showCursor ? 1 : 0, color: colors.primary }]}>|</AppText>
    </AppView>
  );
};

const useStyles = makeStyles(({ colors, spacing, radius, fontSize, fontWeight }) => ({
  container: {
    flex: 1,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  circle: {
    position: 'absolute' as const,
    borderRadius: radius.full,
  },
  circleTop: {
    width: 300,
    height: 300,
    top: -80,
    right: -80,
  },
  circleBottom: {
    width: 200,
    height: 200,
    bottom: -60,
    left: -60,
  },
  textRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  brand: {
    fontSize: 48,
    fontWeight: fontWeight.bold,
    letterSpacing: 2,
  },
  cursor: {
    fontSize: 48,
    fontWeight: '300' as const,
    marginLeft: spacing[0.5],
  },
  tagline: {
    fontSize: fontSize.md,
    letterSpacing: 3,
    marginTop: spacing[2],
    textTransform: 'uppercase' as const,
  },
  loaderWrap: {
    marginTop: spacing[12],
  },
}));

// Hoist styles for TypingText (needs to access before component)
let styles: ReturnType<typeof useStyles>;

// ── Main SplashScreen ────────────────────────────────────────────────────
const SplashScreen = memo(({ onFinish }: { onFinish?: () => void }) => {
  const { colors } = useTheme();
  styles = useStyles();
  const [showLoader, setShowLoader] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const runnerX = useRef(new Animated.Value(-120)).current;

  useEffect(() => {
    Animated.timing(runnerX, {
      toValue: 0,
      duration: 800,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();

    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      delay: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(slideAnim, {
      toValue: 0,
      duration: 600,
      delay: 400,
      easing: Easing.out(Easing.back(1.2)),
      useNativeDriver: true,
    }).start();
  }, [runnerX, fadeAnim, slideAnim]);

  const handleTypingDone = () => {
    setShowLoader(true);
    setTimeout(() => {
      onFinish?.();
    }, 2000);
  };

  return (
    <AppView style={[styles.container, { backgroundColor: colors.background }]}>
      <AppView style={[styles.circle, styles.circleTop, { backgroundColor: colors.primary + '15' }]} />
      <AppView style={[styles.circle, styles.circleBottom, { backgroundColor: colors.primary + '15' }]} />

      <Animated.View style={{ transform: [{ translateX: runnerX }] }}>
        <AnimatedRunner color={colors.primary} />
      </Animated.View>

      <Animated.View
        style={{
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
          alignItems: 'center',
          marginTop: 16,
        }}>
        <TypingText onDone={handleTypingDone} colors={colors} />
        <AppText style={[styles.tagline, { color: colors.mutedForeground }]}>Train Smarter. Live Better.</AppText>
      </Animated.View>

      {showLoader && (
        <Animated.View style={[styles.loaderWrap, { opacity: fadeAnim }]}>
          <ActivityIndicator size="large" color={colors.primary} />
        </Animated.View>
      )}
    </AppView>
  );
});

export default SplashScreen;
