// src/features/account/hooks/useAccountDeletion.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { accountDeletionService, RequestDeletionPayload } from '../service/accountDeletion.service';
import { Alert } from 'react-native';

export const useAccountDeletion = () => {
  const queryClient = useQueryClient();

  // Get deletion status
  const { data: statusData, isLoading: isLoadingStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['account-deletion-status'],
    queryFn: () => accountDeletionService.getDeletionStatus(),
    staleTime: 30000, // 30 seconds
  });

  const deletionStatus = statusData;

  // Request deletion mutation
  const requestDeletionMutation = useMutation({
    mutationFn: (payload: RequestDeletionPayload) => accountDeletionService.requestDeletion(payload),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['account-deletion-status'] });
      Alert.alert(
        'Deletion Requested',
        `Your account is scheduled for deletion on ${new Date(response.scheduledDeletionDate).toLocaleDateString()}. You can cancel this request anytime before that date.`,
        [{ text: 'OK' }]
      );
    },
    onError: (error: any) => {
      Alert.alert(
        'Request Failed',
        error?.response?.data?.message || 'Failed to request account deletion. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Cancel deletion mutation
  const cancelDeletionMutation = useMutation({
    mutationFn: () => accountDeletionService.cancelDeletion(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['account-deletion-status'] });
      Alert.alert(
        'Cancellation Successful',
        'Your account deletion request has been cancelled. Your account is safe.',
        [{ text: 'OK' }]
      );
    },
    onError: (error: any) => {
      Alert.alert(
        'Cancellation Failed',
        error?.response?.data?.message || 'Failed to cancel deletion request. Please try again.',
        [{ text: 'OK' }]
      );
    },
  });

  // Helper to show confirmation dialog before requesting deletion
  const confirmAndRequestDeletion = (reason?: string) => {
    Alert.alert(
      'Delete Account?',
      'Are you sure you want to delete your account? This action will schedule your account for permanent deletion in 30 days. You can cancel this request anytime during this period.\n\nAll your data including:\n• Health records\n• Coins and achievements\n• Orders and addresses\n• Challenges and progress\n\nwill be permanently deleted.',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete Account',
          style: 'destructive',
          onPress: () => requestDeletionMutation.mutate({ reason }),
        },
      ]
    );
  };

  // Helper to show confirmation dialog before cancelling deletion
  const confirmAndCancelDeletion = () => {
    Alert.alert(
      'Cancel Deletion Request?',
      'Are you sure you want to cancel your account deletion request? Your account will remain active.',
      [
        {
          text: 'No',
          style: 'cancel',
        },
        {
          text: 'Yes, Cancel Deletion',
          style: 'default',
          onPress: () => cancelDeletionMutation.mutate(),
        },
      ]
    );
  };

  return {
    deletionStatus,
    isLoadingStatus,
    refetchStatus,
    requestDeletion: confirmAndRequestDeletion,
    cancelDeletion: confirmAndCancelDeletion,
    isRequestingDeletion: requestDeletionMutation.isPending,
    isCancellingDeletion: cancelDeletionMutation.isPending,
  };
};
