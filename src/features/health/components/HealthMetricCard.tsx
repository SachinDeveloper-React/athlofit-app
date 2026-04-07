import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card, AppText } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { Activity, Heart, Flame, MapPin, Clock, Droplet } from 'lucide-react-native';

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

export const HealthMetricCard: React.FC<Props> = ({ type, title, value, unit }) => {
  const { colors } = useTheme();
  
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

const styles = StyleSheet.create({
  container: {
    width: '48%',
    marginBottom: 16,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  content: {
    gap: 4,
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
  },
  unit: {
    marginBottom: 2,
  }
});
