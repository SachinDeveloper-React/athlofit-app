import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../../auth/store/authStore';
import { tokenService } from '../../auth/service/tokenService';
import { navigate } from '../../../navigation/navigationRef';
import { AccountRoutes, RootRoutes } from '../../../navigation/routes';
import { settingScreenService } from '../service/settingScreenService';
import { useUnitSystem } from './useUnitSystem';
import { useAccountDeletion } from './useAccountDeletion';

export const useSettingScreen = () => {
  const profile = useAuthStore(s => s.user);
  const logout = useAuthStore(state => state.logout);
  const { isMetric, switchUnit } = useUnitSystem();
  
  const {
    deletionStatus,
    requestDeletion,
    cancelDeletion,
    isRequestingDeletion,
    isCancellingDeletion,
  } = useAccountDeletion();

  const onEditProfile = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.EDIT_PROFILE,
    });
  }, []);

  const onEmail = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.EDIT_PROFILE,
    });
  }, []);

  const onHelp = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.HELP_SUPPORT,
    });
  }, []);

  const onTerms = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.TERMS,
    });
  }, []);

  const onPrivacy = useCallback(() => {
    navigate(RootRoutes.ACCOUNT_NAVIGATOR, {
      screen: AccountRoutes.PRIVACY,
    });
  }, []);

  const onSignOut = useCallback(() => {
    tokenService.clear();
    logout();
  }, [logout]);

  const onDeleteAccount = useCallback(() => {
    requestDeletion();
  }, [requestDeletion]);

  const onCancelDeletion = useCallback(() => {
    cancelDeletion();
  }, [cancelDeletion]);

  const sections = useMemo(
    () =>
      settingScreenService.getSettingsSections(profile?.name, profile?.email, {
        onEditProfile,
        onEmail,
        onHelp,
        onTerms,
        onPrivacy,
        onSignOut,
        isMetric,
        onUnitToggle: (v: boolean) => switchUnit(v ? 'metric' : 'imperial'),
        onDeleteAccount,
        onCancelDeletion,
        deletionStatus: deletionStatus?.status,
        scheduledDeletionDate: deletionStatus?.scheduledDeletionDate,
      }),
    [
      profile?.name,
      profile?.email,
      onEditProfile,
      onEmail,
      onHelp,
      onTerms,
      onPrivacy,
      onSignOut,
      isMetric,
      switchUnit,
      onDeleteAccount,
      onCancelDeletion,
      deletionStatus?.status,
      deletionStatus?.scheduledDeletionDate,
    ],
  );

  return {
    sections,
    isRequestingDeletion,
    isCancellingDeletion,
  };
};
