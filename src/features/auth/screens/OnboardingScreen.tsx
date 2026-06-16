import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  StatusBar,
  StyleSheet,
  Platform,
} from 'react-native';
import { AppView, AppText, Button } from '../../../components';
import { C } from '../constant';
import { Dots, NextButton, ProgressBar } from '../components/onboarding';
import { useSlideTransition } from '../hooks';
import { useOnboardingStore } from '../store/onboardingStore';
import { AuthRoutes } from '../../../navigation/routes';
import { AuthStackScreenProps } from '../../../types/navigation.types';
import { useNavigation } from '@react-navigation/native';
import { SLIDES } from '../constant/onboardingSlides.constant';
import { useTheme } from '../../../hooks/useTheme';
import {
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// ─── OnboardingScreen ─────────────────────────────────────────────────────
type Props = AuthStackScreenProps<typeof AuthRoutes.ONBOARDING>;
const OnboardingScreen = () => {
  const navigation = useNavigation<Props['navigation']>();
  const { bottom, top } = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const { fadeAnim, slideAnim, scaleAnim, transition } = useSlideTransition();
  const { finishOnboarding } = useOnboardingStore();
  const { colors, isDark } = useTheme();

  // Theme-aware onboarding colors
  const bgColor = isDark ? C.bg1 : colors.background;
  const textColor = isDark ? C.white : colors.foreground;
  const mutedColor = isDark ? C.muted : colors.mutedForeground;

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (activeIndex + 1) / SLIDES.length,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [activeIndex]);

  // Button press scale
  const btnScale = useRef(new Animated.Value(1)).current;
  const animateBtnPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(btnScale, {
        toValue: 0.94,
        duration: 100,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(btnScale, {
        toValue: 1,
        tension: 200,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [btnScale]);

  const slide = SLIDES[activeIndex];
  const isLast = activeIndex === SLIDES.length - 1;

  const goTo = useCallback(
    (i: number) => {
      if (i === activeIndex) return;
      transition(() => setActiveIndex(i));
    },
    [activeIndex, transition],
  );

  const goNext = useCallback(() => {
    if (isLast) {
      finishOnboarding?.();
      navigation.navigate(AuthRoutes.LOGIN);
      return;
    }
    animateBtnPress();
    transition(() => setActiveIndex(i => i + 1));
  }, [isLast, finishOnboarding, animateBtnPress, transition]);

  const skipToLast = useCallback(() => {
    transition(() => setActiveIndex(SLIDES.length - 1));
  }, [transition]);

  const progWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  const contentStyle = {
    opacity: fadeAnim,
    transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
  };

  const { Scene } = slide;

  return (
    <AppView
      style={[
        styles.root,
        {
          paddingBottom: bottom,
          paddingTop: top,
          backgroundColor: bgColor,
        },
      ]}
    >
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} backgroundColor={bgColor} />

      {/* Background orbs */}
      <AppView style={StyleSheet.absoluteFill} pointerEvents="none">
        <AppView
          style={[
            styles.bgOrb,
            { top: -80, right: -80, backgroundColor: slide.accent },
          ]}
        />
        <AppView
          style={[
            styles.bgOrb,
            {
              bottom: -60,
              left: -60,
              backgroundColor: C.blue,
              opacity: 0.06,
            },
          ]}
        />
      </AppView>

      {/* Progress bar */}
      <ProgressBar progress={progWidth} color={slide.accent} />

      {/* Skip */}
      {!isLast && (
        <Button
          label="Skip"
          variant="ghost"
          size="sm"
          onPress={skipToLast}
          style={styles.skipBtn}
          labelStyle={[styles.skipText, { color: mutedColor }]}
        />
      )}

      {/* Scene */}
      <Animated.View style={[styles.sceneWrap, contentStyle]}>
        <Scene />
      </Animated.View>

      {/* Bottom controls */}
      <Animated.View style={[styles.bottomArea, contentStyle]}>
        <AppView style={[styles.accentLine, { backgroundColor: slide.accent }]} />
        <AppText style={[styles.title, { color: textColor }]}>{slide.title}</AppText>
        <AppText style={[styles.subtitle, { color: mutedColor }]}>{slide.subtitle}</AppText>

        <Dots
          slides={SLIDES}
          activeIndex={activeIndex}
          accent={slide.accent}
          onPress={goTo}
        />

        <NextButton
          isLast={isLast}
          buttonTitle={slide.button}
          accent={slide.accent}
          scale={btnScale}
          onPress={goNext}
        />
      </Animated.View>
    </AppView>
  );
};

export default OnboardingScreen;

// ─── STYLES ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },

  bgOrb: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    opacity: 0.07,
  },

  skipBtn: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 56 : 20,
    right: 24,
    zIndex: 10,
    padding: 8,
  },
  skipText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '600',
  },

  sceneWrap: {
    flex: 1,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },

  bottomArea: {
    paddingHorizontal: 28,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
  },

  accentLine: {
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 16,
  },

  title: {
    color: C.white,
    fontSize: 30,
    fontWeight: '900',
    letterSpacing: -0.5,
    marginBottom: 10,
  },

  subtitle: {
    color: C.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 28,
  },
});
