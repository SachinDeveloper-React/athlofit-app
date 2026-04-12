export type Stat = {
  key: 'steps' | 'water' | 'energy' | 'coins';
  label: string;
  value: string;
  sub?: string;
  icon: any;
  tint: 'blue' | 'orange' | 'gold';
};

export type MenuRow = {
  key: string;
  title: string;
  icon: any;
  tint: 'blue' | 'purple' | 'yellow' | 'pink' | 'gold' | 'green';
  badge?: number;
  onPress: () => void;
};