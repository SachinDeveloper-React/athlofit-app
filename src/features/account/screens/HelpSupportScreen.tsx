// src/features/account/screens/HelpSupportScreen.tsx
import React, { useState, useCallback } from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  LayoutAnimation,
  UIManager,
  Platform,
} from 'react-native';
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
import { useFaqs } from '../hooks/useFaqs';
import type { FaqItem } from '../service/legalService';
import { useSupportContact } from '../../../store/appConfigStore';

// Enable LayoutAnimation on Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const supportSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  email: z.string().email('Invalid email address'),
  subject: z.string().min(5, 'Subject is too short'),
  message: z.string().min(10, 'Please provide more details'),
});

type SupportFormValues = z.infer<typeof supportSchema>;

// ─── FAQ Accordion Item ───────────────────────────────────────────────────────
const FaqAccordionItem: React.FC<{ item: FaqItem; colors: any }> = ({
  item,
  colors,
}) => {
  const [open, setOpen] = useState(false);

  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen(prev => !prev);
  }, []);

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={toggle}
      style={[
        styles.faqItem,
        {
          backgroundColor: open ? colors.primary + '0d' : colors.card,
          borderColor: open ? colors.primary + '40' : colors.border,
        },
      ]}
    >
      <AppView
        row
        style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}
      >
        <AppText
          variant="callout"
          weight="semiBold"
          style={{ flex: 1, paddingRight: 12, lineHeight: 22 }}
        >
          {item.question}
        </AppText>
        <Icon
          name={open ? 'ChevronUp' : 'ChevronDown'}
          size={20}
          color={colors.primary}
        />
      </AppView>
      {open && (
        <AppText
          variant="callout"
          style={{ marginTop: 10, opacity: 0.7, lineHeight: 22 }}
        >
          {item.answer}
        </AppText>
      )}
    </TouchableOpacity>
  );
};

// ─── FAQ Category Section ─────────────────────────────────────────────────────
const FaqCategory: React.FC<{
  category: string;
  items: FaqItem[];
  colors: any;
}> = ({ category, items, colors }) => (
  <AppView style={{ marginBottom: 16 }}>
    <AppText
      variant="footnote"
      weight="semiBold"
      style={{ opacity: 0.5, letterSpacing: 0.5, marginBottom: 8 }}
    >
      {category.toUpperCase()}
    </AppText>
    {items.map(item => (
      <FaqAccordionItem key={item.id} item={item} colors={colors} />
    ))}
  </AppView>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const HelpSupportScreen: React.FC = () => {
  const { colors } = useTheme();
  const toast = useToast();
  const user = useAuthStore(s => s.user);
  const { mutate: submitSupport, isPending } = useSupportMutation();
  const { grouped, isLoading: faqsLoading } = useFaqs();
  const supportContact = useSupportContact();

  const [showForm, setShowForm] = useState(false);

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
        reset({ ...values, subject: '', message: '' });
        setShowForm(false);
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
        {/* ── Hero ── */}
        <AppView
          style={[
            styles.heroCard,
            {
              backgroundColor: colors.primary + '12',
              borderColor: colors.primary + '30',
            },
          ]}
        >
          <AppText
            style={{ fontSize: 40, textAlign: 'center', marginBottom: 8 }}
          >
            💬
          </AppText>
          <AppText
            variant="title2"
            weight="bold"
            align="center"
            style={{ marginBottom: 4 }}
          >
            How can we help?
          </AppText>
          <AppText
            variant="callout"
            align="center"
            style={{ opacity: 0.65, lineHeight: 22 }}
          >
            Browse our FAQs below or contact our team directly.
          </AppText>
        </AppView>

        {/* ── FAQs ── */}
        {!faqsLoading && Object.keys(grouped).length > 0 && (
          <AppView>
            <AppText
              variant="footnote"
              weight="semiBold"
              style={[styles.sectionTitle, { color: colors.foreground + '60' }]}
            >
              FREQUENTLY ASKED QUESTIONS
            </AppText>
            {Object.entries(grouped).map(([category, items]) => (
              <FaqCategory
                key={category}
                category={category}
                items={items}
                colors={colors}
              />
            ))}
          </AppView>
        )}

        {/* ── Contact us toggle ── */}
        {!showForm ? (
          <AppView style={{ marginTop: 8, marginBottom: 8 }}>
            <AppText
              variant="footnote"
              weight="semiBold"
              style={[styles.sectionTitle, { color: colors.foreground + '60' }]}
            >
              STILL NEED HELP?
            </AppText>
            <TouchableOpacity
              style={[
                styles.contactCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => setShowForm(true)}
            >
              <AppView
                style={[
                  styles.contactIcon,
                  { backgroundColor: colors.primary + '15' },
                ]}
              >
                <Icon name="Mail" size={24} color={colors.primary} />
              </AppView>
              <AppView style={{ flex: 1 }}>
                <AppText variant="callout" weight="semiBold">
                  Send a Message
                </AppText>
                <AppText
                  variant="footnote"
                  style={{ opacity: 0.55, marginTop: 2 }}
                >
                  Our team responds within 24h
                </AppText>
              </AppView>
              <Icon
                name="ChevronRight"
                size={20}
                color={colors.foreground + '40'}
              />
            </TouchableOpacity>
          </AppView>
        ) : (
          <AppView
            style={[
              styles.formCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <AppView
              row
              style={{
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <AppText variant="headline" weight="bold">
                Send a Message
              </AppText>
              <TouchableOpacity onPress={() => setShowForm(false)}>
                <Icon name="X" size={22} color={colors.foreground + '70'} />
              </TouchableOpacity>
            </AppView>

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
        )}

        {/* ── Other contact options ── */}
        <AppView style={styles.contactInfo}>
          <AppText
            variant="footnote"
            weight="semiBold"
            style={{ opacity: 0.45, marginBottom: 12, letterSpacing: 0.5 }}
          >
            OTHER WAYS TO REACH US
          </AppText>
          <TouchableOpacity
            style={[
              styles.infoRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Icon name="Mail" size={20} color={colors.primary} />
            <AppText style={styles.infoLink}>{supportContact.email}</AppText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.infoRow,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <Icon name="Globe" size={20} color={colors.primary} />
            <AppText style={styles.infoLink}>{supportContact.website}</AppText>
          </TouchableOpacity>
        </AppView>

        <AppView style={{ height: 40 }} />
      </AppView>
    </Screen>
  );
};

export default HelpSupportScreen;

const styles = StyleSheet.create({
  container: { paddingTop: 12 },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    padding: 24,
    marginBottom: 24,
    alignItems: 'center',
  },
  sectionTitle: {
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  faqItem: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 14,
    marginBottom: 8,
  },
  contactCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 14,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  formCard: {
    padding: 20,
    borderRadius: 24,
    borderWidth: 1,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 3,
  },
  submitBtn: { marginTop: 12 },
  contactInfo: { marginTop: 24, gap: 10 },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  infoLink: { fontWeight: '500', opacity: 0.8 },
});
