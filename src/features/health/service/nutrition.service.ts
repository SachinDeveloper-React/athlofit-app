// ─── nutrition.service.ts ─────────────────────────────────────────────────────

import { api } from '../../../utils/api';
import type {
  DailySummaryResponse,
  LogMealRequest,
  LogMealResponse,
  DeleteMealResponse,
  NutritionPreferencesResponse,
  UpdatePreferencesRequest,
  UpdatePreferencesResponse,
  NutritionOptionsResponse,
  // Phase 2
  FoodListResponse,
  FoodDetailResponse,
  FoodQueryParams,
  ToggleFavouriteResponse,
  FavouritesResponse,
} from '../types/nutrition.types';

export const nutritionService = {
  /**
   * Fetch the full daily nutrition summary including all meals logged.
   * @param date - ISO date string YYYY-MM-DD (defaults to today)
   */
  getDailySummary: async (date?: string): Promise<DailySummaryResponse> => {
    const today = date ?? new Date().toISOString().split('T')[0];
    const response = await api.get<DailySummaryResponse>(
      `nutrition/summary?date=${today}`,
    );
    return response;
  },

  /**
   * Log a new meal entry for the current user.
   */
  logMeal: async (body: LogMealRequest): Promise<LogMealResponse> => {
    const response = await api.post<LogMealResponse>('nutrition/log', body);
    return response;
  },

  /**
   * Delete a previously logged meal entry by ID.
   */
  deleteMeal: async (id: string): Promise<DeleteMealResponse> => {
    const response = await api.delete<DeleteMealResponse>(
      `nutrition/log/${id}`,
    );
    return response;
  },

  /**
   * Get the user's diet preferences and calorie goal.
   */
  getPreferences: async (): Promise<NutritionPreferencesResponse> => {
    const response = await api.get<NutritionPreferencesResponse>(
      'nutrition/preferences',
    );
    return response;
  },

  /**
   * Update the user's diet preferences, dietary goal, and calorie goal.
   */
  updatePreferences: async (
    body: UpdatePreferencesRequest,
  ): Promise<UpdatePreferencesResponse> => {
    const response = await api.put<UpdatePreferencesResponse>(
      'nutrition/preferences',
      body,
    );
    return response;
  },

  // ─── Phase 2: Food Catalog ──────────────────────────────────────────────────────────

  /**
   * Get a paginated list of food items, optionally filtered by category / diet type.
   */
  getFoods: async (params?: FoodQueryParams): Promise<FoodListResponse> => {
    const qs = new URLSearchParams();
    if (params?.category && params.category !== 'all') qs.set('category', params.category);
    if (params?.dietType && params.dietType !== 'all') qs.set('dietType', params.dietType);
    if (params?.search) qs.set('search', params.search);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString();
    const response = await api.get<FoodListResponse>(
      `nutrition/foods${query ? `?${query}` : ''}`,
    );
    return response;
  },

  /**
   * Get a single food item's full details by ID.
   */
  getFoodById: async (id: string): Promise<FoodDetailResponse> => {
    const response = await api.get<FoodDetailResponse>(`nutrition/foods/${id}`);
    return response;
  },

  /**
   * Toggle favourite status for a food item. Returns new isFavourite state.
   */
  toggleFavourite: async (id: string): Promise<ToggleFavouriteResponse> => {
    const response = await api.post<ToggleFavouriteResponse>(
      `nutrition/foods/${id}/favourite`,
    );
    return response;
  },

  /**
   * Get all food items the user has saved as favourites.
   */
  getFavourites: async (): Promise<FavouritesResponse> => {
    const response = await api.get<FavouritesResponse>('nutrition/favourites');
    return response;
  },

  /**
   * Get diet preference chips and dietary goal chips from AppConfig.
   */
  getNutritionOptions: async (): Promise<NutritionOptionsResponse> => {
    const response = await api.get<NutritionOptionsResponse>('nutrition/options');
    return response;
  },
};
