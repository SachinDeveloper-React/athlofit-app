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

    const config = response.data.config;

    // Validate required coin_config fields exist
    if (
      config.coin_config?.steps?.rate_per_100_steps == null ||
      config.coin_config?.rewards?.daily_step_goal_reached == null
    ) {
      throw new Error('Missing required coin_config fields');
    }

    return config;
  },
};
