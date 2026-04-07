// src/features/shop/context/CartContext.tsx
import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { Product } from '../types/shop.types';

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (product: Product, quantity?: number) => void;
  removeFromCart: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  totalStandardPrice: number;
  totalCoinPrice: number; // calculated implicitly: 10 coins per unit price
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const COIN_CONVERSION_RATE = 10;

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const addToCart = useCallback((product: Product, quantity: number = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product._id === product._id);
      if (existing) {
        return prev.map((i) =>
          i.product._id === product._id ? { ...i, quantity: i.quantity + quantity } : i
        );
      }
      return [...prev, { product, quantity }];
    });
  }, []);

  const removeFromCart = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.product._id !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.product._id !== productId);
      return prev.map((i) => (i.product._id === productId ? { ...i, quantity } : i));
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalStandardPrice = useMemo(() => {
    return items.reduce((total, item) => {
      const activePrice = item.product.discountedPrice ?? item.product.price;
      return total + activePrice * item.quantity;
    }, 0);
  }, [items]);

  const totalCoinPrice = useMemo(() => {
    return items.reduce((total, item) => {
      const activePrice = item.product.discountedPrice ?? item.product.price;
      return total + activePrice * COIN_CONVERSION_RATE * item.quantity;
    }, 0);
  }, [items]);

  const itemCount = useMemo(() => items.reduce((acc, item) => acc + item.quantity, 0), [items]);

  return (
    <CartContext.Provider
      value={{
        items,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        totalStandardPrice,
        totalCoinPrice,
        itemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};
