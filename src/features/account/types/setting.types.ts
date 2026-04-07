export type RowBase = {
  key: string;
  title: string;
  icon: React.ComponentType<{ size?: number; color?: string }>;
  iconColorKey?: 'primary' | 'secondary' | 'destructive' | 'foreground';
  onPress?: () => void;
};

export type ToggleRow = RowBase & {
  type: 'toggle';
  value: boolean;
  onValueChange: (v: boolean) => void;
};

export type NavRow = RowBase & {
  type: 'nav';
  valueText?: string;
};

export type Row = ToggleRow | NavRow;

export type Section = {
  title?: string;
  rows: Row[];
};
