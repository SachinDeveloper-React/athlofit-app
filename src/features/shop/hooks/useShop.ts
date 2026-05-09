// src/features/shop/hooks/useShop.ts
import { useState, useCallback } from 'react';
import { useMutation, useQuery, useQueryClient, useInfiniteQuery } from '@tanstack/react-query';
import { shopService } from '../service/shopService';
import type { Category, Product, Pagination, GetProductsParams, Order } from '../types/shop.types';

// ─── Query keys ───────────────────────────────────────────────────────────────
export const ADDRESSES_KEY       = ['addresses']        as const;
export const SHOP_CATEGORIES_KEY = ['shop-categories']  as const;
export const SHOP_FEATURED_KEY   = ['shop-featured']    as const;
export const SHOP_ORDERS_KEY     = ['orders']           as const;

// ─── useCategories ────────────────────────────────────────────────────────────
export function useCategories() {
  return useQuery({
    queryKey: SHOP_CATEGORIES_KEY,
    queryFn:  () => shopService.getCategories(),
    staleTime: 5 * 60_000,
    select: res => res.data ?? [],
  });
}

// ─── useProducts ──────────────────────────────────────────────────────────────
// Products depend on user-chosen category + sort, so they stay as a mutation.
export function useProducts() {
  return useMutation({
    mutationFn: (params: GetProductsParams) => shopService.getProducts(params),
  });
}

// ─── useFeaturedProducts ──────────────────────────────────────────────────────
export function useFeaturedProducts() {
  return useQuery({
    queryKey: SHOP_FEATURED_KEY,
    queryFn:  () => shopService.getFeaturedProducts(),
    staleTime: 5 * 60_000,
    select: res => res.data ?? [],
  });
}

// ─── useProductDetail ─────────────────────────────────────────────────────────
export function useProductDetail() {
  return useMutation({
    mutationFn: (id: string) => shopService.getProductById(id),
  });
}

// ─── useProductReviews ────────────────────────────────────────────────────────
export function useProductReviews(productId: string) {
  return useMutation({
    mutationFn: ({ page = 1, limit = 10 }: { page?: number; limit?: number } = {}) =>
      shopService.getProductReviews(productId, page, limit),
  });
}

// ─── useAddReview ─────────────────────────────────────────────────────────────
export function useAddReview(productId: string) {
  return useMutation({
    mutationFn: (body: import('../types/shop.types').AddReviewRequest) =>
      shopService.addReview(productId, body),
  });
}

// ─── useSearchProducts ────────────────────────────────────────────────────────
export function useSearchProducts() {
  return useMutation({
    mutationFn: ({ q, limit }: { q: string; limit?: number }) =>
      shopService.searchProducts(q, limit),
  });
}

// ─── useBuyWithCoins ───────────────────────────────────────────
export function useBuyWithCoins() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      items,
      shippingAddress,
      couponCode,
    }: {
      items: { productId: string; quantity: number }[];
      shippingAddress?: any;
      couponCode?: string;
    }) => shopService.buyWithCoins(items, shippingAddress, couponCode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
    },
  });
}

// ─── useOrders — infinite scroll pagination ───────────────────────────────────
export function useOrders() {
  return useInfiniteQuery({
    queryKey: SHOP_ORDERS_KEY,
    queryFn: ({ pageParam = 1 }) => shopService.getOrders(pageParam as number, 15),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const p = lastPage.data?.pagination;
      if (!p || !p.hasMore) return undefined;
      return p.page + 1;
    },
    staleTime: 2 * 60_000,
    select: (data) => ({
      pages: data.pages,
      pageParams: data.pageParams,
      orders: data.pages.flatMap(p => p.data?.orders ?? []),
      total: data.pages[0]?.data?.pagination?.total ?? 0,
    }),
  });
}

// ─── useCancelOrder ───────────────────────────────────────────────────────
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => shopService.cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SHOP_ORDERS_KEY });
    },
  });
}

// ─── useAddresses — useQuery so the list auto-refreshes ──────────────────────
export function useAddresses() {
  return useQuery({
    queryKey: ADDRESSES_KEY,
    queryFn:  () => shopService.getAddresses(),
    staleTime: 2 * 60_000,
    select: res => res.data ?? [],
  });
}

// ─── useAddAddress ────────────────────────────────────────────────────────────
export function useAddAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (address: Parameters<typeof shopService.addAddress>[0]) =>
      shopService.addAddress(address),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}

// ─── useUpdateAddress ─────────────────────────────────────────────────────────
export function useUpdateAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      addressId,
      updates,
    }: {
      addressId: string;
      updates: Parameters<typeof shopService.updateAddress>[1];
    }) => shopService.updateAddress(addressId, updates),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}

// ─── useDeleteAddress ─────────────────────────────────────────────────────────
export function useDeleteAddress() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (addressId: string) => shopService.deleteAddress(addressId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ADDRESSES_KEY }),
  });
}

// ─── useValidateCoupon ────────────────────────────────────────────────────────
export function useValidateCoupon() {
  return useMutation({
    mutationFn: ({ code, cartTotalCoins }: { code: string; cartTotalCoins: number }) =>
      shopService.validateCoupon(code, cartTotalCoins),
  });
}

// ─── useAvailableCoupons ──────────────────────────────────────────────────────
export function useAvailableCoupons() {
  return useQuery({
    queryKey: ['available-coupons'],
    queryFn:  () => shopService.getAvailableCoupons(),
    staleTime: 5 * 60_000,
    select: res => res.data ?? [],
  });
}



// ─── useShopState — combined local state for ShopScreen ──────────────────────
export function useShopState() {
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<GetProductsParams['sort']>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  // Categories and featured are now useQuery — auto-fetch, cached, no manual trigger needed
  const { data: rawCategories, isLoading: isCategoryPending, refetch: refetchCategories } = useCategories();
  const { data: featuredProducts = [], isLoading: isFeaturedPending, refetch: refetchFeatured } = useFeaturedProducts();
  const { mutate: fetchProducts, mutateAsync: fetchProductsAsync, isPending: isProductsPending } = useProducts();

  const ALL_CATEGORY: Category = { _id: 'all', name: 'All', slug: 'all', icon: 'LayoutGrid', color: '#0099FF', description: '', productCount: 0 };
  const categories: Category[] = rawCategories ? [ALL_CATEGORY, ...rawCategories] : [];

  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [, , _prods] = await Promise.all([
        refetchCategories(),
        refetchFeatured(),
        fetchProductsAsync({ category: 'all', sort: 'newest' }),
      ]);
      if (_prods.success && _prods.data) {
        setProducts(_prods.data.products);
        setPagination(_prods.data.pagination);
        setSelectedCategory('all');
        setSortBy('newest');
      }
    } catch (error) {
      console.error('Failed to refresh shop data', error);
    } finally {
      setIsRefreshing(false);
    }
  }, [refetchCategories, refetchFeatured, fetchProductsAsync]);

  // Called once by ShopScreen on mount — only fetches products (categories + featured come from useQuery)
  const loadInitialData = useCallback(() => {
    fetchProducts({ category: 'all', sort: 'newest' }, {
      onSuccess: (res) => {
        if (res.success && res.data) {
          setProducts(res.data.products);
          setPagination(res.data.pagination);
        }
      },
    });
  }, [fetchProducts]);

  const loadByCategory = useCallback((slug: string) => {
    setSelectedCategory(slug);
    setProducts([]);
    fetchProducts({ category: slug, sort: sortBy }, {
      onSuccess: (res) => {
        if (res.success && res.data) {
          setProducts(res.data.products);
          setPagination(res.data.pagination);
        }
      },
    });
  }, [fetchProducts, sortBy]);

  // Sort change — re-fetch products with new sort, keep current category
  const handleSortChange = useCallback((sort: GetProductsParams['sort']) => {
    setSortBy(sort);
    setProducts([]);
    fetchProducts({ category: selectedCategory, sort }, {
      onSuccess: (res) => {
        if (res.success && res.data) {
          setProducts(res.data.products);
          setPagination(res.data.pagination);
        }
      },
    });
  }, [fetchProducts, selectedCategory]);

  const loadMore = useCallback(() => {
    if (!pagination?.hasMore || isProductsPending) return;
    fetchProducts({ category: selectedCategory, page: (pagination.page) + 1, sort: sortBy }, {
      onSuccess: (res) => {
        if (res.success && res.data) {
          setProducts((prev) => [...prev, ...res.data!.products]);
          setPagination(res.data.pagination);
        }
      },
    });
  }, [pagination, selectedCategory, sortBy, isProductsPending, fetchProducts]);

  // isLoading = only initial load (no products yet), NOT category/sort switches
  const isLoading = (isCategoryPending || isFeaturedPending) && products.length === 0;

  return {
    categories,
    featuredProducts,
    products,
    pagination,
    selectedCategory,
    sortBy,
    searchQuery,
    isLoading,
    isRefreshing,
    isProductsPending,
    setSearchQuery,
    setSortBy: handleSortChange,
    loadInitialData,
    loadByCategory,
    loadMore,
    onRefresh,
  };
}
