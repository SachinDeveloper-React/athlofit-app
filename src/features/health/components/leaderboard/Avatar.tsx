import React from 'react';
import { View } from 'react-native';
import { AppText } from '../../../../components';

type Props = {
  name: string;
  size?: number;
  color?: string;
};

const Avatar: React.FC<Props> = ({ name, size = 48, color = '#6366f1' }) => (
  <View
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color + '30',
      borderWidth: 2,
      borderColor: color,
      alignItems: 'center',
      justifyContent: 'center',
    }}
  >
    <AppText weight="bold" style={{ color, fontSize: size * 0.36 }}>
      {name?.charAt(0)?.toUpperCase() ?? '?'}
    </AppText>
  </View>
);

export default Avatar;
