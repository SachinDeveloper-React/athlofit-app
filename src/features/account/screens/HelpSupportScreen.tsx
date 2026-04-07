import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  AppText,
  AppView,
  Header,
  Screen,
  Button,
  useToast,
  Icon,
} from '../../../components';
import { useTheme } from '../../../hooks/useTheme';
import { Field } from '../components/complete-profile/Field';
import { useSupportMutation } from '../hooks/useSupportMutation';
import { useAuthStore } from '../../auth/store/authStore';

const supportSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject is too short'),
  message: z.string().min(10, 'Please provide more details'),
});

type SupportFormValues = z.infer<typeof supportSchema>;

const HelpSupportScreen: React.FC = () => {
  const { colors } = useTheme();
  const toast = useToast();
  const user = useAuthStore(s => s.user);
  const { mutate: submitSupport, isPending } = useSupportMutation();

  const {
    control,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupportFormValues>({
    resolver: zodResolver(supportSchema),
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      subject: '',
      message: '',
    },
  });

  const onSubmit = (values: SupportFormValues) => {
    submitSupport(values, {
      onSuccess: res => {
        toast.success(res.message || 'Support request sent! 🚀');
        reset({
          ...values,
          subject: '',
          message: '',
        });
      },
      onError: (err: any) => {
        toast.error(err?.message || 'Failed to send request');
      },
    });
  };

  return (
    <Screen
      scroll
      safeArea={false}
      header={<Header title="Help & Support" showBack backLabel="" />}
    >
      <AppView style={styles.container}>
        <AppView style={styles.headerSection}>
          <AppText variant="title2" style={styles.title}>
            How can we help?
          </AppText>
          <AppText style={styles.subtitle}>
            Have a question or need assistance? Fill out the form below and our
            team will get back to you shortly.
          </AppText>
        </AppView>

        <AppView
          style={[
            styles.formCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Controller
            control={control}
            name="name"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Your Name"
                placeholder="John Doe"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.name?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="email"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Email Address"
                placeholder="john@example.com"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.email?.message}
                keyboardType="email-address"
              />
            )}
          />

          <Controller
            control={control}
            name="subject"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Subject"
                placeholder="What is this about?"
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.subject?.message}
              />
            )}
          />

          <Controller
            control={control}
            name="message"
            render={({ field: { onChange, onBlur, value } }) => (
              <Field
                label="Message"
                placeholder="Describe your issue or question..."
                value={value}
                onChangeText={onChange}
                onBlur={onBlur}
                error={errors.message?.message}
                hint="Minimum 10 characters"
              />
            )}
          />

          <Button
            label="Send Message"
            onPress={handleSubmit(onSubmit)}
            loading={isPending}
            style={styles.submitBtn}
            size="lg"
            fullWidth
          />
        </AppView>

        <AppView style={styles.contactInfo}>
          <AppText variant="overline" style={styles.infoTitle}>
            Other ways to connect
          </AppText>
          <TouchableOpacity style={styles.infoRow}>
            <Icon name="Mail" size={20} color={colors.primary} />
            <AppText style={styles.infoLink}>support@athlofit.com</AppText>
          </TouchableOpacity>
          <TouchableOpacity style={styles.infoRow}>
            <Icon name="Globe" size={20} color={colors.primary} />
            <AppText style={styles.infoLink}>www.athlofit.com/faq</AppText>
          </TouchableOpacity>
        </AppView>
      </AppView>
    </Screen>
  );
};

export default HelpSupportScreen;

const styles = StyleSheet.create({
  container: {
    paddingTop: 20,
  },
  headerSection: {
    marginBottom: 24,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    opacity: 0.6,
    lineHeight: 20,
  },
  formCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  submitBtn: {
    marginTop: 12,
  },
  contactInfo: {
    marginTop: 32,
    gap: 16,
  },
  infoTitle: {
    opacity: 0.5,
    marginBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLink: {
    fontWeight: '500',
    opacity: 0.8,
  },
});
