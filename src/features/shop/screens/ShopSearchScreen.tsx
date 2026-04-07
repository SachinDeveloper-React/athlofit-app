import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, TextInput, Pressable, FlatList, ActivityIndicator, Dimensions } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../../hooks/useTheme';
import { AppView, AppText, Screen, Icon } from '../../../components';
import { useSearchProducts } from '../hooks/useShop';
import ProductCard, { CARD_WIDTH } from '../components/ProductCard';
import type { Product } from '../types/shop.types';

const { width } = Dimensions.get('window');
const COLUMN_GAP = 12;

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
}

const ShopSearchScreen = () => {
  const { colors, spacing, radius, fontSize } = useTheme();
  const navigation = useNavigation();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 500);
  const [results, setResults] = useState<Product[]>([]);
  const searchInputRef = useRef<TextInput>(null);

  const { mutate: search, isPending } = useSearchProducts();

  useEffect(() => {
    // Auto focus search input on mount
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  }, []);

  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      search({ q: debouncedQuery.trim() }, {
        onSuccess: (res) => {
          if (res.success && res.data) {
            // Need to type assert because the backend returns ProductsData or an array depending on how search is implemented.
            // Oh wait, looking at my backend code, `searchProducts` returns `res.data` as `Product[]` directly, not `ProductsData`.
            // Wait, let me check the hook type.
            setResults((res.data as any) || []);
          }
        }
      });
    } else {
      setResults([]);
    }
  }, [debouncedQuery, search]);

  const handleProductPress = useCallback((product: Product) => {
    console.log('Navigate to product:', product._id);
  }, []);

  const renderHeader = () => (
    <View style={[styles.headerContainer, { paddingHorizontal: spacing[4], paddingTop: spacing[5], paddingBottom: spacing[4], borderBottomColor: colors.border, borderBottomWidth: 1 }]}>
      <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
        <Icon name="ArrowLeft" size={24} color={colors.foreground} />
      </Pressable>
      
      <View style={[styles.searchBar, { backgroundColor: colors.secondary, borderRadius: radius.xl, borderColor: 'transparent', flex: 1, marginLeft: spacing[3] }]}>
        <Icon name="Search" size={18} color={colors.mutedForeground} />
        <TextInput
          ref={searchInputRef}
          value={query}
          onChangeText={setQuery}
          placeholder="Search supplements, gear…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.searchInput, { color: colors.foreground, fontSize: fontSize.md }]}
          returnKeyType="search"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery('')}>
            <Icon name="X" size={16} color={colors.mutedForeground} />
          </Pressable>
        )}
      </View>
    </View>
  );

  const renderEmpty = () => {
    if (isPending) return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );

    if (query.trim().length < 2) return null;

    if (results.length === 0 && query.trim().length >= 2) {
      return (
        <View style={{ alignItems: 'center', marginTop: 60, paddingHorizontal: spacing[6] }}>
          <Icon name="Search" size={36} color={colors.mutedForeground} />
          <AppText variant="title3" weight="semiBold" style={{ marginTop: spacing[4] }}>No results found</AppText>
          <AppText variant="body" secondary align="center" style={{ marginTop: spacing[2] }}>
            We couldn't find anything for "{query}". Try another search term.
          </AppText>
        </View>
      );
    }
    
    return null;
  };

  const rows: Product[][] = [];
  for (let i = 0; i < results.length; i += 2) {
    rows.push(results.slice(i, i + 2));
  }

  return (
    <Screen padded={false} safeArea={true}>
      <AppView style={{ flex: 1, backgroundColor: colors.background }}>
        {renderHeader()}

        <FlatList
          data={rows}
          keyExtractor={(_, i) => `search-row-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: spacing[4], paddingBottom: 120, paddingTop: spacing[4] }}
          ListEmptyComponent={renderEmpty}
          ItemSeparatorComponent={() => <View style={{ height: COLUMN_GAP }} />}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: COLUMN_GAP }}>
              {row.map((product, idx) => (
                <ProductCard
                  key={product._id}
                  product={product}
                  index={0}
                  onPress={handleProductPress}
                />
              ))}
              {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
            </View>
          )}
        />
      </AppView>
    </Screen>
  );
};

export default ShopSearchScreen;

const styles = StyleSheet.create({
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    padding: 4,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    padding: 0,
    margin: 0,
  },
});
