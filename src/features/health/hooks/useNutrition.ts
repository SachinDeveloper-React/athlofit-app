// ─── useNutrition.ts ──────────────────────────────────────────────────────────
// Centralised React-Query hooks for the Diet & Nutrition module.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { nutritionService } from '../service/nutrition.service';
import type {
  LogMealRequest,
  NutritionPreferences,
  UpdatePreferencesRequest,
  FoodQueryParams,
} from '../types/nutrition.types';

// ─── Query keys ───────────────────────────────────────────────────────────────

export const nutritionKeys = {
  summary: (date: string) => ['nutrition-summary', date] as const,
  preferences: () => ['nutrition-preferences'] as const,
  // Phase 2
  foods: (params?: FoodQueryParams) => ['nutrition-foods', params] as const,
  food: (id: string) => ['nutrition-food', id] as const,
  favourites: () => ['nutrition-favourites'] as const,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const todayISO = () => new Date().toISOString().split('T')[0];

// ─── Queries ─────────────────────────────────────────────────────────────────

/**
 * Fetches the full daily nutrition summary (meals + calorie totals).
 * Falls back to a safe empty state when the API is unavailable.
 */
export function useNutritionSummary(date?: string) {
  const day = date ?? todayISO();

  return useQuery({
    queryKey: nutritionKeys.summary(day),
    queryFn: () => nutritionService.getDailySummary(day),
    select: response =>
      response.data ?? {
        date: day,
        totalCaloriesIn: 0,
        caloriesOut: 0,
        calorieGoal: 2000,
        totalProtein: 0,
        totalCarbs: 0,
        totalFat: 0,
        meals: {
          breakfast: [],
          lunch: [],
          dinner: [],
          snacks: [],
        },
      },
    staleTime: 30_000,
    retry: 1,
  });
}

/**
 * Fetches the user's saved diet preference, dietary goal and calorie goal.
 */
export function useNutritionPreferences() {
  return useQuery({
    queryKey: nutritionKeys.preferences(),
    queryFn: () => nutritionService.getPreferences(),
    select: (response): NutritionPreferences =>
      response.data ?? {
        dietPreference: 'non-veg',
        dietaryGoal: 'maintenance',
        calorieGoal: 2000,
      },
    staleTime: 5 * 60_000, // 5 minutes
    retry: 1,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Logs a new meal entry — optimistically invalidates the daily summary.
 */
export function useLogMeal() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: LogMealRequest) => nutritionService.logMeal(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: nutritionKeys.summary(todayISO()) });
    },
  });
}

/**
 * Deletes a logged meal entry by ID.
 */
export function useDeleteMeal() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => nutritionService.deleteMeal(id),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: nutritionKeys.summary(todayISO()) });
    },
  });
}

/**
 * Updates the user's nutrition preferences.
 * On success, refreshes both the preferences and the daily summary
 * (calorie goal change affects the summary card).
 */
export function useUpdatePreferences() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (body: UpdatePreferencesRequest) =>
      nutritionService.updatePreferences(body),
    onSuccess: () => {
      client.invalidateQueries({ queryKey: nutritionKeys.preferences() });
      client.invalidateQueries({ queryKey: nutritionKeys.summary(todayISO()) });
    },
  });
}

// ─── Phase 2: Food Catalog Hooks ────────────────────────────────────────────────────────

/**
 * Fetch a paginated, filterable list of food items from the catalog.
 */
export function useFoodCatalog(params?: FoodQueryParams) {
  return useQuery({
    queryKey: nutritionKeys.foods(params),
    queryFn: () => nutritionService.getFoods(params),
    select: response => ({
      foods: response.data?.foods ?? [],
      total: response.data?.total ?? 0,
      page: response.data?.page ?? 1,
    }),
    staleTime: 2 * 60_000,
    retry: 1,
  });
}

/**
 * Fetch the full details for a single food item.
 */
export function useFoodDetail(id: string | undefined) {
  return useQuery({
    queryKey: nutritionKeys.food(id ?? ''),
    queryFn: () => nutritionService.getFoodById(id!),
    select: response => response.data ?? null,
    enabled: !!id,
    staleTime: 5 * 60_000,
    retry: 1,
  });
}

/**
 * Get all food items the user has favourited.
 */
export function useFavourites() {
  return useQuery({
    queryKey: nutritionKeys.favourites(),
    queryFn: () => nutritionService.getFavourites(),
    select: response => response.data?.foods ?? [],
    staleTime: 60_000,
    retry: 1,
  });
}

/**
 * Toggle favourite/unfavourite a food item.
 * Optimistically invalidates the catalog + favourites lists.
 */
export function useToggleFavourite() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (foodId: string) => nutritionService.toggleFavourite(foodId),
    onSuccess: () => {
      // Refresh all catalog views (any filter combo) and the favourites list
      client.invalidateQueries({ queryKey: ['nutrition-foods'] });
      client.invalidateQueries({ queryKey: nutritionKeys.favourites() });
    },
  });
}
