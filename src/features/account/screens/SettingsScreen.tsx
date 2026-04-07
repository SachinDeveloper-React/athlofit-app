import React, { useMemo } from 'react';
import { AppText, Screen, AppView, Header, Card } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { SettingsRow } from '../components/settings/SettingsRow';
import { useSettingStyles } from '../styles/useSettingStyles';
import { useSettingScreen } from '../hooks/useSettingScreen';

type Props = {};

const SettingsScreen = (props: Props) => {
  const { colors } = useTheme();
  const s = useMemo(() => useSettingStyles(colors), [colors]);
  const { sections } = useSettingScreen();

  return (
    <Screen
      scroll
      header={<Header title="Account Setting" showBack backLabel="" />}
      safeArea={false}
    >
      <AppView style={s.page}>
        {sections.map((sec, i) => (
          <AppView key={sec.title ?? `sec-${i}`} style={s.section}>
            {sec.title ? (
              <AppText variant="headline" style={s.sectionTitle}>
                {sec.title}
              </AppText>
            ) : null}

            <Card>
              {sec.rows.map((row, idx) => (
                <SettingsRow
                  key={row.key}
                  row={row}
                  isFirst={idx === 0}
                  isLast={idx === sec.rows.length - 1}
                />
              ))}
            </Card>
          </AppView>
        ))}
      </AppView>
    </Screen>
  );
};

export default SettingsScreen;
