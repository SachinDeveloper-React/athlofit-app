import React from 'react';
import { Animated, StyleSheet } from 'react-native';
import Svg, {
  Rect,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { C } from '../../constant';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import { s, vs, ms, wp, hp } from '../../../../utils/responsive';

const PRODUCTS = [
  { name: 'Running Shoes', price: '500', icon: '👟', color: C.teal },
  { name: 'Fitness Band', price: '300', icon: '⌚', color: C.gold },
  { name: 'Protein Shake', price: '150', icon: '🥤', color: C.accent },
];

export const EcomScene: React.FC = () => {
  const cartBounce = useLoopAnim({
    initialValue: 0,
    steps: [
      { toValue: 1, duration: 1500 },
      { toValue: 0, duration: 1500 },
    ],
  });
  const cartY = cartBounce.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0, -6, 0],
  });

  const coinGlow = useLoopAnim({
    initialValue: 0.6,
    steps: [
      { toValue: 1, duration: 1000 },
      { toValue: 0.6, duration: 1000 },
    ],
  });

  const cardScale = useEnterAnim({
    toValue: 1,
    duration: 600,
    useNativeDriver: true,
  });

  const bagW = hp(10);
  const bagH = hp(11);

  return (
    <AppView style={styles.root}>
      {/* Shopping bag icon */}
      <Animated.View style={{ transform: [{ translateY: cartY }] }}>
        <Svg width={bagW} height={bagH} viewBox="0 0 100 110">
          <Defs>
            <LinearGradient id="bagGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={C.teal} />
              <Stop offset="1" stopColor={C.blue} />
            </LinearGradient>
          </Defs>
          <Rect x={18} y={40} width={64} height={60} rx={10} fill="url(#bagGrad)" />
          <Path
            d="M35 40 L35 28 Q35 15 50 15 Q65 15 65 28 L65 40"
            fill="none"
            stroke="rgba(255,255,255,0.6)"
            strokeWidth={4}
            strokeLinecap="round"
          />
          <Circle cx={50} cy={70} r={16} fill="rgba(255,215,0,0.3)" />
          <Path
            d="M45 78 L50 60 L55 78 M46.5 73 L53.5 73"
            fill="none"
            stroke={C.gold}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {/* Tagline */}
      <AppText style={styles.tagline}>Spend Your Coins</AppText>
      <AppText style={styles.taglineSub}>Redeem rewards from the shop</AppText>

      {/* Product cards */}
      <AppView style={styles.productSection}>
        {PRODUCTS.map((product, i) => (
          <Animated.View
            key={i}
            style={[styles.productCard, { transform: [{ scale: cardScale }] }]}
          >
            <AppText style={styles.productIcon}>{product.icon}</AppText>
            <AppView style={styles.productInfo}>
              <AppText style={styles.productName}>{product.name}</AppText>
              <AppView style={styles.priceRow}>
                <Animated.View style={{ opacity: coinGlow }}>
                  <Svg width={s(13)} height={s(13)} viewBox="0 0 14 14">
                    <Circle cx={7} cy={7} r={6} fill={C.gold} />
                    <Path
                      d="M5.5 10 L7 4 L8.5 10 M6 8.5 L8 8.5"
                      fill="none"
                      stroke="#fff"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </Animated.View>
                <AppText style={[styles.productPrice, { color: product.color }]}>
                  {product.price}
                </AppText>
              </AppView>
            </AppView>
          </Animated.View>
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
  tagline: { fontSize: ms(18), fontWeight: '900', marginTop: vs(10) },
  taglineSub: { fontSize: ms(11), marginTop: vs(3) },
  productSection: { width: wp(78), marginTop: vs(14) },
  productCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: s(10),
    paddingVertical: vs(8),
    paddingHorizontal: s(12),
    marginBottom: vs(6),
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  productIcon: { fontSize: ms(22), marginRight: s(12) },
  productInfo: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  productName: { fontSize: ms(12), fontWeight: '600' },
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: s(4) },
  productPrice: { fontSize: ms(13), fontWeight: '800' },
});
