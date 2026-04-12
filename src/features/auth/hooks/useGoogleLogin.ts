// src/features/auth/hooks/useGoogleLogin.ts
import { useMutation } from '@tanstack/react-query';
import { authService } from '../service/authService';
import { useAuthStore } from '../store/authStore';

// NOTE: Requires @react-native-google-signin/google-signin to be installed.
// Install: npm install @react-native-google-signin/google-signin
// Then: cd ios && pod install && rebuild
//
// In your app entry (App.tsx or equivalent), configure Google Sign-In:
//   import { GoogleSignin } from '@react-native-google-signin/google-signin';
//   GoogleSignin.configure({ webClientId: 'YOUR_WEB_CLIENT_ID' });

let GoogleSignin: any = null;
try {
  // Dynamic import so the app does not crash if not yet installed
  GoogleSignin = require('@react-native-google-signin/google-signin').GoogleSignin;
} catch {
  console.warn('[useGoogleLogin] @react-native-google-signin/google-signin is not installed.');
}

export function useGoogleLogin() {
  const setAuth = useAuthStore(s => s.setAuth);

  return useMutation({
    mutationFn: async () => {
      if (!GoogleSignin) {
        throw new Error('Google Sign-In is not configured. Please install @react-native-google-signin/google-signin.');
      }

      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const userInfo = await GoogleSignin.signIn();

      // idToken is in userInfo.data.idToken (v13+) or userInfo.idToken (older)
      const idToken = userInfo?.data?.idToken ?? userInfo?.idToken;
      if (!idToken) throw new Error('Google sign-in did not return an idToken');

      const response = await authService.googleLogin(idToken);
      if (!response.success) throw new Error(response.message);
      return response;
    },
    onSuccess: response => {
      const { data } = response;
      if (data?.user && data?.accessToken && data?.refreshToken) {
        setAuth(data.user, {
          accessToken: data.accessToken,
          refreshToken: data.refreshToken,
          expiresIn: 36000,
        });
      }
    },
  });
}
