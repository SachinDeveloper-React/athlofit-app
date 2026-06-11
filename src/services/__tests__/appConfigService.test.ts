import { appConfigService } from '../appConfigService';
import { api } from '../../utils/api';
import { APP_CONFIG_DEFAULTS } from '../../config/appConfig';

jest.mock('../../utils/api', () => ({
  api: {
    get: jest.fn(),
  },
}));

const mockedApi = api as jest.Mocked<typeof api>;

describe('appConfigService.fetchConfig', () => {
  afterEach(() => jest.resetAllMocks());

  it('returns config when coin_config fields are present', async () => {
    const validConfig = { ...APP_CONFIG_DEFAULTS };
    mockedApi.get.mockResolvedValue({
      success: true,
      data: { config: validConfig },
    });

    const result = await appConfigService.fetchConfig();
    expect(result).toEqual(validConfig);
  });

  it('throws when response is not successful', async () => {
    mockedApi.get.mockResolvedValue({
      success: false,
      message: 'Server error',
      data: null,
    });

    await expect(appConfigService.fetchConfig()).rejects.toThrow('Server error');
  });

  it('throws when coin_config.steps.rate_per_100_steps is missing', async () => {
    const configMissingRate = {
      ...APP_CONFIG_DEFAULTS,
      coin_config: {
        steps: {},
        rewards: { daily_step_goal_reached: { enabled: true, coin_value: 50 } },
      },
    };
    mockedApi.get.mockResolvedValue({
      success: true,
      data: { config: configMissingRate },
    });

    await expect(appConfigService.fetchConfig()).rejects.toThrow(
      'Missing required coin_config fields',
    );
  });

  it('throws when coin_config.steps.rate_per_100_steps is null', async () => {
    const configNullRate = {
      ...APP_CONFIG_DEFAULTS,
      coin_config: {
        steps: { rate_per_100_steps: null },
        rewards: { daily_step_goal_reached: { enabled: true, coin_value: 50 } },
      },
    };
    mockedApi.get.mockResolvedValue({
      success: true,
      data: { config: configNullRate },
    });

    await expect(appConfigService.fetchConfig()).rejects.toThrow(
      'Missing required coin_config fields',
    );
  });

  it('throws when coin_config.rewards.daily_step_goal_reached is missing', async () => {
    const configMissingReward = {
      ...APP_CONFIG_DEFAULTS,
      coin_config: {
        steps: { rate_per_100_steps: 0.00095 },
        rewards: {},
      },
    };
    mockedApi.get.mockResolvedValue({
      success: true,
      data: { config: configMissingReward },
    });

    await expect(appConfigService.fetchConfig()).rejects.toThrow(
      'Missing required coin_config fields',
    );
  });

  it('throws when coin_config.rewards.daily_step_goal_reached is null', async () => {
    const configNullReward = {
      ...APP_CONFIG_DEFAULTS,
      coin_config: {
        steps: { rate_per_100_steps: 0.00095 },
        rewards: { daily_step_goal_reached: null },
      },
    };
    mockedApi.get.mockResolvedValue({
      success: true,
      data: { config: configNullReward },
    });

    await expect(appConfigService.fetchConfig()).rejects.toThrow(
      'Missing required coin_config fields',
    );
  });

  it('throws when coin_config is entirely missing', async () => {
    const configNoCoinConfig = { ...APP_CONFIG_DEFAULTS };
    delete (configNoCoinConfig as any).coin_config;
    mockedApi.get.mockResolvedValue({
      success: true,
      data: { config: configNoCoinConfig },
    });

    await expect(appConfigService.fetchConfig()).rejects.toThrow(
      'Missing required coin_config fields',
    );
  });
});
