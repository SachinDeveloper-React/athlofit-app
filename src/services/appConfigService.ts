// src/services/appConfigService.ts
import { api } from '../utils/api';
import type { AppConfig } from '../config/appConfig';

interface AppConfigResponse {
  success: boolean;
  message: string;
  data: { config: AppConfig };
}

export const appConfigService = {
  fetchConfig: async (): Promise<AppConfig> => {
    const response = await api.get<AppConfigResponse>('config/app');
    if (!response.success || !response.data?.config) {
      throw new Error(response.message || 'Failed to fetch app config');
    }
    return response.data.config;
  },
};
