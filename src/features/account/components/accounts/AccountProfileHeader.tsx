import React, { memo, useMemo } from 'react';
import { Image, Pressable, StyleSheet } from 'react-native';
import { ChevronRight, Pencil, Wallet } from 'lucide-react-native';
import { withOpacity } from '../../../../utils/withOpacity';
import { AppText, AppView } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';


type Props = {
  name?: string;
  email?: string;
  avatarUrl?: string;

  coins?: number;
  streakDays?: number;

  onPressProfile?: () => void;
  onPressEdit?: () => void;
  onPressWallet?: () => void;
};

export const AccountProfileHeader = memo(
  ({
    name = 'Athlofit User',
    email = 'user@athlofit.com',
    avatarUrl,
    coins = 0,
    streakDays = 0,
    onPressProfile,
    onPressEdit,
    onPressWallet,
  }: Props) => {
    const { colors } = useTheme();

    const initials = useMemo(() => {
      const parts = (name || '').trim().split(/\s+/).slice(0, 2);
      const a = parts[0]?.[0] ?? 'A';
      const b = parts[1]?.[0] ?? '';
      return (a + b).toUpperCase();
    }, [name]);

    const subtleBorder = withOpacity(colors.foreground, 0.1);
    const subText = withOpacity(colors.foreground, 0.55);

    return (
      <AppView style={styles.wrap}>
        {/* Android-safe glow */}
        <AppView
          pointerEvents="none"
          style={[
            styles.glow,
            { backgroundColor: withOpacity(colors.primary, 0.1) },
          ]}
        />
        <AppView
          pointerEvents="none"
          style={[
            styles.glow2,
            { backgroundColor: withOpacity(colors.primary, 0.06) },
          ]}
        />

        {/* Top row */}
        <Pressable
          onPress={onPressProfile}
          android_ripple={{ color: withOpacity(colors.primary, 0.14) }}
          style={({ pressed }) => [
            styles.topRow,
            pressed ? { opacity: 0.98 } : null,
          ]}
        >
          {/* Avatar */}
          <AppView
            style={[
              styles.avatar,
              {
                borderColor: subtleBorder,
                backgroundColor: withOpacity(colors.primary, 0.1),
              },
            ]}
          >
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatarImg} />
            ) : (
              <AppText
                variant="title1"
                style={{
                  color: colors.primary,
                  fontWeight: '900',
                  letterSpacing: 0.8,
                }}
              >
                {initials}
              </AppText>
            )}
          </AppView>

          {/* Name + email */}
          <AppView style={{ flex: 1 }}>
            <AppText
              variant="title1"
              numberOfLines={1}
            >
              {name}
            </AppText>
            <AppText
              variant="caption1"
              style={{ color: subText, marginTop: 2 }}
              numberOfLines={1}
            >
              {email}
            </AppText>

            {/* Chips row */}
            <AppView style={styles.chipsRow}>
              <Chip
                label={`${coins} coins`}
                icon={<Wallet size={14} color={colors.primary} />}
              />
              <Chip
                label={`${streakDays}d streak`}
                icon={
                  <ChevronRight
                    size={14}
                    color={withOpacity(colors.foreground, 0.35)}
                  />
                }
                subtle
              />
            </AppView>
          </AppView>

          <ChevronRight
            size={20}
            color={withOpacity(colors.foreground, 0.4)}
          />
        </Pressable>

        {/* Quick actions */}
        <AppView style={styles.actionsRow}>
          <ActionPill
            label="Edit Profile"
            icon={<Pencil size={16} color={colors.primary} />}
            onPress={onPressEdit}
          />
          <ActionPill
            label="Wallet"
            icon={<Wallet size={16} color={colors.primary} />}
            onPress={onPressWallet}
          />
        </AppView>
      </AppView>
    );

    function Chip({
      label,
      icon,
      subtle,
    }: {
      label: string;
      icon?: React.ReactNode;
      subtle?: boolean;
    }) {
      return (
        <AppView
          style={[
            styles.chip,
            {
              backgroundColor: subtle
                ? withOpacity(colors.foreground, 0.06)
                : withOpacity(colors.primary, 0.12),
              borderColor: withOpacity(colors.foreground, 0.08),
            },
          ]}
        >
          {!!icon && <AppView>{icon}</AppView>}
          <AppText
            variant="caption1"
            style={{
              color: subtle
                ? withOpacity(colors.foreground, 0.65)
                : colors.primary,
              fontWeight: '800',
              letterSpacing: 0.4,
            }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </AppView>
      );
    }

    function ActionPill({
      label,
      icon,
      onPress,
    }: {
      label: string;
      icon: React.ReactNode;
      onPress?: () => void;
    }) {
      return (
        <Pressable
          onPress={onPress}
          android_ripple={{ color: withOpacity(colors.primary, 0.14) }}
          style={({ pressed }) => [
            styles.actionPill,
            {
              borderColor: subtleBorder,
              backgroundColor: withOpacity(colors.foreground, 0.03),
            },
            pressed ? { opacity: 0.98 } : null,
          ]}
        >
          {icon}
          <AppText
            variant="caption1"
            style={{ fontWeight: '900', letterSpacing: 0.6 }}
            numberOfLines={1}
          >
            {label}
          </AppText>
        </Pressable>
      );
    }
  },
);

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 10,
    paddingBottom: 18,
  },

  // android-safe glow layers
  glow: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 999,
    top: -160,
    right: -160,
  },
  glow2: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 999,
    bottom: -150,
    left: -150,
  },

  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 14,
    paddingVertical: 12,
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarImg: {
    width: '100%',
    height: '100%',
  },

  chipsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },

  actionsRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 12,
  },
  actionPill: {
    flex: 1,
    height: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    overflow: 'hidden',
  },
});
