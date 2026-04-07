import { api } from '../../../utils/api';
import { ApiResponse } from '../../../types/auth.types';

export interface LegalContent {
  content: string;
}

export interface SupportRequest {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export const legalService = {
  getTerms: () => api.get<ApiResponse<LegalContent>>('config/terms'),
  getPrivacy: () => api.get<ApiResponse<LegalContent>>('config/privacy'),
  submitSupport: (body: SupportRequest) => api.post<ApiResponse>('config/support', body),
};
