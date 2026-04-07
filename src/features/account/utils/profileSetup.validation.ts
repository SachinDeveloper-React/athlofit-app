import { z } from 'zod';

// ─── Step 1: Personal ─────────────────────────────────────────────────────────

export const personalSchema = z.object({
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .regex(/^\+?[0-9\s\-()]{7,15}$/, 'Enter a valid phone number'),

  dob: z
    .string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),

  gender: z.enum(['M', 'F', 'O'], {
    message: 'Please select a gender',
  }),
});

// ─── Step 2: Body metrics ─────────────────────────────────────────────────────

export const bodySchema = z.object({
  height: z
    .number({
      message: 'Enter your height',
    })
    .min(50, 'Height must be at least 50 cm')
    .max(300, 'Height must be less than 300 cm'),

  weight: z
    .number({
      message: 'Enter your weight',
    })
    .min(10, 'Weight must be at least 10 kg')
    .max(500, 'Weight must be less than 500 kg'),

  bloodType: z.string().min(1, 'Please select a blood type'),
});

export type PersonalFormValues = z.infer<typeof personalSchema>;
export type BodyFormValues = z.infer<typeof bodySchema>;

// ─── Combined ─────────────────────────────────────────────────────────────────

export const completeProfileSchema = personalSchema.merge(bodySchema);
export type CompleteProfileFormValues = z.infer<typeof completeProfileSchema>;

// ─── Edit Profile ─────────────────────────────────────────────────────────────

export const editProfileSchema = completeProfileSchema.extend({
  name: z.string().min(2, 'Name must be at least 2 characters'),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
