import { useRef, useState } from 'react';
import { useTheme } from '../../../../hooks/useTheme';
import { DateFieldProps } from '../../types/completeProfile.types';
import { StyleSheet, Text, TextInput, View } from 'react-native';

export const DateField: React.FC<DateFieldProps> = ({
  value,
  onChange,
  error,
}) => {
  const { colors } = useTheme();
  const [day, setDay] = useState(value ? value.split('-')[2] ?? '' : '');
  const [month, setMonth] = useState(value ? value.split('-')[1] ?? '' : '');
  const [year, setYear] = useState(value ? value.split('-')[0] ?? '' : '');

  const monthRef = useRef<TextInput>(null);
  const yearRef = useRef<TextInput>(null);

  const sync = (d: string, m: string, y: string) => {
    if (d.length === 2 && m.length === 2 && y.length === 4) {
      onChange(`${y}-${m}-${d}`);
    } else {
      onChange('');
    }
  };

  const borderCol = error ? colors.destructive : colors.border;

  return (
    <View style={dt.wrapper}>
      <Text
        style={[
          dt.label,
          { color: error ? colors.destructive : colors.foreground },
        ]}
      >
        Date of birth
      </Text>
      <Text style={[dt.hint, { color: colors.mutedForeground }]}>
        DD / MM / YYYY
      </Text>

      <View style={dt.row}>
        {/* Day */}
        <TextInput
          style={[
            dt.seg,
            dt.segSm,
            {
              backgroundColor: colors.inputBackground,
              borderColor: borderCol,
              color: colors.foreground,
            },
          ]}
          placeholder="DD"
          placeholderTextColor={colors.mutedForeground}
          value={day}
          onChangeText={v => {
            const clean = v.replace(/\D/g, '').slice(0, 2);
            setDay(clean);
            sync(clean, month, year);
            if (clean.length === 2) monthRef.current?.focus();
          }}
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
          selectionColor={colors.primary}
        />
        <Text style={[dt.sep, { color: colors.mutedForeground }]}>/</Text>

        {/* Month */}
        <TextInput
          ref={monthRef}
          style={[
            dt.seg,
            dt.segSm,
            {
              backgroundColor: colors.inputBackground,
              borderColor: borderCol,
              color: colors.foreground,
            },
          ]}
          placeholder="MM"
          placeholderTextColor={colors.mutedForeground}
          value={month}
          onChangeText={v => {
            const clean = v.replace(/\D/g, '').slice(0, 2);
            setMonth(clean);
            sync(day, clean, year);
            if (clean.length === 2) yearRef.current?.focus();
          }}
          keyboardType="number-pad"
          maxLength={2}
          textAlign="center"
          selectionColor={colors.primary}
        />
        <Text style={[dt.sep, { color: colors.mutedForeground }]}>/</Text>

        {/* Year */}
        <TextInput
          ref={yearRef}
          style={[
            dt.seg,
            dt.segLg,
            {
              backgroundColor: colors.inputBackground,
              borderColor: borderCol,
              color: colors.foreground,
            },
          ]}
          placeholder="YYYY"
          placeholderTextColor={colors.mutedForeground}
          value={year}
          onChangeText={v => {
            const clean = v.replace(/\D/g, '').slice(0, 4);
            setYear(clean);
            sync(day, month, clean);
          }}
          keyboardType="number-pad"
          maxLength={4}
          textAlign="center"
          selectionColor={colors.primary}
        />
      </View>
      {!!error && (
        <Text style={[dt.error, { color: colors.destructive }]}>{error}</Text>
      )}
    </View>
  );
};

const dt = StyleSheet.create({
  wrapper: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '500', marginBottom: 4 },
  hint: { fontSize: 12, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  seg: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  segSm: { width: 68 },
  segLg: { width: 88 },
  sep: { fontSize: 20, fontWeight: '300' },
  error: { fontSize: 12, marginTop: 6 },
});
