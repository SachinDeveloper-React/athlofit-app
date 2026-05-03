// src/features/health/components/analytics/calendar/EmptyCell.tsx
import React, { memo } from 'react';
import { View } from 'react-native';

const EmptyCell = memo(({ cellSize }: { cellSize: number }) => (
  <View style={{ width: cellSize, height: cellSize }} />
));

EmptyCell.displayName = 'EmptyCell';
export default EmptyCell;
