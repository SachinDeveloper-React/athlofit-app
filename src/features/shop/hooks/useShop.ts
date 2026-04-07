// src/features/shop/hooks/useShop.ts
import { useState, useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { shopService } from '../service/shopService';
import type { Category, Product, Pagination, GetProductsParams, Order } from '../types/shop.types';

// ─── useCategories ────────────────────────────────────────────────────────────
export function useCategories() {
  return useMutation({
    mutationFn: () => shopService.getCategories(),
  });
}

// ─── useProducts ──────────────────────────────────────────────────────────────
export function useProducts() {
  return useMutation({
    mutationFn: (params: GetProductsParams) => shopService.getProducts(params),
  });
}

// ─── useFeaturedProducts ──────────────────────────────────────────────────────
export function useFeaturedProducts() {
  return useMutation({
    mutationFn: () => shopService.getFeaturedProducts(),
  });
}

// ─── useProductDetail ─────────────────────────────────────────────────────────
export function useProductDetail() {
  return useMutation({
    mutationFn: (id: string) => shopService.getProductById(id),
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
    mutationFn: ({ items, shippingAddress }: { items: { productId: string; quantity: number }[]; shippingAddress?: any }) =>
      shopService.buyWithCoins(items, shippingAddress),
    onSuccess: () => {
      // Invalidate orders cache so OrderHistoryScreen refreshes after a purchase
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ─── useOrders ───────────────────────────────────────────────────────────
export function useOrders() {
  return useMutation({
    mutationFn: ({ page, limit }: { page?: number; limit?: number } = {}) =>
      shopService.getOrders(page, limit),
  });
}

// ─── useCancelOrder ───────────────────────────────────────────────────────
export function useCancelOrder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId: string) => shopService.cancelOrder(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}

// ─── useAddresses ─────────────────────────────────────────────────────────
export function useAddresses() {
  return useMutation({
    mutationFn: () => shopService.getAddresses(),
  });
}

// ─── useAddAddress ────────────────────────────────────────────────────────
export function useAddAddress() {
  return useMutation({
    mutationFn: (address: Parameters<typeof shopService.addAddress>[0]) =>
      shopService.addAddress(address),
  });
}

// ─── useUpdateAddress ─────────────────────────────────────────────────────
export function useUpdateAddress() {
  return useMutation({
    mutationFn: ({
      addressId,
      updates,
    }: {
      addressId: string;
      updates: Parameters<typeof shopService.updateAddress>[1];
    }) => shopService.updateAddress(addressId, updates),
  });
}

// ─── useDeleteAddress ─────────────────────────────────────────────────────
export function useDeleteAddress() {
  return useMutation({
    mutationFn: (addressId: string) => shopService.deleteAddress(addressId),
  });
}



// ─── useShopState — combined local state for ShopScreen ──────────────────────
export function useShopState() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<GetProductsParams['sort']>('newest');
  const [searchQuery, setSearchQuery] = useState('');

  const { mutate: fetchCategories, mutateAsync: fetchCategoriesAsync, isPending: isCategoryPending } = useCategories();
  const { mutate: fetchFeatured, mutateAsync: fetchFeaturedAsync, isPending: isFeaturedPending } = useFeaturedProducts();
  const { mutate: fetchProducts, mutateAsync: fetchProductsAsync, isPending: isProductsPending } = useProducts();

  const [isRefreshing, setIsRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [_cats, _feat, _prods] = await Promise.all([
        fetchCategoriesAsync(),
        fetchFeaturedAsync(),
        fetchProductsAsync({ category: 'all', sort: 'newest' })
      ]);
      
      if (_cats.success && _cats.data) {
        const all: Category = { _id: 'all', name: 'All', slug: 'all', icon: 'LayoutGrid', color: '#0099FF', description: '', productCount: 0 };
        setCategories([all, ..._cats.data]);
      }
      if (_feat.success && _feat.data) setFeaturedProducts(_feat.data);
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
  }, [fetchCategoriesAsync, fetchFeaturedAsync, fetchProductsAsync]);

  const loadInitialData = useCallback(() => {
    fetchCategories(undefined, {
      onSuccess: (res) => {
        if (res.success && res.data) {
          const all: Category = { _id: 'all', name: 'All', slug: 'all', icon: 'LayoutGrid', color: '#0099FF', description: '', productCount: 0 };
          setCategories([all, ...res.data]);
        }
      },
    });

    fetchFeatured(undefined, {
      onSuccess: (res) => {
        if (res.success && res.data) setFeaturedProducts(res.data);
      },
    });

    fetchProducts({ category: 'all', sort: 'newest' }, {
      onSuccess: (res) => {
        if (res.success && res.data) {
          setProducts(res.data.products);
          setPagination(res.data.pagination);
        }
      },
    });
  }, [fetchCategories, fetchFeatured, fetchProducts]);

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

  const isLoading = isCategoryPending || isFeaturedPending || isProductsPending;

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
    setSortBy,
    loadInitialData,
    loadByCategory,
    loadMore,
    onRefresh,
  };
}
