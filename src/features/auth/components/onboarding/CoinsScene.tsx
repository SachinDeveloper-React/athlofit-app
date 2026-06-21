import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, {
  Circle,
  Path,
  Ellipse,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import { s, vs, ms, wp, hp } from '../../../../utils/responsive';

export const CoinsScene: React.FC = () => {
  const floatAnim = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 2000 },
      { toValue: 0, duration: 2000 },
    ],
  });
  const floatY = floatAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -8, 0],
  });

  const glowAnim = useLoopAnim({
    initialValue: 0.5,
    steps: [
      { toValue: 1, duration: 1200 },
      { toValue: 0.5, duration: 1200 },
    ],
  });

  const counterScale = useEnterAnim({
    toValue: 1,
    duration: 800,
    useNativeDriver: true,
  });

  const coinSize = hp(14);

  return (
    <AppView style={styles.root}>
      {/* Floating coin */}
      <Animated.View style={{ transform: [{ translateY: floatY }] }}>
        <Animated.View style={{ opacity: glowAnim }}>
          <Svg width={coinSize} height={coinSize} viewBox="0 0 140 140">
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
            <Ellipse cx={70} cy={130} rx={35} ry={6} fill="rgba(0,0,0,0.3)" />
            <Circle cx={70} cy={65} r={52} fill="url(#coinGrad)" />
            <Circle cx={70} cy={65} r={44} fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth={2} />
            <Path
              d="M57 90 L70 40 L83 90 M61 75 L79 75"
              fill="none"
              stroke="rgba(255,255,255,0.9)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
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
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: s(20),
  },
  balanceWrap: { alignItems: 'center', marginTop: vs(8) },
  balanceAmount: { color: C.gold, fontSize: ms(30), fontWeight: '900' },
  balanceLabel: { color: C.muted, fontSize: ms(11), marginTop: vs(2) },
  earnSection: { width: wp(78), marginTop: vs(12) },
  sectionTitle: {
    color: C.muted,
    fontSize: ms(10),
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: vs(8),
  },
  earnRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: s(10),
    paddingVertical: vs(8),
    paddingHorizontal: s(12),
    marginBottom: vs(6),
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.15)',
  },
  earnIcon: { fontSize: ms(18), marginRight: s(10) },
  earnInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  earnLabel: { color: '#fff', fontSize: ms(12), fontWeight: '600' },
  earnCoins: { color: C.gold, fontSize: ms(12), fontWeight: '700' },
});
