// src/features/account/hooks/useNotificationPreferences.ts

import { useCallback } from 'react';
import { Alert } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  NotificationCategory,
  NotificationPreferences,
  NotificationPrefsPatch,
  notificationPrefsService,
} from '../service/notificationPrefs.service';

const PREFS_KEY = ['notification-preferences'];

export const useNotificationPreferences = () => {
  const queryClient = useQueryClient();

  const { data: prefs, isLoading } = useQuery({
    queryKey: PREFS_KEY,
    queryFn: () => notificationPrefsService.get(),
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (patch: NotificationPrefsPatch) => notificationPrefsService.update(patch),

    // Optimistic, because a switch that lags behind the finger reads as broken
    // and invites the user to tap it again — which would queue a second,
    // contradictory write.
    onMutate: async (patch) => {
      await queryClient.cancelQueries({ queryKey: PREFS_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(PREFS_KEY);
      if (previous) {
        const { masterEnabled, ...categories } = patch;
        queryClient.setQueryData<NotificationPreferences>(PREFS_KEY, {
          ...previous,
          masterEnabled: masterEnabled ?? previous.masterEnabled,
          categories: { ...previous.categories, ...categories },
        });
      }
      return { previous };
    },

    onError: (_err, _patch, context) => {
      // Roll back, so the UI never claims a preference was saved when it was
      // not — a silently-lost mute is how a user concludes the setting is fake.
      if (context?.previous) {
        queryClient.setQueryData(PREFS_KEY, context.previous);
      }
      Alert.alert(
        'Could Not Save',
        'Your notification preference could not be saved. Please try again.',
      );
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: PREFS_KEY });
    },
  });

  const setCategory = useCallback(
    (category: NotificationCategory, value: boolean) => {
      mutation.mutate({ [category]: value } as NotificationPrefsPatch);
    },
    [mutation],
  );

  const setMaster = useCallback(
    (value: boolean) => {
      mutation.mutate({ masterEnabled: value });
    },
    [mutation],
  );

  return { prefs, isLoading, setCategory, setMaster };
};
