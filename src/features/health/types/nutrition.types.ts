// ─── Nutrition Types ─────────────────────────────────────────────────────────────
// Phase 1: Meal logging, preferences, calorie summary
// Phase 2: Food catalog, food detail, favourites

import { ApiResponse } from '../../../types/auth.types';

// ─── Enums ────────────────────────────────────────────────────────────────────

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type DietPreference = 'veg' | 'non-veg' | 'vegan';

export type DietaryGoal =
  | 'weight_loss'
  | 'muscle_gain'
  | 'maintenance'
  | 'endurance';

export type MealUnit = 'g' | 'ml' | 'serving' | 'piece';

// ─── Core Models ──────────────────────────────────────────────────────────────

export interface MealEntry {
  _id: string;
  mealType: MealType;
  name: string;
  calories: number;
  protein?: number;  // g
  carbs?: number;    // g
  fat?: number;      // g
  quantity?: number;
  unit?: MealUnit;
  loggedAt: string;  // ISO datetime
}

export interface NutritionPreferences {
  dietPreference: DietPreference;
  dietaryGoal: DietaryGoal;
  calorieGoal: number; // kcal/day
}

export interface DailyNutritionSummary {
  date: string;
  totalCaloriesIn: number;
  caloriesOut: number;   // from steps/exercise
  calorieGoal: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  meals: Record<MealType, MealEntry[]>;
}

// ─── Request / Response ───────────────────────────────────────────────────────

export type LogMealRequest = Omit<MealEntry, '_id' | 'loggedAt'>;

export type UpdatePreferencesRequest = NutritionPreferences;

// ─── API Response wrappers ────────────────────────────────────────────────────

export type DailySummaryResponse = ApiResponse<DailyNutritionSummary>;
export type NutritionPreferencesResponse = ApiResponse<NutritionPreferences>;
export type LogMealResponse = ApiResponse<MealEntry>;
export type DeleteMealResponse = ApiResponse<{ deleted: boolean }>;
export type UpdatePreferencesResponse = ApiResponse<NutritionPreferences>;

// ─── Meal Meta ────────────────────────────────────────────────────────────────

export interface MealMeta {
  type: MealType;
  label: string;
  emoji: string;
  color: string;
  bg: string;
  timeHint: string;
}

export const MEAL_META: MealMeta[] = [
  {
    type: 'breakfast',
    label: 'Breakfast',
    emoji: '🌅',
    color: '#E07B39',
    bg: '#FFF3EC',
    timeHint: '7 – 10 AM',
  },
  {
    type: 'lunch',
    label: 'Lunch',
    emoji: '☀️',
    color: '#2E7D62',
    bg: '#E9F5F0',
    timeHint: '12 – 2 PM',
  },
  {
    type: 'dinner',
    label: 'Dinner',
    emoji: '🌙',
    color: '#3A5FA0',
    bg: '#EEF2FB',
    timeHint: '7 – 9 PM',
  },
  {
    type: 'snacks',
    label: 'Snacks',
    emoji: '🍎',
    color: '#B04C78',
    bg: '#FBEDF3',
    timeHint: 'Anytime',
  },
];

// ─── Diet recommendation map ──────────────────────────────────────────────────

// ─── Phase 2 – Food Catalog ──────────────────────────────────────────────────

export type FoodCategory = 'all' | 'breakfast' | 'lunch' | 'dinner' | 'snacks';

export type DietFilter = 'all' | 'veg' | 'non-veg' | 'vegan';

export interface FoodItem {
  _id: string;
  name: string;
  description?: string;
  calories: number;   // kcal per serving
  protein: number;    // g
  carbs: number;      // g
  fat: number;        // g
  fiber?: number;     // g
  sugar?: number;     // g
  dietType: DietPreference;   // 'veg' | 'non-veg' | 'vegan'
  category: Exclude<FoodCategory, 'all'>;
  servingSize: number;
  servingUnit: string; // 'g' | 'ml' | 'serving'
  imageUrl?: string;
  isFavourite?: boolean;  // user-specific flag from backend
}

export interface FoodQueryParams {
  category?: FoodCategory;
  dietType?: DietFilter;
  search?: string;
  page?: number;
  limit?: number;
}

// ─── Phase 2 – API Responses ─────────────────────────────────────────────────

export type FoodListResponse = ApiResponse<{ foods: FoodItem[]; total: number; page: number }>;
export type FoodDetailResponse = ApiResponse<FoodItem>;
export type ToggleFavouriteResponse = ApiResponse<{ isFavourite: boolean }>;
export type FavouritesResponse = ApiResponse<{ foods: FoodItem[] }>;

// ─── Phase 2 – Diet Colour Map ────────────────────────────────────────────────

export const DIET_TYPE_META: Record<
  DietPreference,
  { label: string; emoji: string; color: string; bg: string; chipBg: string }
> = {
  veg: {
    label: 'Vegetarian',
    emoji: '🥦',
    color: '#1A6B4A',
    bg: '#E8F5EE',
    chipBg: '#D4EDE1',
  },
  'non-veg': {
    label: 'Non-Veg',
    emoji: '🍗',
    color: '#C0392B',
    bg: '#FDECEA',
    chipBg: '#FAD5D1',
  },
  vegan: {
    label: 'Vegan',
    emoji: '🌱',
    color: '#2C5FA3',
    bg: '#EEF3FB',
    chipBg: '#D6E4F7',
  },
};

export const FOOD_CATEGORY_META: Record<
  FoodCategory,
  { label: string; emoji: string }
> = {
  all: { label: 'All', emoji: '🍽️' },
  breakfast: { label: 'Breakfast', emoji: '🌅' },
  lunch: { label: 'Lunch', emoji: '☀️' },
  dinner: { label: 'Dinner', emoji: '🌙' },
  snacks: { label: 'Snacks', emoji: '🍎' },
};

// ─── Nutrition Options (from AppConfig) ──────────────────────────────────────

export interface NutritionOption {
  value: string;
  label: string;
  emoji: string;
}

export interface CatalogFilter {
  id: string;
  label: string;
  emoji: string;
}

export interface NutritionOptions {
  dietPreferences: NutritionOption[];
  dietaryGoals: NutritionOption[];
  catalogFilters: CatalogFilter[];
}

export type NutritionOptionsResponse = ApiResponse<NutritionOptions>;

export const DIET_RECOMMENDATIONS: Record<
  DietaryGoal,
  { title: string; body: string; emoji: string; color: string; bg: string }
> = {
  weight_loss: {
    title: 'Slim Down Smart',
    body: 'Focus on high-protein, low-carb meals. Aim for a 300–500 kcal daily deficit and eat plenty of fiber to stay full longer.',
    emoji: '🔥',
    color: '#C0392B',
    bg: '#FDF0EF',
  },
  muscle_gain: {
    title: 'Build Lean Muscle',
    body: 'Target 1.6–2.2g of protein per kg of body weight. Prioritise calorie surplus of 200–300 kcal and time carbs around workouts.',
    emoji: '💪',
    color: '#1A6B4A',
    bg: '#E8F5EE',
  },
  maintenance: {
    title: 'Stay Balanced',
    body: 'Aim for a 40C / 30P / 30F macro split. Consistent meal timing and whole-food choices help sustain energy throughout the day.',
    emoji: '⚖️',
    color: '#2C5FA3',
    bg: '#EEF3FB',
  },
  endurance: {
    title: 'Fuel for Distance',
    body: 'Prioritize complex carbs before training and replenish glycogen within 30 min post-workout. Stay well-hydrated throughout the day.',
    emoji: '🏃',
    color: '#7B3FA8',
    bg: '#F3ECFB',
  },
};
