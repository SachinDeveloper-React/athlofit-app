import React from 'react';
import { View } from 'react-native';
import { Card, AppText } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { Activity, Heart, Flame, MapPin, Clock, Droplet } from 'lucide-react-native';
import { makeStyles } from '../../../hooks/makeStyles';

export type MetricType = 'steps' | 'heart' | 'bp' | 'calories' | 'distance' | 'time';

interface Props {
  type: MetricType;
  title: string;
  value: string | number;
  unit: string;
}

const getIcon = (type: MetricType, color: string) => {
  const props = { size: 22, color };
  switch (type) {
    case 'steps': return <Activity {...props} />;
    case 'heart': return <Heart {...props} />;
    case 'bp': return <Droplet {...props} />;
    case 'calories': return <Flame {...props} />;
    case 'distance': return <MapPin {...props} />;
    case 'time': return <Clock {...props} />;
  }
};

const useStyles = makeStyles(({ colors, spacing, radius }) => ({
  container: {
    width: '48%' as const,
    marginBottom: spacing[4],
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginBottom: spacing[3],
  },
  content: {
    gap: spacing[1],
  },
  valueRow: {
    flexDirection: 'row' as const,
    alignItems: 'baseline' as const,
    gap: spacing[1],
  },
  unit: {
    marginBottom: spacing[0.5],
  },
}));

export const HealthMetricCard: React.FC<Props> = ({ type, title, value, unit }) => {
  const { colors } = useTheme();
  const styles = useStyles();

  return (
    <Card style={styles.container} variant="inset" p={3}>
      <View style={[styles.iconContainer, { backgroundColor: colors.primary + '20' }]}>
        {getIcon(type, colors.primary)}
      </View>
      <View style={styles.content}>
        <AppText variant="caption1" secondary>{title}</AppText>
        <View style={styles.valueRow}>
          <AppText variant="title3">{value}</AppText>
          <AppText variant="footnote" secondary style={styles.unit}>{unit}</AppText>
        </View>
      </View>
    </Card>
  );
};
