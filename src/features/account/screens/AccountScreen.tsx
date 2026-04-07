import { FlatList, StyleSheet } from 'react-native';
import React, { useCallback } from 'react';
import { AppText, AppView, Card, Icon, Screen } from '../../../components';
import {
  AccountAvatar,
  AccountIconPill,
  AccountSettingsRow,
  AccountStatPill,
  useAccountStyles,
} from '../components/accounts';
import { withOpacity } from '../../../utils/withOpacity';
import { useTheme } from '../../../hooks/useTheme';
import { MenuRow } from '../types/account.types';
import { useAccountScreen } from '../hooks/useAccountScreen';

type Props = {};

const AccountScreen = (props: Props) => {
  const { colors } = useTheme();
  const s = useAccountStyles(colors);

  const {
    profile,
    name,
    premiumLabel,
    statItems,
    menu,
    onNotifications,
    onSettings,
  } = useAccountScreen();

  const renderRow = useCallback(
    ({ item }: { item: MenuRow }) => <AccountSettingsRow item={item} />,
    [],
  );

  const keyExtractor = useCallback((it: MenuRow) => it.key, []);

  return (
    <Screen scroll={false}>
      <FlatList
        data={menu}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={
          <AppView>
            <Card style={s.profileCard} variant="outlined">
              <AppView style={s.profileTop}>
                <AccountAvatar
                  uri={
                    profile?.avatarUrl ??
                    'https://plus.unsplash.com/premium_photo-1673458333581-c2bfab6f0f69?q=80&w=2070'
                  }
                />

                <AppView style={s.topRight}>
                  <AccountIconPill onPress={onNotifications}>
                    <Icon
                      name="Bell"
                      size={18}
                      color={withOpacity(colors.foreground, 0.7)}
                    />

                    <AppView style={s.dot} />
                  </AccountIconPill>
                  <AccountIconPill onPress={onSettings}>
                    <Icon
                      name="Settings"
                      size={18}
                      color={withOpacity(colors.foreground, 0.7)}
                    />
                  </AccountIconPill>
                </AppView>
              </AppView>

              <AppView style={s.nameBlock}>
                <AppText style={s.name}>{name}</AppText>
                <AppText style={s.premium}>{premiumLabel}</AppText>
              </AppView>

              <AppView style={s.statsRow}>
                {statItems.map(st => (
                  <AccountStatPill key={st.key} item={st} />
                ))}
              </AppView>
            </Card>

            <AppText style={s.sectionTitle}>SETTINGS &amp; SHOP</AppText>
          </AppView>
        }
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        removeClippedSubviews
        initialNumToRender={8}
        windowSize={10}
        maxToRenderPerBatch={8}
        updateCellsBatchingPeriod={16}
        ItemSeparatorComponent={() => <AppView style={s.sep} />}
        ListFooterComponent={<AppView style={{ height: 24 }} />}
      />
    </Screen>
  );
};

export default AccountScreen;
