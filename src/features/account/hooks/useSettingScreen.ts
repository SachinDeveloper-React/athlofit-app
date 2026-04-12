import { useCallback, useMemo } from 'react';
import { useAuthStore } from '../../auth/store/authStore';
import { tokenService } from '../../auth/service/tokenService';
import { navigate } from '../../../navigation/navigationRef';
import { AccountRoutes, RootRoutes } from '../../../navigation/routes';
import { settingScreenService } from '../service/settingScreenService';
import { useUnitSystem } from './useUnitSystem';

export const useSettingScreen = () => {
  const profile = useAuthStore(s => s.user);
  const logout = useAuthStore(state => state.logout);
  const { isMetric, switchUnit } = useUnitSystem();

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
    ],
  );

  return {
    sections,
  };
};
