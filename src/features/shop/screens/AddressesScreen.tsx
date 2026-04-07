// src/features/shop/screens/AddressesScreen.tsx
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { RouteProp } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../../../hooks/useTheme';
import { AppText, AppView, Header, Icon, Screen } from '../../../components';
import { withOpacity } from '../../../utils/withOpacity';
import { useAddresses, useDeleteAddress, useUpdateAddress } from '../hooks/useShop';
import type { ShopStackParamList } from '../../../types/navigation.types';
import { ShopRoutes } from '../../../navigation/routes';
import type { SavedAddress } from '../types/shop.types';

type RoutePropT = RouteProp<ShopStackParamList, typeof ShopRoutes.ADDRESSES>;

// ─── Label icon map ───────────────────────────────────────────────────────────
const LABEL_ICON: Record<string, string> = {
  Home:   'Home',
  Work:   'Briefcase',
  Office: 'Building2',
  Other:  'MapPin',
};

// ─── Address Card ─────────────────────────────────────────────────────────────
const AddressCard = ({
  address,
  index,
  selected,
  selectMode,
  onSelect,
  onEdit,
  onDelete,
  onSetDefault,
}: {
  address: SavedAddress;
  index: number;
  selected: boolean;
  selectMode: boolean;
  onSelect: (a: SavedAddress) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onSetDefault: (id: string) => void;
}) => {
  const { colors, spacing, radius } = useTheme();
  const iconName = LABEL_ICON[address.label] ?? 'MapPin';
  const isActive = selectMode ? selected : address.isDefault;

  return (
    <Animated.View entering={FadeInDown.delay(index * 55).duration(350)}>
      <Pressable
        onPress={() => selectMode ? onSelect(address) : undefined}
        style={[
          styles.card,
          {
            backgroundColor: colors.card,
            borderRadius: radius.xl,
            borderColor: isActive
              ? withOpacity(colors.primary, 0.7)
              : withOpacity(colors.border, 0.8),
            borderWidth: isActive ? 2 : 1,
            padding: spacing[4],
          },
        ]}
      >
        {/* ─ Top row ─ */}
        <View style={styles.cardTop}>
          <View
            style={[
              styles.iconWrap,
              {
                backgroundColor: withOpacity(colors.primary, 0.1),
                borderRadius: radius.lg,
              },
            ]}
          >
            <Icon name={iconName as any} size={18} color={colors.primary} />
          </View>

          <View style={{ flex: 1, marginLeft: spacing[3] }}>
            <View style={styles.labelRow}>
              <AppText variant="subhead" weight="bold">
                {address.label}
              </AppText>
              {address.isDefault && (
                <View
                  style={[
                    styles.defaultBadge,
                    { borderRadius: radius.full ?? 999, backgroundColor: withOpacity(colors.primary, 0.12) },
                  ]}
                >
                  <AppText variant="caption2" weight="bold" color={colors.primary}>
                    Default
                  </AppText>
                </View>
              )}
            </View>

            {address.fullName ? (
              <AppText variant="footnote" secondary style={{ marginTop: 1 }}>
                {address.fullName}
              </AppText>
            ) : null}
          </View>

          {/* ─ Select radio / action menu ─ */}
          {selectMode ? (
            <View
              style={[
                styles.radio,
                {
                  borderColor: selected ? colors.primary : colors.border,
                  backgroundColor: selected ? colors.primary : 'transparent',
                  borderRadius: 999,
                },
              ]}
            >
              {selected && <Icon name="Check" size={12} color="#fff" />}
            </View>
          ) : (
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => onEdit(address._id)}
                style={[styles.actionBtn, { borderRadius: radius.md, backgroundColor: withOpacity(colors.primary, 0.08) }]}
              >
                <Icon name="Pencil" size={14} color={colors.primary} />
              </Pressable>
              <Pressable
                onPress={() => onDelete(address._id)}
                style={[styles.actionBtn, { borderRadius: radius.md, backgroundColor: withOpacity('#EF4444', 0.08), marginLeft: 8 }]}
              >
                <Icon name="Trash2" size={14} color="#EF4444" />
              </Pressable>
            </View>
          )}
        </View>

        {/* ─ Address lines ─ */}
        <View style={[styles.addrLines, { marginTop: spacing[3] }]}>
          <Icon name="MapPin" size={13} color={colors.mutedForeground} />
          <AppText variant="footnote" secondary style={{ flex: 1, marginLeft: 6, lineHeight: 18 }}>
            {[address.street, address.city, address.state, address.zipCode, address.country]
              .filter(Boolean)
              .join(', ')}
          </AppText>
        </View>

        {address.phone ? (
          <View style={[styles.addrLines, { marginTop: spacing[1] }]}>
            <Icon name="Phone" size={13} color={colors.mutedForeground} />
            <AppText variant="footnote" secondary style={{ marginLeft: 6 }}>
              {address.phone}
            </AppText>
          </View>
        ) : null}

        {/* ─ Set as default (non-select mode) ─ */}
        {!selectMode && !address.isDefault && (
          <Pressable
            onPress={() => onSetDefault(address._id)}
            style={[styles.setDefaultBtn, { marginTop: spacing[3], borderColor: withOpacity(colors.border, 0.9) }]}
          >
            <AppText variant="caption1" color={colors.primary} weight="semiBold">
              Set as Default
            </AppText>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const AddressesScreen = () => {
  const { colors, spacing, radius } = useTheme();
  const navigation =
    useNavigation<NativeStackNavigationProp<ShopStackParamList>>();
  const route = useRoute<RoutePropT>();

  const selectMode = route.params?.selectMode ?? false;

  const { mutate: fetchAll, data: addrData, isPending } = useAddresses();
  const { mutate: deleteAddr, isPending: isDeleting, variables: deletingId } = useDeleteAddress();
  const { mutate: updateAddr, isPending: isUpdating } = useUpdateAddress();

  const addresses: SavedAddress[] = useMemo(
    () => addrData?.data ?? [],
    [addrData],
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Initialize selection to default
  useEffect(() => {
    if (addresses.length > 0 && !selectedId) {
      const def = addresses.find(a => a.isDefault) ?? addresses[0];
      setSelectedId(def._id);
    }
  }, [addresses, selectedId]);

  const handleDelete = useCallback(
    (id: string) => {
      Alert.alert('Delete Address', 'Remove this address from your account?', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () =>
            deleteAddr(id, {
              onSuccess: () => fetchAll(),
              onError: (err: any) => Alert.alert('Error', err?.message || 'Could not delete'),
            }),
        },
      ]);
    },
    [deleteAddr, fetchAll],
  );

  const handleSetDefault = useCallback(
    (id: string) => {
      updateAddr(
        { addressId: id, updates: { isDefault: true } },
        {
          onSuccess: () => fetchAll(),
          onError: (err: any) => Alert.alert('Error', err?.message || 'Could not update'),
        },
      );
    },
    [updateAddr, fetchAll],
  );

  const handleSelect = useCallback(
    (addr: SavedAddress) => {
      setSelectedId(addr._id);
      // Navigate back and pass the selected address via navigation params
      navigation.navigate(ShopRoutes.CART, { selectedAddress: addr } as any);
    },
    [navigation],
  );

  const handleEdit = useCallback(
    (id: string) => {
      navigation.navigate(ShopRoutes.ADD_EDIT_ADDRESS, { addressId: id });
    },
    [navigation],
  );

  return (
    <Screen padded={false} safeArea={false}>
      <AppView style={[styles.container, { backgroundColor: colors.background }]}>
        <Header
          title={selectMode ? 'Select Delivery Address' : 'Saved Addresses'}
          showBack
          backLabel=""
          rightAction={
            <Pressable
              onPress={() => navigation.navigate(ShopRoutes.ADD_EDIT_ADDRESS, undefined)}
              style={[
                styles.addBtn,
                { backgroundColor: withOpacity(colors.primary, 0.12), borderRadius: radius.lg },
              ]}
            >
              <Icon name="Plus" size={15} color={colors.primary} />
              <AppText variant="footnote" weight="semiBold" color={colors.primary} style={{ marginLeft: 4 }}>
                Add
              </AppText>
            </Pressable>
          }
        />

        {isPending ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <AppText variant="body" secondary style={{ marginTop: 12 }}>
              Loading addresses…
            </AppText>
          </View>
        ) : addresses.length === 0 ? (
          /* ─── Empty state ─── */
          <Animated.View entering={FadeInUp.duration(350)} style={styles.center}>
            <View
              style={[
                styles.emptyIcon,
                { backgroundColor: withOpacity(colors.primary, 0.1), borderRadius: 999 },
              ]}
            >
              <Icon name="MapPin" size={38} color={colors.primary} />
            </View>
            <AppText variant="title3" weight="bold" style={{ marginTop: 20 }}>
              No Addresses Saved
            </AppText>
            <AppText
              variant="body"
              secondary
              align="center"
              style={{ marginTop: 8, lineHeight: 22, paddingHorizontal: 32 }}
            >
              Add a delivery address to get started with shopping.
            </AppText>
            <Pressable
              onPress={() => navigation.navigate(ShopRoutes.ADD_EDIT_ADDRESS, undefined)}
              style={[
                styles.addBtnLarge,
                { backgroundColor: colors.primary, borderRadius: radius.xl, marginTop: 28 },
              ]}
            >
              <Icon name="Plus" size={18} color="#fff" />
              <AppText variant="body" weight="bold" color="#fff" style={{ marginLeft: 8 }}>
                Add First Address
              </AppText>
            </Pressable>
          </Animated.View>
        ) : (
          <FlatList
            data={addresses}
            keyExtractor={item => item._id}
            renderItem={({ item, index }) => (
              <AddressCard
                address={item}
                index={index}
                selected={selectedId === item._id}
                selectMode={selectMode}
                onSelect={handleSelect}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSetDefault={handleSetDefault}
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: spacing[4], paddingBottom: 100 }}
            ItemSeparatorComponent={() => <View style={{ height: spacing[3] }} />}
            ListFooterComponent={
              selectMode ? (
                <Pressable
                  onPress={() => {
                    const addr = addresses.find(a => a._id === selectedId);
                    if (addr) handleSelect(addr);
                  }}
                  style={[
                    styles.confirmBtn,
                    { backgroundColor: colors.primary, borderRadius: radius.xl, marginTop: spacing[4] },
                  ]}
                >
                  <Icon name="CheckCircle2" size={18} color="#fff" />
                  <AppText variant="body" weight="bold" color="#fff" style={{ marginLeft: 8 }}>
                    Deliver Here
                  </AppText>
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => navigation.navigate(ShopRoutes.ADD_EDIT_ADDRESS, undefined)}
                  style={[
                    styles.addMoreBtn,
                    {
                      borderColor: withOpacity(colors.primary, 0.5),
                      borderRadius: radius.xl,
                      marginTop: spacing[4],
                    },
                  ]}
                >
                  <Icon name="Plus" size={16} color={colors.primary} />
                  <AppText variant="body" weight="semiBold" color={colors.primary} style={{ marginLeft: 8 }}>
                    Add New Address
                  </AppText>
                </Pressable>
              )
            }
          />
        )}
      </AppView>
    </Screen>
  );
};

export default AddressesScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },

  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  emptyIcon: { width: 80, height: 80, justifyContent: 'center', alignItems: 'center' },

  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    marginRight: 8,
  },

  addBtnLarge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 15,
  },

  card: { overflow: 'hidden' },

  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },

  iconWrap: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },

  labelRow: { flexDirection: 'row', alignItems: 'center' },

  defaultBadge: { paddingHorizontal: 8, paddingVertical: 3, marginLeft: 8 },

  radio: {
    width: 24,
    height: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },

  actionRow: { flexDirection: 'row', alignItems: 'center' },

  actionBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },

  addrLines: { flexDirection: 'row', alignItems: 'flex-start' },

  setDefaultBtn: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },

  confirmBtn: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  addMoreBtn: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
});
