// src/features/auth/hooks/useGoogleLogin.ts
import { useMutation } from '@tanstack/react-query';
import { GoogleSignin } from '@react-native-google-signin/google-signin';
import { authService } from '../service/authService';
import { useAuthStore } from '../store/authStore';

export function useGoogleLogin() {
  const setAuth = useAuthStore(s => s.setAuth);

  return useMutation({
    mutationFn: async () => {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

      const result = await GoogleSignin.signIn();

      // Support both v13+ shape (result.data) and older shape (result directly)
      const data   = (result as any)?.data ?? result;
      const idToken = data?.idToken;

      if (!idToken) throw new Error('Google sign-in did not return an idToken');

      // Extract all useful profile fields from the Google response
      const user          = data?.user ?? {};
      const givenName     = user.givenName     ?? null;
      const familyName    = user.familyName    ?? null;
      const photo         = user.photo         ?? null;
      const scopes        = data?.scopes       ?? [];
      const serverAuthCode = data?.serverAuthCode ?? null;

      const response = await authService.googleLogin(idToken, {
        givenName,
        familyName,
        photo,
        scopes,
        serverAuthCode,
      });

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
