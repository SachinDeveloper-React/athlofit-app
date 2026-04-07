// src/features/shop/types/shop.types.ts

import { ApiResponse } from '../../../types/auth.types';

export interface Category {
  _id: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  description: string;
  productCount: number;
}

export interface Product {
  _id: string;
  name: string;
  description: string;
  price: number;
  discountedPrice: number | null;
  images: string[];
  category: Pick<Category, '_id' | 'name' | 'slug' | 'color' | 'icon'>;
  stock: number;
  tags: string[];
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  coinReward: number;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
}

export interface ProductsData {
  products: Product[];
  pagination: Pagination;
}

export interface OrderItem {
  product: { _id: string; name: string; images: string[] } | null;
  name: string;       // snapshot at purchase time
  price: number;
  coinPrice: number;
  quantity: number;
}

export interface SavedAddress {
  _id: string;
  label: string;
  fullName: string;
  phone: string;
  street: string;
  city: string;
  state: string;
  zipCode: string;
  country: string;
  isDefault: boolean;
}

export interface Order {
  _id: string;
  items: OrderItem[];
  totalPrice: number;
  totalCoins: number;
  paymentMethod: 'STANDARD' | 'COIN_PURCHASE';
  status: 'PENDING' | 'PAID' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  shippingAddress: {
    street?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
  };
  createdAt: string;
}

export interface OrdersData {
  orders: Order[];
  pagination: Pagination;
}

export interface BuyWithCoinsResult {
  order: Order;
  remainingCoins: number;
}

export interface CancelOrderResult {
  orderId: string;
  status: string;
  refundedCoins: number;
}

export type CategoriesResponse = ApiResponse<Category[]>;
export type ProductsResponse = ApiResponse<ProductsData>;
export type FeaturedProductsResponse = ApiResponse<Product[]>;
export type ProductDetailResponse = ApiResponse<Product>;
export type OrdersResponse = ApiResponse<OrdersData>;
export type BuyWithCoinsResponse = ApiResponse<BuyWithCoinsResult>;
export type AddressesResponse = ApiResponse<SavedAddress[]>;
export type CancelOrderResponse = ApiResponse<CancelOrderResult>;

export interface GetProductsParams {
  category?: string;
  page?: number;
  limit?: number;
  sort?: 'newest' | 'price_asc' | 'price_desc' | 'rating';
  search?: string;
}

