// src/features/shop/screens/AddEditAddressScreen.tsx
import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  StyleSheet,
  TextInput,
  Pressable,
  ScrollView,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import { AppText, AppView, Header, Icon } from '../../../components';
import { withOpacity } from '../../../utils/withOpacity';
import { useAddAddress, useUpdateAddress, useAddresses } from '../hooks/useShop';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { ShopRoutes } from '../../../navigation/routes';
import type { SavedAddress } from '../types/shop.types';

type RoutePropT = RouteProp<ShopStackParamList, typeof ShopRoutes.ADD_EDIT_ADDRESS>;

// ─── Address labels ───────────────────────────────────────────────────────────
const LABELS: { id: string; label: string; icon: string }[] = [
  { id: 'Home',   label: 'Home',   icon: 'Home' },
  { id: 'Work',   label: 'Work',   icon: 'Briefcase' },
  { id: 'Office', label: 'Office', icon: 'Building2' },
  { id: 'Other',  label: 'Other',  icon: 'MapPin' },
];

// ─── Styled input ─────────────────────────────────────────────────────────────
const FormInput = ({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize,
  required,
  colors,
  radius,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: any;
  autoCapitalize?: any;
  required?: boolean;
  colors: any;
  radius: any;
}) => (
  <View style={{ marginBottom: 16 }}>
    <AppText
      variant="caption1"
      weight="semiBold"
      style={{ marginBottom: 6, letterSpacing: 0.3 }}
    >
      {label}
      {required && (
        <AppText variant="caption1" color="#EF4444">
          {' '}*
        </AppText>
      )}
    </AppText>
    <TextInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder ?? label}
      placeholderTextColor={colors.mutedForeground}
      keyboardType={keyboardType ?? 'default'}
      autoCapitalize={autoCapitalize ?? 'words'}
      style={[
        styles.input,
        {
          backgroundColor: colors.inputBackground ?? colors.card,
          borderColor: colors.border,
          borderRadius: radius.lg,
          color: colors.foreground,
          fontSize: 15,
        },
      ]}
    />
  </View>
);

// ─── Screen ───────────────────────────────────────────────────────────────────
const AddEditAddressScreen = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const route = useRoute<RoutePropT>();

  const addressId = route.params?.addressId;
  const isEdit = !!addressId;

  const { mutate: fetchAddresses, data: addrData } = useAddresses();
  const { mutate: addAddress, isPending: isAdding } = useAddAddress();
  const { mutate: updateAddress, isPending: isUpdating } = useUpdateAddress();

  const isSaving = isAdding || isUpdating;

  // ── Form State ──────────────────────────────────────────────────────────────
  const [label, setLabel] = useState('Home');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [street, setStreet] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [country, setCountry] = useState('India');
  const [isDefault, setIsDefault] = useState(false);

  // Pre-fill when editing
  useEffect(() => {
    if (isEdit) {
      fetchAddresses();
    }
  }, [isEdit, fetchAddresses]);

  useEffect(() => {
    if (!addrData?.data || !addressId) return;
    const addr = addrData.data.find((a: SavedAddress) => a._id === addressId);
    if (!addr) return;
    setLabel(addr.label || 'Home');
    setFullName(addr.fullName || '');
    setPhone(addr.phone || '');
    setStreet(addr.street || '');
    setCity(addr.city || '');
    setState(addr.state || '');
    setZipCode(addr.zipCode || '');
    setCountry(addr.country || 'India');
    setIsDefault(addr.isDefault || false);
  }, [addrData, addressId]);

  const validate = useCallback(() => {
    if (!fullName.trim()) { Alert.alert('Required', 'Full name is required'); return false; }
    if (!street.trim())   { Alert.alert('Required', 'Street address is required'); return false; }
    if (!city.trim())     { Alert.alert('Required', 'City is required'); return false; }
    if (!state.trim())    { Alert.alert('Required', 'State is required'); return false; }
    if (!zipCode.trim())  { Alert.alert('Required', 'ZIP / PIN code is required'); return false; }
    return true;
  }, [fullName, street, city, state, zipCode]);

  const handleSave = useCallback(() => {
    if (!validate()) return;

    const payload = { label, fullName, phone, street, city, state, zipCode, country, isDefault };

    if (isEdit && addressId) {
      updateAddress(
        { addressId, updates: payload },
        {
          onSuccess: () => { navigation.goBack(); },
          onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to update address'),
        },
      );
    } else {
      addAddress(payload, {
        onSuccess: () => { navigation.goBack(); },
        onError: (err: any) => Alert.alert('Error', err?.message || 'Failed to add address'),
      });
    }
  }, [validate, isEdit, addressId, label, fullName, phone, street, city, state, zipCode, country, isDefault, addAddress, updateAddress, navigation]);

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <Header
        title={isEdit ? 'Edit Address' : 'Add New Address'}
        showBack
        backLabel=""
        rightAction={
          isSaving ? (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
          ) : (
            <Pressable
              onPress={handleSave}
              style={[
                styles.saveBtn,
                { backgroundColor: colors.primary, borderRadius: radius.lg },
              ]}
            >
              <AppText variant="footnote" weight="bold" color="#fff">
                Save
              </AppText>
            </Pressable>
          )
        }
      />

      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingHorizontal: spacing[4], paddingBottom: 40 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Label selector ── */}
        <Animated.View entering={FadeInDown.delay(0).duration(320)}>
          <AppText
            variant="caption1"
            weight="semiBold"
            style={{ marginBottom: 10, marginTop: spacing[4], letterSpacing: 0.3 }}
          >
            ADDRESS TYPE
          </AppText>
          <View style={styles.labelsRow}>
            {LABELS.map(opt => {
              const active = label === opt.id;
              return (
                <Pressable
                  key={opt.id}
                  onPress={() => setLabel(opt.id)}
                  style={[
                    styles.labelChip,
                    {
                      flex: 1,
                      marginHorizontal: 4,
                      borderRadius: radius.xl,
                      borderWidth: active ? 2 : 1.2,
                      borderColor: active ? colors.primary : withOpacity(colors.border, 0.8),
                      backgroundColor: active
                        ? withOpacity(colors.primary, 0.1)
                        : colors.card,
                    },
                  ]}
                >
                  <Icon
                    name={opt.icon as any}
                    size={18}
                    color={active ? colors.primary : colors.mutedForeground}
                  />
                  <AppText
                    variant="caption1"
                    weight={active ? 'semiBold' : 'regular'}
                    color={active ? colors.primary : colors.mutedForeground}
                    style={{ marginTop: 5 }}
                  >
                    {opt.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>

        {/* ── Contact info ── */}
        <Animated.View entering={FadeInDown.delay(60).duration(320)} style={{ marginTop: spacing[5] }}>
          <AppText
            variant="caption1"
            weight="semiBold"
            secondary
            style={{ marginBottom: 12, letterSpacing: 0.3 }}
          >
            CONTACT DETAILS
          </AppText>
          <FormInput label="Full Name"     value={fullName}  onChangeText={setFullName}  required colors={colors} radius={radius} placeholder="e.g. Rahul Sharma" />
          <FormInput label="Phone Number"  value={phone}     onChangeText={setPhone}     colors={colors} radius={radius} keyboardType="phone-pad" autoCapitalize="none" placeholder="+91 98765 43210" />
        </Animated.View>

        {/* ── Address ── */}
        <Animated.View entering={FadeInDown.delay(120).duration(320)}>
          <AppText
            variant="caption1"
            weight="semiBold"
            secondary
            style={{ marginBottom: 12, letterSpacing: 0.3 }}
          >
            ADDRESS DETAILS
          </AppText>
          <FormInput label="Street / Flat / Area" value={street}  onChangeText={setStreet}  required colors={colors} radius={radius} placeholder="Flat 4B, Green Park, MG Road" />

          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FormInput label="City"  value={city}  onChangeText={setCity}  required colors={colors} radius={radius} placeholder="Mumbai" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FormInput label="State" value={state} onChangeText={setState} required colors={colors} radius={radius} placeholder="Maharashtra" />
            </View>
          </View>

          <View style={styles.twoCol}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <FormInput label="ZIP / PIN Code" value={zipCode} onChangeText={setZipCode} required colors={colors} radius={radius} keyboardType="numeric" autoCapitalize="none" placeholder="400001" />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <FormInput label="Country" value={country} onChangeText={setCountry} colors={colors} radius={radius} placeholder="India" />
            </View>
          </View>
        </Animated.View>

        {/* ── Default toggle ── */}
        <Animated.View entering={FadeInDown.delay(180).duration(320)}>
          <Pressable
            onPress={() => setIsDefault(v => !v)}
            style={[
              styles.defaultRow,
              {
                backgroundColor: colors.card,
                borderRadius: radius.xl,
                borderColor: isDefault ? withOpacity(colors.primary, 0.4) : withOpacity(colors.border, 0.8),
                borderWidth: isDefault ? 1.5 : 1,
                padding: spacing[4],
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <AppText variant="subhead" weight="semiBold">
                Set as default address
              </AppText>
              <AppText variant="caption1" secondary style={{ marginTop: 3 }}>
                Used automatically during checkout
              </AppText>
            </View>
            <View
              style={[
                styles.checkbox,
                {
                  borderRadius: radius.full ?? 999,
                  borderColor: isDefault ? colors.primary : colors.border,
                  backgroundColor: isDefault ? colors.primary : 'transparent',
                },
              ]}
            >
              {isDefault && <Icon name="Check" size={13} color="#fff" />}
            </View>
          </Pressable>
        </Animated.View>

        {/* ── Save button ── */}
        <Animated.View entering={FadeInDown.delay(240).duration(320)} style={{ marginTop: spacing[5] }}>
          <Pressable
            onPress={handleSave}
            disabled={isSaving}
            style={[
              styles.saveBtnFull,
              {
                backgroundColor: isSaving ? withOpacity(colors.primary, 0.5) : colors.primary,
                borderRadius: radius.xl,
              },
            ]}
          >
            {isSaving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Icon name={isEdit ? 'Save' : 'Plus'} size={18} color="#fff" />
                <AppText variant="body" weight="bold" color="#fff" style={{ marginLeft: 8 }}>
                  {isEdit ? 'Update Address' : 'Save Address'}
                </AppText>
              </>
            )}
          </Pressable>
        </Animated.View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

export default AddEditAddressScreen;

const styles = StyleSheet.create({
  scroll: { flexGrow: 1 },

  labelsRow: {
    flexDirection: 'row',
    marginLeft: -4,
    marginRight: -4,
  },

  labelChip: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 4,
    minHeight: 70,
  },

  twoCol: {
    flexDirection: 'row',
  },

  input: {
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 13,
    minHeight: 50,
  },

  defaultRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  checkbox: {
    width: 26,
    height: 26,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },

  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    marginRight: 8,
  },

  saveBtnFull: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
