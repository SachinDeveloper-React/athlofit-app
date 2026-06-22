import React from 'react';
import { Animated } from 'react-native';
import Svg, {
  Rect,
  Path,
  Circle,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import { AppView, AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { withOpacity } from '../../../../utils/withOpacity';
import { useLoopAnim, useEnterAnim } from '../../hooks';
import { wp, hp } from '../../../../utils/responsive';

export const EcomScene: React.FC = () => {
  const { colors, spacing, radius, fontSize, fontWeight } = useTheme();

  const PRODUCTS = [
    { name: 'Running Shoes', price: '500', icon: '👟', color: colors.success },
    { name: 'Fitness Band', price: '300', icon: '⌚', color: colors.gold },
    { name: 'Protein Shake', price: '150', icon: '🥤', color: colors.destructive },
  ];

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
    <AppView style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] }}>
      {/* Shopping bag icon */}
      <Animated.View style={{ transform: [{ translateY: cartY }] }}>
        <Svg width={bagW} height={bagH} viewBox="0 0 100 110">
          <Defs>
            <LinearGradient id="bagGrad" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor={colors.success} />
              <Stop offset="1" stopColor={colors.primary} />
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
          <Circle cx={50} cy={70} r={16} fill={withOpacity(colors.gold, 0.3)} />
          <Path
            d="M45 78 L50 60 L55 78 M46.5 73 L53.5 73"
            fill="none"
            stroke={colors.gold}
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      </Animated.View>

      {/* Tagline */}
      <AppText style={{
        color: colors.foreground,
        fontSize: fontSize.lg,
        fontWeight: fontWeight.bold,
        marginTop: spacing[2.5],
      }}>
        Spend Your Coins
      </AppText>
      <AppText style={{
        color: colors.mutedForeground,
        fontSize: fontSize.xs,
        fontWeight: fontWeight.medium,
        marginTop: spacing[1],
      }}>
        Redeem rewards from the shop
      </AppText>

      {/* Product cards */}
      <AppView style={{ width: wp(78), marginTop: spacing[4] }}>
        {PRODUCTS.map((product, i) => (
          <Animated.View
            key={i}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              backgroundColor: withOpacity(colors.foreground, 0.05),
              borderRadius: radius.lg,
              paddingVertical: spacing[2],
              paddingHorizontal: spacing[3],
              marginBottom: spacing[1.5],
              borderWidth: 1,
              borderColor: withOpacity(colors.foreground, 0.08),
              transform: [{ scale: cardScale }],
            }}
          >
            <AppText style={{ fontSize: fontSize['2xl'], marginRight: spacing[3] }}>
              {product.icon}
            </AppText>
            <AppView style={{ flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <AppText style={{
                color: colors.foreground,
                fontSize: fontSize.sm,
                fontWeight: fontWeight.semiBold,
              }}>
                {product.name}
              </AppText>
              <AppView style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[1] }}>
                <Animated.View style={{ opacity: coinGlow }}>
                  <Svg width={spacing[3]} height={spacing[3]} viewBox="0 0 14 14">
                    <Circle cx={7} cy={7} r={6} fill={colors.gold} />
                    <Path
                      d="M5.5 10 L7 4 L8.5 10 M6 8.5 L8 8.5"
                      fill="none"
                      stroke="#fff"
                      strokeWidth={1.2}
                      strokeLinecap="round"
                    />
                  </Svg>
                </Animated.View>
                <AppText style={{
                  color: product.color,
                  fontSize: fontSize.md,
                  fontWeight: fontWeight.bold,
                }}>
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
