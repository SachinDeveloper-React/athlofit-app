import React, { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';

import { AppText } from '../../../../components';

type Props = { trend: number };

const TrendBadge = memo(({ trend }: Props) => {
  const isUp = trend > 0;
  const isFlat = trend === 0;
  const color = isFlat ? '#6B7280' : isUp ? '#10B981' : '#EF4444';
  const bg = isFlat ? '#F3F4F6' : isUp ? '#ECFDF5' : '#FEF2F2';
  const Icon = isFlat ? Minus : isUp ? TrendingUp : TrendingDown;

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Icon size={10} color={color} />
      <AppText variant="caption2" weight="semiBold" style={{ color, marginLeft: 2 }}>
        {isFlat ? '—' : `${Math.abs(trend)}%`}
      </AppText>
    </View>
  );
});

TrendBadge.displayName = 'TrendBadge';
export default TrendBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 20,
    marginTop: 4,
  },
});
