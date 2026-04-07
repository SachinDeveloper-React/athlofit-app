import { FileText, LifeBuoy, LogOut, Mail, User, Shield } from 'lucide-react-native';
import { Section } from '../types/setting.types';

export const settingScreenService = {
  getSettingsSections: (
    profileName: string | undefined,
    profileEmail: string | undefined,
    callbacks: {
      onEditProfile: () => void;
      onEmail: () => void;
      onHelp: () => void;
      onTerms: () => void;
      onPrivacy: () => void;
      onSignOut: () => void;
    },
  ): Section[] => [
    {
      title: 'PERSONAL INFO',
      rows: [
        {
          key: 'edit',
          type: 'nav',
          title: 'EDIT PROFILE',
          icon: User,
          valueText: profileName,
          onPress: callbacks.onEditProfile,
        },
        {
          key: 'email',
          type: 'nav',
          title: 'EMAIL ADDRESS',
          icon: Mail,
          valueText: profileEmail,
          onPress: callbacks.onEmail,
        },
      ],
    },
    {
      title: 'ADDITIONAL OPTION',
      rows: [
        {
          key: 'help',
          type: 'nav',
          title: 'HELP & SUPPORT',
          icon: LifeBuoy,
          onPress: callbacks.onHelp,
        },
        {
          key: 'terms',
          type: 'nav',
          title: 'TERMS & CONDITIONS',
          icon: FileText,
          onPress: callbacks.onTerms,
        },
        {
          key: 'privacy',
          type: 'nav',
          title: 'PRIVACY POLICY',
          icon: Shield,
          onPress: callbacks.onPrivacy,
        },
        {
          key: 'signout',
          type: 'nav',
          title: 'SIGN OUT',
          icon: LogOut,
          iconColorKey: 'destructive',
          onPress: callbacks.onSignOut,
        },
      ],
    },
  ],
};
