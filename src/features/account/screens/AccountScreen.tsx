import { FlashList } from '@shopify/flash-list';
import React, { useCallback } from 'react';
import { Platform } from 'react-native';
import { AppText, AppView, Card, Icon, Screen, NotificationBell } from '../../../components';
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
import { useTabBarSpace } from '../../../navigation/tabBarLayout';

const packageJson = require('../../../../package.json');

type Props = {};

const AccountScreen = (props: Props) => {
  const { colors } = useTheme();
  const s = useAccountStyles(colors);
  const tabBarSpace = useTabBarSpace();

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
      <FlashList
        data={menu}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={
          <AppView>
            <Card style={s.profileCard} variant="outlined">
              <AppView style={s.profileTop}>
                <AccountAvatar
                  name={profile?.name}
                  uri={profile?.avatarUrl ?? undefined}
                />

                <AppView style={s.topRight}>
                  <AccountIconPill onPress={onNotifications}>
                    <NotificationBell
                      onPress={onNotifications}
                      size={18}
                      iconColor={withOpacity(colors.foreground, 0.7)}
                      showBadge={true}
                    />
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
        // Clears the floating tab bar. Was a hardcoded 100 — the same guess made
        // independently in Screen.tsx, TrackerScreen and ShopScreen — which falls
        // short once the bottom inset grows, leaving the last menu rows under the
        // bar and untappable on 3-button-navigation phones.
        contentContainerStyle={[
          s.listContent,
          {
            paddingBottom: tabBarSpace,
          },
        ]}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <AppView style={s.sep} />}
        ListFooterComponent={
          <AppView style={{ alignItems: 'center', marginTop: 24, marginBottom: 24 }}>
            <AppText style={{ fontSize: 12, opacity: 0.5 }}>
              Version {packageJson.version} ({Platform.OS === 'ios' ? 'iOS' : 'Android'})
            </AppText>
          </AppView>
        }
      />
    </Screen>
  );
};

export default AccountScreen;
