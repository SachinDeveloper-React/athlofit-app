// src/features/shop/screens/ShopSearchScreen.tsx — Advanced Redesign
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../../hooks/useTheme';
import AppText from '../../../components/AppText';
import { Icon } from '../../../components/Icon';
import { withOpacity } from '../../../utils/withOpacity';
import { useSearchProducts } from '../hooks/useShop';
import ProductCard, { CARD_WIDTH } from '../components/ProductCard';
import type { Product } from '../types/shop.types';
import { RootRoutes, ShopRoutes } from '../../../navigation/routes';
import type { RootStackParamList } from '../../../types/navigation.types';

const { width: W } = Dimensions.get('window');
const COLUMN_GAP = 12;

function useDebounce<T>(value: T, delay: number): T {
  const [dv, setDv] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDv(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return dv;
}

const TRENDING = ['Protein', 'Creatine', 'Pre-workout', 'Vitamins', 'BCAA', 'Omega-3'];

const ShopSearchScreen = () => {
  const { colors, radius } = useTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const inputRef = useRef<TextInput>(null);
  const [query, setQuery] = useState('');
  const debouncedQ = useDebounce(query, 450);
  const [results, setResults] = useState<Product[]>([]);
  const [searched, setSearched] = useState(false);

  const { mutate: search, isPending } = useSearchProducts();

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 120);
  }, []);

  useEffect(() => {
    if (debouncedQ.trim().length >= 2) {
      setSearched(true);
      search({ q: debouncedQ.trim() }, {
        onSuccess: res => {
          if (res.success) setResults((res.data as any) || []);
        },
      });
    } else {
      setResults([]);
      setSearched(false);
    }
  }, [debouncedQ]);

  const handleProductPress = useCallback((product: Product) => {
    navigation.navigate(RootRoutes.SHOP_NAVIGATOR, {
      screen: ShopRoutes.PRODUCT_DETAIL,
      params: { productId: product._id },
    });
  }, [navigation]);

  const rows: Product[][] = [];
  for (let i = 0; i < results.length; i += 2) rows.push(results.slice(i, i + 2));

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {/* Search header */}
      <View style={[styles.searchHeader, { paddingTop: insets.top + 8, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Icon name="ArrowLeft" size={22} color={colors.foreground} />
        </Pressable>

        <View style={[styles.inputWrap, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
          <Icon name="Search" size={17} color={colors.mutedForeground} />
          <TextInput
            ref={inputRef}
            value={query}
            onChangeText={setQuery}
            placeholder="Search supplements, gear…"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.foreground }]}
            returnKeyType="search"
            autoCapitalize="none"
            autoCorrect={false}
          />
          {query.length > 0 && (
            <Pressable onPress={() => setQuery('')} style={styles.clearX}>
              <Icon name="X" size={15} color={colors.mutedForeground} />
            </Pressable>
          )}
        </View>
      </View>

      {/* Content */}
      {!searched && query.length < 2 ? (
        /* Trending / suggestions */
        <Animated.View entering={FadeInDown.duration(350)} style={styles.suggestionsWrap}>
          <AppText variant="overline" style={{ marginBottom: 14 }}>Trending Searches</AppText>
          <View style={styles.trendingGrid}>
            {TRENDING.map(term => (
              <Pressable
                key={term}
                onPress={() => setQuery(term)}
                style={[styles.trendingChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <Icon name="TrendingUp" size={13} color={colors.primary} />
                <AppText variant="subhead" style={{ marginLeft: 6 }}>{term}</AppText>
              </Pressable>
            ))}
          </View>

          <AppText variant="overline" style={{ marginTop: 28, marginBottom: 14 }}>Tips</AppText>
          {[
            { icon: 'Zap', text: 'Search by product name or ingredient' },
            { icon: 'Tag', text: 'Browse categories from the Shop tab' },
            { icon: 'Coins', text: 'All products are coins-only' },
          ].map(tip => (
            <View key={tip.text} style={[styles.tipRow, { borderBottomColor: colors.border }]}>
              <View style={[styles.tipIcon, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
                <Icon name={tip.icon as any} size={14} color={colors.primary} />
              </View>
              <AppText variant="subhead" secondary style={{ flex: 1, marginLeft: 12 }}>{tip.text}</AppText>
            </View>
          ))}
        </Animated.View>
      ) : isPending ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={colors.primary} />
          <AppText variant="body" secondary style={{ marginTop: 12 }}>Searching…</AppText>
        </View>
      ) : results.length === 0 && searched ? (
        <Animated.View entering={FadeInUp.duration(350)} style={styles.emptyWrap}>
          <View style={[styles.emptyIcon, { backgroundColor: withOpacity(colors.primary, 0.1) }]}>
            <Icon name="SearchX" size={40} color={colors.primary} />
          </View>
          <AppText variant="title3" weight="semiBold" style={{ marginTop: 18 }}>No results found</AppText>
          <AppText variant="body" secondary align="center" style={{ marginTop: 8, lineHeight: 22 }}>
            We couldn't find anything for "{query}".{'\n'}Try a different search term.
          </AppText>
          <View style={styles.trendingGrid}>
            {TRENDING.slice(0, 4).map(term => (
              <Pressable
                key={term}
                onPress={() => setQuery(term)}
                style={[styles.trendingChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}
              >
                <AppText variant="caption1" secondary>{term}</AppText>
              </Pressable>
            ))}
          </View>
        </Animated.View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(_, i) => `sr-${i}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            <Animated.View entering={FadeInDown.duration(250)}>
              <AppText variant="caption1" secondary style={{ marginBottom: 12 }}>
                {results.length} result{results.length !== 1 ? 's' : ''} for "{query}"
              </AppText>
            </Animated.View>
          }
          ItemSeparatorComponent={() => <View style={{ height: COLUMN_GAP }} />}
          renderItem={({ item: row }) => (
            <View style={{ flexDirection: 'row', gap: COLUMN_GAP }}>
              {row.map((product, idx) => (
                <ProductCard key={product._id} product={product} index={idx} onPress={handleProductPress} />
              ))}
              {row.length === 1 && <View style={{ width: CARD_WIDTH }} />}
            </View>
          )}
        />
      )}
    </View>
  );
};

export default ShopSearchScreen;

const styles = StyleSheet.create({
  container: { flex: 1 },
  searchHeader: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, gap: 10,
  },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  inputWrap: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, gap: 8,
  },
  input: { flex: 1, fontSize: 15, padding: 0, margin: 0 },
  clearX: { padding: 4 },

  suggestionsWrap: { padding: 20 },
  trendingGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  trendingChip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, borderWidth: StyleSheet.hairlineWidth,
  },
  tipRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tipIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  emptyWrap: { flex: 1, alignItems: 'center', paddingTop: 60, paddingHorizontal: 32 },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center' },
});
