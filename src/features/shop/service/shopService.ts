// src/features/shop/service/shopService.ts
import { api } from '../../../utils/api';
import type {
  CategoriesResponse,
  ProductsResponse,
  FeaturedProductsResponse,
  ProductDetailResponse,
  GetProductsParams,
  OrdersResponse,
  BuyWithCoinsResponse,
  AddressesResponse,
  CancelOrderResponse,
  SavedAddress,
} from '../types/shop.types';

export const shopService = {
  // ── Shop ──────────────────────────────────────────────────────────────────
  getCategories: async () => {
    const response = await api.get<CategoriesResponse>('shop/categories');
    return { success: response.success, message: response.message, data: response.data };
  },

  getProducts: async (params: GetProductsParams = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set('category', params.category);
    if (params.page)     query.set('page', String(params.page));
    if (params.limit)    query.set('limit', String(params.limit));
    if (params.sort)     query.set('sort', params.sort);
    if (params.search)   query.set('search', params.search);
    const url = `shop/products?${query.toString()}`;
    const response = await api.get<ProductsResponse>(url);
    return { success: response.success, message: response.message, data: response.data };
  },

  getFeaturedProducts: async () => {
    const response = await api.get<FeaturedProductsResponse>('shop/products/featured');
    return { success: response.success, message: response.message, data: response.data };
  },

  getProductById: async (id: string) => {
    const response = await api.get<ProductDetailResponse>(`shop/products/${id}`);
    return { success: response.success, message: response.message, data: response.data };
  },

  searchProducts: async (q: string, limit = 10) => {
    const response = await api.get<FeaturedProductsResponse>(
      `shop/search?q=${encodeURIComponent(q)}&limit=${limit}`,
    );
    return { success: response.success, message: response.message, data: response.data };
  },

  buyWithCoins: async (
    items: { productId: string; quantity: number }[],
    shippingAddress?: any,
  ) => {
    const response = await api.post<BuyWithCoinsResponse>('shop/cart/buy-with-coins', {
      items,
      shippingAddress,
    });
    return { success: response.success, message: response.message, data: response.data };
  },

  getOrders: async (page = 1, limit = 20) => {
    const response = await api.get<OrdersResponse>(
      `shop/orders?page=${page}&limit=${limit}`,
    );
    return { success: response.success, message: response.message, data: response.data };
  },

  // ── Cancel Order ─────────────────────────────────────────────────────────
  cancelOrder: async (orderId: string) => {
    const response = await api.patch<CancelOrderResponse>(
      `shop/orders/${orderId}/cancel`,
    );
    return { success: response.success, message: response.message, data: response.data };
  },

  // ── Delivery Addresses ────────────────────────────────────────────────────
  getAddresses: async () => {
    const response = await api.get<AddressesResponse>('user/addresses');
    return { success: response.success, message: response.message, data: response.data };
  },

  addAddress: async (
    address: Omit<SavedAddress, '_id' | 'isDefault'> & { isDefault?: boolean },
  ) => {
    const response = await api.post<AddressesResponse>('user/addresses', address);
    return { success: response.success, message: response.message, data: response.data };
  },

  updateAddress: async (
    addressId: string,
    updates: Partial<Omit<SavedAddress, '_id'>>,
  ) => {
    const response = await api.patch<AddressesResponse>(
      `user/addresses/${addressId}`,
      updates,
    );
    return { success: response.success, message: response.message, data: response.data };
  },

  deleteAddress: async (addressId: string) => {
    const response = await api.delete<AddressesResponse>(
      `user/addresses/${addressId}`,
    );
    return { success: response.success, message: response.message, data: response.data };
  },
};
