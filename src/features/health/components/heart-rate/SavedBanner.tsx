import { StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { memo } from 'react';

export const SavedBanner = memo(() => {
  return (
    <AppView style={s.savedBanner}>
      <AppText style={s.savedTxt}>✓ Saved to Health Connect</AppText>
    </AppView>
  );
});

const s = StyleSheet.create({
  savedBanner: {
    backgroundColor: '#EAF3DE',
    borderRadius: 10,
    paddingVertical: 13,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  savedTxt: { color: '#3B6D11', fontWeight: '500', fontSize: 15 },
});
