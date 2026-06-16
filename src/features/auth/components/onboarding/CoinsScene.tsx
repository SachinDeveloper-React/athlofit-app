import React from 'react';
import { Animated, Dimensions, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Path,
  Rect,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';

const { width } = Dimensions.get('window');

export const CoinsScene: React.FC = () => {
  // Coin spin / float animation
  const floatAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0, duration: 2000 },
    ],
  });
  const floatY = floatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -12, 0],
  });

  // Shimmer glow
  const glowAnim = useLoopAnim({
    initialValue: 0.5,
    steps: [
      { toValue: 1, duration: 1200 },
      { toValue: 0.5, duration: 1200 },
    ],
  });

  // Counter entry
  const counterScale = useEnterAnim({
    toValue: 1,
    duration: 800,
    useNativeDriver: true,
  });

  return (
    <AppView style={styles.root}>
      {/* Floating coin */}
      <Animated.View style={[styles.coinWrap, { transform: [{ translateY: floatY }] }]}>
        <Animated.View style={{ opacity: glowAnim }}>
          <Svg width={140} height={140} viewBox="0 0 140 140">
            <Defs>
              <LinearGradient id="coinGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0" stopColor="#FFD700" />
                <Stop offset="0.5" stopColor="#FFA500" />
                <Stop offset="1" stopColor="#FFD700" />
              </LinearGradient>
              <LinearGradient id="coinShine" x1="0" y1="0" x2="0.5" y2="0.5">
                <Stop offset="0" stopColor="rgba(255,255,255,0.5)" />
                <Stop offset="1" stopColor="rgba(255,255,255,0)" />
              </LinearGradient>
            </Defs>
            {/* Coin shadow */}
            <Ellipse cx={70} cy={130} rx={35} ry={6} fill="rgba(0,0,0,0.3)" />
            {/* Coin body */}
            <Circle cx={70} cy={65} r={52} fill="url(#coinGrad)" />
            <Circle cx={70} cy={65} r={44} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
            {/* A logo */}
            <Path
              d="M57 90 L70 40 L83 90 M61 75 L79 75"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* Shine */}
            <Circle cx={70} cy={65} r={52} fill="url(#coinShine)" />
          </Svg>
        </Animated.View>
      </Animated.View>

      {/* Coin balance */}
      <Animated.View style={[styles.balanceWrap, { transform: [{ scale: counterScale }] }]}>
        <AppText style={styles.balanceAmount}>1,250</AppText>
        <AppText style={styles.balanceLabel}>Coins Earned</AppText>
      </Animated.View>

      {/* Earn methods */}
      <AppView style={styles.earnSection}>
        <AppText style={styles.sectionTitle}>EARN BY</AppText>
        {[
          { icon: '👟', label: 'Walking & Running', coins: '+10/km' },
          { icon: '🎯', label: 'Completing Goals', coins: '+50' },
          { icon: '🔥', label: 'Daily Streak', coins: '+25' },
        ].map((item, i) => (
          <AppView key={i} style={styles.earnRow}>
            <AppText style={styles.earnIcon}>{item.icon}</AppText>
            <AppView style={styles.earnInfo}>
              <AppText style={styles.earnLabel}>{item.label}</AppText>
              <AppText style={styles.earnCoins}>{item.coins}</AppText>
            </AppView>
          </AppView>
        ))}
      </AppView>
    </AppView>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  coinWrap: { marginTop: -30 },
  balanceWrap: { alignItems: 'center', marginTop: 16 },
  balanceAmount: { color: C.gold, fontSize: 36, fontWeight: '900' },
  balanceLabel: { color: C.muted, fontSize: 13, marginTop: 2 },
  earnSection: { width: width * 0.8, marginTop: 24 },
  sectionTitle: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1.5,
    marginBottom: 12,
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  earnIcon: { fontSize: 22, marginRight: 12 },
  earnInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnLabel: { color: '#fff', fontSize: 14, fontWeight: '600' },
  earnCoins: { color: C.gold, fontSize: 14, fontWeight: '700' },
});
