// src/features/account/service/accountDeletion.service.ts
import { api } from '../../../utils/api';
import { ApiResponse } from '../../../types/auth.types';

export type DeletionStatus = 'none' | 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface DeletionStatusData {
  status: DeletionStatus;
  requestedAt: string | null;
  scheduledDeletionDate: string | null;
  reason: string | null;
  cancelledAt: string | null;
  completedAt: string | null;
  /**
   * Set when the scheduled date has passed but the purge could not run — an
   * undelivered order, whose shipping address the purge would redact. Surfaced
   * so a user whose deletion is taking longer than the promised 30 days can see
   * why, rather than assuming the request was ignored.
   */
  blockedReason?: string | null;
}

export interface RequestDeletionPayload {
  reason?: string;
}

export interface RequestDeletionResponse {
  status: DeletionStatus;
  scheduledDeletionDate: string;
  requestedAt: string;
}

export const accountDeletionService = {
  /**
   * Request account deletion
   */
  requestDeletion: async (payload: RequestDeletionPayload) => {
    const response = await api.post<ApiResponse<RequestDeletionResponse>>('user/request-deletion', payload);
    return response.data;
  },

  /**
   * Cancel account deletion request
   */
  cancelDeletion: async () => {
    const response = await api.post<ApiResponse<{ status: DeletionStatus; cancelledAt: string }>>('user/cancel-deletion');
    return response.data;
  },

  /**
   * Get current deletion status
   */
  getDeletionStatus: async () => {
    const response = await api.get<ApiResponse<DeletionStatusData>>('user/deletion-status');
    return response.data;
  },
};
