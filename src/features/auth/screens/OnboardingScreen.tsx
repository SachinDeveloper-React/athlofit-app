import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Animated,
  StatusBar,
  StyleSheet,
  Platform,
} from 'react-native';
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
  SafeAreaView,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';

// ─── OnboardingScreen ─────────────────────────────────────────────────────
type Props = AuthStackScreenProps<typeof AuthRoutes.ONBOARDING>;
const OnboardingScreen = () => {
  const navigation = useNavigation<Props['navigation']>();
  const { bottom, top } = useSafeAreaInsets();
  const [activeIndex, setActiveIndex] = useState(0);
  const { fadeAnim, slideAnim, transition } = useSlideTransition();
  const { finishOnboarding } = useOnboardingStore();

  // Progress bar animation
  const progressAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(progressAnim, {
      toValue: (activeIndex + 1) / SLIDES.length,
      duration: 500,
      useNativeDriver: false,
    }).start();
  }, [activeIndex]);

  // Button press scale
  const btnScale = useRef(new Animated.Value(1)).current;
  const animateBtnPress = useCallback(() => {
    Animated.sequence([
      Animated.timing(btnScale, {
        toValue: 0.93,
        duration: 80,
        useNativeDriver: true,
      }),
      Animated.timing(btnScale, {
        toValue: 1,
        duration: 80,
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
    transform: [{ translateY: slideAnim }],
  };

  const { Scene } = slide;

  return (
    <View
      style={[
        styles.root,
        {
          paddingBottom: bottom,
          paddingTop: top,
        },
      ]}
    >
      <StatusBar barStyle="light-content" backgroundColor={C.bg1} />

      {/* Background orbs */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View
          style={[
            styles.bgOrb,
            { top: -80, right: -80, backgroundColor: slide.accent },
          ]}
        />
        <View
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
      </View>

      {/* Progress bar */}
      <ProgressBar progress={progWidth} color={slide.accent} />

      {/* Skip */}
      {!isLast && (
        <TouchableOpacity style={styles.skipBtn} onPress={skipToLast}>
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      )}

      {/* Scene */}
      <Animated.View style={[styles.sceneWrap, contentStyle]}>
        <Scene />
      </Animated.View>

      {/* Bottom controls */}
      <Animated.View style={[styles.bottomArea, contentStyle]}>
        <View style={[styles.accentLine, { backgroundColor: slide.accent }]} />
        <Text style={styles.title}>{slide.title}</Text>
        <Text style={styles.subtitle}>{slide.subtitle}</Text>

        <Dots
          slides={SLIDES}
          activeIndex={activeIndex}
          accent={slide.accent}
          onPress={goTo}
        />

        <NextButton
          isLast={isLast}
          accent={slide.accent}
          scale={btnScale}
          onPress={goNext}
        />
      </Animated.View>
    </View>
  );
};

export default OnboardingScreen;

// ─── STYLES ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg1,
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
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
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
