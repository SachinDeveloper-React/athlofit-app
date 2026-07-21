import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import LinearGradient from 'react-native-linear-gradient';
import { useSyncStore } from '../store/syncStore';
import { useTheme } from '../hooks/useTheme';
import AppText from './AppText';

const BAR_HEIGHT = 3;
const CONTAINER_HEIGHT = 22;
const ANIMATION_DURATION = 1200;
const FADE_DURATION = 250;

/**
 * SyncIndicator — thin gradient loader bar with "Syncing" text.
 * Rendered inline (not absolute) just below the Header inside Screen component.
 * Does not overlap or hide any existing UI — takes up space only when active.
 *
 * Animates height in/out so content shifts smoothly.
 */
export const SyncIndicator: React.FC = () => {
  const isSyncing = useSyncStore(s => s.isSyncing);
  const { colors } = useTheme();

  // Height animation (0 when hidden, CONTAINER_HEIGHT when visible)
  const heightAnim = useRef(new Animated.Value(0)).current;
  // Opacity
  const opacityAnim = useRef(new Animated.Value(0)).current;
  // Translate X for the moving gradient bar
  const translateX = useRef(new Animated.Value(-1)).current;
  // Loop reference
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isSyncing) {
      // Animate in (height + opacity)
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: CONTAINER_HEIGHT,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
      ]).start();

      // Start the looping gradient slide
      const loop = Animated.loop(
        Animated.timing(translateX, {
          toValue: 1,
          duration: ANIMATION_DURATION,
          useNativeDriver: true,
        }),
      );
      loopRef.current = loop;
      loop.start();
    } else {
      // Animate out
      Animated.parallel([
        Animated.timing(heightAnim, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: FADE_DURATION,
          useNativeDriver: false,
        }),
      ]).start();

      // Stop loop
      if (loopRef.current) {
        loopRef.current.stop();
        loopRef.current = null;
      }
      translateX.setValue(-1);
    }
  }, [isSyncing, heightAnim, opacityAnim, translateX]);

  // Interpolate translateX for sliding effect
  const barTranslateX = translateX.interpolate({
    inputRange: [-1, 1],
    outputRange: [-200, 200],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: heightAnim,
          opacity: opacityAnim,
          backgroundColor: colors.background,
        },
      ]}
    >
      {/* Syncing text */}
      <View style={styles.textRow}>
        <AppText
          variant="caption2"
          weight="medium"
          color={colors.primary}
        >
          Syncing
        </AppText>
      </View>

      {/* Animated gradient bar */}
      <View style={[styles.barTrack, { backgroundColor: colors.border }]}>
        <Animated.View
          style={[
            styles.barFill,
            { transform: [{ translateX: barTranslateX }] },
          ]}
        >
          <LinearGradient
            colors={colors.gradient.primary}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.gradient}
          />
        </Animated.View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  textRow: {
    alignItems: 'center',
    paddingBottom: 2,
  },
  barTrack: {
    width: '100%',
    height: BAR_HEIGHT,
    overflow: 'hidden',
  },
  barFill: {
    width: '60%',
    height: '100%',
  },
  gradient: {
    flex: 1,
  },
});

export default SyncIndicator;
