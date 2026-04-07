export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface VerifyOtpRequest {
  email: string;
  otp: string;
  flow: 'forgot_password' | 'signup';
}

export interface ResetPasswordRequest {
  email: string;
  otp: string;
  password: string;
}

export interface ResendOtpRequest {
  email: string;
  flow: 'forgot_password' | 'signup';
}

// ─── Auth Tokens ──────────────────────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

// ─── User ─────────────────────────────────────────────────────────────────────

export type GenderType = 'M' | 'F' | 'O';

export interface User {
  _id: string;
  name: string;
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  isProfileCompleted: boolean;
  dailyStepGoal: number;
  provider: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  __v: number;
  age: number;
  phone?: string | null;
  dob?: string | null;
  gender?: GenderType;
  height?: number | null; // cm
  weight?: number | null; // kg
  bloodType?: string | null;
  avatarUrl?: string | null;
}

export interface CompleteProfileRequest {
  phone: string;
  dob: string; // ISO date string "YYYY-MM-DD"
  gender: GenderType;
  height: number; // cm
  weight: number; // kg
  bloodType: string; // e.g. "A+" | "O-"
  avatarUrl?: string | null;
}


// ─── API base response ────────────────────────────────────────────────────────

export interface ApiResponse<T = void> {
  success: boolean;
  message: string;
  data: T;
}

export interface AuthResponse
  extends ApiResponse<{
    status: 'success' | 'fail' | string;
    message: string;
    accessToken?: string;
    refreshToken?: string;
    user: User;
  }> {
  status: 'success' | 'fail' | string;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user: User;
}

export interface SignUpResponse
  extends ApiResponse<{
    message: string;
    status: string;
  }> {}

export interface OtpResponse
  extends ApiResponse<{
    status: 'success' | 'fail' | string;
    message: string;
    accessToken?: string;
    refreshToken?: string;
    user: User;
  }> {
  status: 'success' | 'fail' | string;
  message: string;
  accessToken?: string;
  refreshToken?: string;
  user: User;
}

export interface CompleteProfileResponse
  extends ApiResponse<{
    status: 'success' | 'fail' | string;
    message: string;
    user: User;
  }> {
  status: 'success' | 'fail' | string;
  message: string;
  user: User;
}

// ─── Auth Store State ─────────────────────────────────────────────────────────

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  // actions
  setAccessToken: (accessToken: string) => void;
  setAuth: (user: User, tokens: AuthTokens) => void;
  setTokensFromStorage: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (partial: Partial<User>) => void;
}
