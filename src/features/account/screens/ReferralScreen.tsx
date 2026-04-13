// src/features/account/screens/ReferralScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Share,
  Clipboard,
  TextInput,
  RefreshControl,
} from 'react-native';
import {
  AppText,
  AppView,
  Header,
  Screen,
  Button,
  useToast,
  Icon,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { useReferral } from '../hooks/useReferral';
import { formatCoins } from '../../../config/appConfig';

const ReferralScreen: React.FC = () => {
  const { colors } = useTheme();
  const toast = useToast();
  const [inputCode, setInputCode] = useState('');
  const { stats, isLoading, isRefetching, refetch, applyCode, isApplying } =
    useReferral();

  const handleCopy = useCallback(() => {
    if (!stats?.referralCode) return;
    Clipboard.setString(stats.referralCode);
    toast.success('Referral code copied! 📋');
  }, [stats?.referralCode]);

  const handleShare = useCallback(async () => {
    if (!stats?.referralCode) return;
    try {
      await Share.share({
        message: `Join me on Athlofit and get 50 bonus coins! 🎉\n\nUse my referral code: ${stats.referralCode}\n\nDownload Athlofit and start your health journey today!`,
        title: 'Join Athlofit',
      });
    } catch {}
  }, [stats?.referralCode]);

  const handleApply = useCallback(() => {
    const code = inputCode.trim().toUpperCase();
    if (!code) {
      toast.error('Please enter a referral code');
      return;
    }
    applyCode(code, {
      onSuccess: res => {
        toast.success(res?.message ?? 'Referral code applied! 🎉');
        setInputCode('');
      },
      onError: (err: any) => {
        toast.error(err?.message ?? 'Failed to apply referral code');
      },
    });
  }, [inputCode, applyCode]);

  return (
    <Screen
      scroll
      safeArea={false}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching}
          onRefresh={refetch}
          tintColor={colors.primary}
        />
      }
      header={<Header title="Refer & Earn" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        {/* ── Hero card ── */}
        <AppView
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.primary + '14',
              borderColor: colors.primary + '35',
            },
          ]}
        >
          <AppText
            style={{ fontSize: 48, textAlign: 'center', marginBottom: 12 }}
          >
            🎁
          </AppText>
          <AppText
            variant="title2"
            weight="bold"
            align="center"
            style={{ marginBottom: 6 }}
          >
            Share & Earn Coins
          </AppText>
          <AppText
            variant="callout"
            align="center"
            style={{ opacity: 0.65, lineHeight: 22 }}
          >
            Share your code with friends. When they join and use it, you both
            get rewarded!
          </AppText>

          {/* Coin reward breakdown */}
          <AppView
            style={[
              styles.rewardRow,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <AppView center style={{ flex: 1 }}>
              <AppText
                variant="title2"
                weight="bold"
                style={{ color: '#f59e0b' }}
              >
                +{stats?.referrerBonus ?? 100}
              </AppText>
              <AppText
                variant="caption1"
                style={{ opacity: 0.6, marginTop: 2 }}
              >
                You earn
              </AppText>
            </AppView>
            <AppView
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
            <AppView center style={{ flex: 1 }}>
              <AppText
                variant="title2"
                weight="bold"
                style={{ color: colors.primary }}
              >
                +{stats?.refereeBonus ?? 50}
              </AppText>
              <AppText
                variant="caption1"
                style={{ opacity: 0.6, marginTop: 2 }}
              >
                Friend earns
              </AppText>
            </AppView>
          </AppView>
        </AppView>

        {/* ── My Referral Code ── */}
        <AppView
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText
            variant="footnote"
            weight="semiBold"
            style={{ opacity: 0.5, letterSpacing: 0.5, marginBottom: 12 }}
          >
            YOUR REFERRAL CODE
          </AppText>

          <AppView
            style={[
              styles.codeBox,
              {
                backgroundColor: colors.primary + '10',
                borderColor: colors.primary + '40',
              },
            ]}
          >
            <AppText
              variant="largeTitle"
              weight="bold"
              style={{ color: colors.primary, letterSpacing: 6, fontSize: 28 }}
            >
              {stats?.referralCode ?? '------'}
            </AppText>
          </AppView>

          <AppView row style={{ gap: 12, marginTop: 16 }}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primary + '15', flex: 1 },
              ]}
              onPress={handleCopy}
            >
              <Icon name="Copy" size={18} color={colors.primary} />
              <AppText
                variant="callout"
                weight="semiBold"
                style={{ color: colors.primary, marginLeft: 6 }}
              >
                Copy
              </AppText>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                { backgroundColor: colors.primary, flex: 1 },
              ]}
              onPress={handleShare}
            >
              <Icon name="Share2" size={18} color="#fff" />
              <AppText
                variant="callout"
                weight="semiBold"
                style={{ color: '#fff', marginLeft: 6 }}
              >
                Share
              </AppText>
            </TouchableOpacity>
          </AppView>
        </AppView>

        {/* ── Stats ── */}
        <AppView row style={{ gap: 12 }}>
          <AppView
            style={[
              styles.statCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppText
              variant="title2"
              weight="bold"
              style={{ color: colors.primary }}
            >
              {stats?.totalReferred ?? 0}
            </AppText>
            <AppText variant="caption1" style={{ opacity: 0.55, marginTop: 2 }}>
              Friends Referred
            </AppText>
          </AppView>
          <AppView
            style={[
              styles.statCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppText
              variant="title2"
              weight="bold"
              style={{ color: '#f59e0b' }}
            >
              {formatCoins(stats?.bonusCoinsEarned ?? 0)}
            </AppText>
            <AppText variant="caption1" style={{ opacity: 0.55, marginTop: 2 }}>
              Coins Earned
            </AppText>
          </AppView>
        </AppView>

        {/* ── Apply a friend's code ── */}
        <AppView
          style={[
            styles.card,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <AppText
            variant="footnote"
            weight="semiBold"
            style={{ opacity: 0.5, letterSpacing: 0.5, marginBottom: 12 }}
          >
            HAVE A FRIEND'S CODE?
          </AppText>
          <AppText
            variant="callout"
            style={{ opacity: 0.65, marginBottom: 16, lineHeight: 20 }}
          >
            Enter your friend's referral code below to earn{' '}
            {stats?.refereeBonus ?? 50} bonus coins instantly!
          </AppText>

          <AppView
            style={[
              styles.inputRow,
              {
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          >
            <TextInput
              value={inputCode}
              onChangeText={t => setInputCode(t.toUpperCase())}
              placeholder="ENTER CODE"
              placeholderTextColor={colors.foreground + '40'}
              maxLength={8}
              autoCapitalize="characters"
              style={[styles.codeInput, { color: colors.foreground }]}
            />
          </AppView>

          <Button
            label={isApplying ? 'Applying...' : 'Apply Code'}
            onPress={handleApply}
            loading={isApplying}
            fullWidth
            size="lg"
            style={{ marginTop: 12 }}
          />
        </AppView>

        {/* ── Recent referrals ── */}
        {(stats?.referrals ?? []).length > 0 && (
          <AppView
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppText
              variant="footnote"
              weight="semiBold"
              style={{ opacity: 0.5, letterSpacing: 0.5, marginBottom: 12 }}
            >
              FRIENDS YOU REFERRED
            </AppText>
            {(stats?.referrals ?? []).map(ref => (
              <AppView
                key={ref.id}
                row
                style={[styles.refRow, { borderBottomColor: colors.border }]}
              >
                <AppView
                  style={[
                    styles.refAvatar,
                    { backgroundColor: colors.primary + '20' },
                  ]}
                >
                  <AppText weight="bold" style={{ color: colors.primary }}>
                    {ref.name.charAt(0).toUpperCase()}
                  </AppText>
                </AppView>
                <AppView style={{ flex: 1, marginLeft: 10 }}>
                  <AppText variant="callout" weight="semiBold">
                    {ref.name}
                  </AppText>
                  <AppText variant="caption1" style={{ opacity: 0.5 }}>
                    {new Date(ref.joinedAt).toLocaleDateString()}
                  </AppText>
                </AppView>
                {ref.bonusAwarded && (
                  <AppText
                    variant="caption1"
                    style={{ color: '#10b981', fontWeight: '600' }}
                  >
                    +100 🪙
                  </AppText>
                )}
              </AppView>
            ))}
          </AppView>
        )}

        <AppView style={{ height: 40 }} />
      </AppView>
    </Screen>
  );
};

export default ReferralScreen;

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  heroCard: {
    borderRadius: 24,
    borderWidth: 1,
    padding: 24,
    marginBottom: 16,
    alignItems: 'center',
  },
  rewardRow: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    paddingVertical: 14,
    marginTop: 20,
    width: '100%',
  },
  divider: { width: 1, marginVertical: 8 },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 20,
    marginBottom: 14,
  },
  codeBox: {
    borderRadius: 16,
    borderWidth: 2,
    paddingVertical: 18,
    alignItems: 'center',
    borderStyle: 'dashed',
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 14,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  inputRow: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 16,
  },
  codeInput: {
    height: 52,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 4,
    textAlign: 'center',
  },
  refRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  refAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
