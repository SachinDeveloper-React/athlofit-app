import { StyleSheet } from 'react-native';
import { AppText, AppView } from '../../../../components';
import { MEASURE_DURATION_S } from '../../service/heartRate.service';
import { memo } from 'react';

export const ProgressRing = memo(({ progress }: { progress: number }) => {
  const remaining = Math.max(
    0,
    Math.round(MEASURE_DURATION_S * (1 - progress)),
  );
  const p = Math.min(progress, 1);
  return (
    <AppView style={s.ringWrap}>
      <AppView style={s.ringTrack} />
      <AppView
        style={[
          s.ringArc,
          {
            borderTopColor: '#D85A30',
            borderRightColor: p > 0.25 ? '#D85A30' : 'transparent',
            borderBottomColor: p > 0.5 ? '#D85A30' : 'transparent',
            borderLeftColor: p > 0.75 ? '#D85A30' : 'transparent',
            transform: [{ rotate: '-90deg' }],
          },
        ]}
      />
      <AppView style={s.ringInner}>
        <AppText style={s.ringNum}>{remaining}</AppText>
        <AppText style={s.ringSub}>seconds left</AppText>
      </AppView>
    </AppView>
  );
});
const RING = 180;
const s = StyleSheet.create({
  saveTxt: { fontSize: 15, color: '#fff', fontWeight: '500' },
  ringWrap: {
    width: RING,
    height: RING,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
  },
  ringTrack: {
    position: 'absolute',
    width: RING,
    height: RING,
    borderRadius: RING / 2,
    borderWidth: 7,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  ringArc: {
    position: 'absolute',
    width: RING - 14,
    height: RING - 14,
    borderRadius: (RING - 14) / 2,
    borderWidth: 7,
  },
  ringInner: { alignItems: 'center' },
  ringNum: { fontSize: 48, fontWeight: '700', color: '#fff' },
  ringSub: { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
});
