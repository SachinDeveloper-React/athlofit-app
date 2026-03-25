import { StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { memo } from 'react';

export const InstructionCard = memo(() => {
  return (
    <AppView style={s.instrCard}>
      <AppText style={s.instrEmoji}>👆</AppText>
      <AppText style={s.instrTitle}>How to measure</AppText>
      {[
        'Cover the rear camera AND flash with your fingertip',
        'Apply gentle, steady pressure — not too hard',
        'Keep completely still for 30 seconds',
        "The screen will turn red — that's normal",
      ].map((step, i) => (
        <AppView key={i} style={s.instrStep}>
          <AppView style={s.instrBullet}>
            <AppText style={s.instrNum}>{i + 1}</AppText>
          </AppView>
          <AppText style={s.instrTxt}>{step}</AppText>
        </AppView>
      ))}
    </AppView>
  );
});
const s = StyleSheet.create({
  instrCard: {
    width: '100%',
    borderRadius: 16,
    padding: 20,
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
    marginVertical: 20,
  },
  instrEmoji: { fontSize: 32, marginBottom: 10 },
  instrTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 14,
  },
  instrStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
    gap: 10,
  },
  instrBullet: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instrNum: { color: '#fff', fontSize: 11, fontWeight: '600' },
  instrTxt: { flex: 1, fontSize: 13, color: '#666', lineHeight: 18 },
});
