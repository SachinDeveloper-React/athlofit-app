import { Fragment, memo } from 'react';
import { AppText, AppView } from '../../../../components';
import {
  getConfidenceLabel,
  getHeartRateZone,
  HeartRateResult,
} from '../../service/heartRate.service';
import { StyleSheet } from 'react-native';

export const HeartRateResultCard = memo(
  ({ result }: { result: HeartRateResult }) => {
    const zone = getHeartRateZone(result.bpm);
    const conf = getConfidenceLabel(result.confidence);
    return (
      <AppView style={s.resultCard}>
        <AppText style={s.resultBpm}>{result.bpm}</AppText>
        <AppText style={s.resultUnit}>bpm</AppText>
        <AppView style={[s.zoneBadge, { backgroundColor: zone.bg }]}>
          <AppText style={[s.zoneTxt, { color: zone.color }]}>
            {zone.label}
          </AppText>
        </AppView>
        <AppText style={[s.confTxt, { color: conf.color }]}>
          {conf.text}
        </AppText>
        <AppView style={s.statsRow}>
          {[
            { label: 'peaks', value: String(result.peaksDetected) },
            { label: 'frames', value: String(result.samplesUsed) },
            { label: 'seconds', value: String(result.durationS) },
          ].map((stat, i, arr) => (
            <Fragment key={stat.label}>
              <AppView style={s.stat}>
                <AppText style={s.statVal}>{stat.value}</AppText>
                <AppText style={s.statLbl}>{stat.label}</AppText>
              </AppView>
              {i < arr.length - 1 && <AppView style={s.statDiv} />}
            </Fragment>
          ))}
        </AppView>
      </AppView>
    );
  },
);

const s = StyleSheet.create({
  resultCard: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    alignItems: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(0,0,0,0.07)',
    marginBottom: 16,
  },
  resultBpm: {
    fontSize: 84,
    fontWeight: '700',
    color: '#1a1a1a',
    lineHeight: 92,
  },
  resultUnit: { fontSize: 18, color: '#aaa', marginTop: 2 },
  zoneBadge: {
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  zoneTxt: { fontSize: 13, fontWeight: '500' },
  confTxt: { fontSize: 12, marginBottom: 20 },
  statsRow: {
    flexDirection: 'row',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(0,0,0,0.07)',
    paddingTop: 16,
    width: '100%',
  },
  stat: { flex: 1, alignItems: 'center' },
  statVal: { fontSize: 16, fontWeight: '600', color: '#1a1a1a' },
  statLbl: { fontSize: 10, color: '#aaa', marginTop: 2 },
  statDiv: { width: 0.5, backgroundColor: 'rgba(0,0,0,0.07)' },
});
