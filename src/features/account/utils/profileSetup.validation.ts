import { z } from 'zod';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const today = () => new Date();

function parseDob(dob: string): Date | null {
  const match = dob.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const d = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return isNaN(d.getTime()) ? null : d;
}

function ageInYears(dob: Date): number {
  const now = today();
  let age = now.getFullYear() - dob.getFullYear();
  const m = now.getMonth() - dob.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < dob.getDate())) age--;
  return age;
}

// ─── Step 1: Personal ─────────────────────────────────────────────────────────

export const personalSchema = z.object({
  // Phone: stored as full E.164 e.g. "+919876543210"
  // The UI splits it into a fixed "+91" prefix + 10-digit input,
  // then joins them before saving.
  phone: z
    .string()
    .min(1, 'Phone number is required')
    .transform(v => v.replace(/\s/g, ''))
    .pipe(
      z
        .string()
        .regex(
          /^\+[1-9]\d{6,14}$/,
          'Enter a valid 10-digit mobile number',
        ),
    ),

  dob: z
    .string()
    .min(1, 'Date of birth is required')
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)')
    .refine(v => parseDob(v) !== null, 'Enter a valid date')
    .refine(v => {
      const d = parseDob(v);
      return d !== null && d <= today();
    }, 'Date of birth cannot be in the future')
    .refine(v => {
      const d = parseDob(v);
      return d !== null && ageInYears(d) >= 13;
    }, 'You must be at least 13 years old')
    .refine(v => {
      const d = parseDob(v);
      return d !== null && ageInYears(d) <= 120;
    }, 'Please enter a valid date of birth'),

  gender: z.enum(['M', 'F', 'O'], {
    message: 'Please select a gender',
  }),
});

// ─── Step 2: Body metrics ─────────────────────────────────────────────────────

export const bodySchema = z.object({
  height: z
    .number({ message: 'Enter your height' })
    .min(50, 'Height must be at least 50 cm')
    .max(300, 'Height must be less than 300 cm'),

  weight: z
    .number({ message: 'Enter your weight' })
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
  name: z
    .string()
    .min(1, 'Name is required')
    .transform(v => v.trim())
    .pipe(z.string().min(2, 'Name must be at least 2 characters')),
});

export type EditProfileFormValues = z.infer<typeof editProfileSchema>;
