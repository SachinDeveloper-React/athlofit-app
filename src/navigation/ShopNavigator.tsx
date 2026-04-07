import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ShopStackParamList } from '../types/navigation.types';
import { ShopRoutes } from './routes';
import ProductDetailScreen from '../features/shop/screens/ProductDetailScreen';
import CartScreen from '../features/shop/screens/CartScreen';
import CheckoutScreen from '../features/shop/screens/CheckoutScreen';
import OrderHistoryScreen from '../features/shop/screens/OrderHistoryScreen';
import ShopSearchScreen from '../features/shop/screens/ShopSearchScreen';
import AddressesScreen from '../features/shop/screens/AddressesScreen';
import AddEditAddressScreen from '../features/shop/screens/AddEditAddressScreen';

const Stack = createNativeStackNavigator<ShopStackParamList>();
const ShopNavigator: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen
        name={ShopRoutes.SHOP_SEARCH}
        component={ShopSearchScreen}
        options={{ animation: 'fade' }}
      />
      <Stack.Screen
        name={ShopRoutes.PRODUCT_DETAIL}
        component={ProductDetailScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ShopRoutes.CART}
        component={CartScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ShopRoutes.CHECKOUT}
        component={CheckoutScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ShopRoutes.ORDER_HISTORY}
        component={OrderHistoryScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ShopRoutes.ADDRESSES}
        component={AddressesScreen}
        options={{ animation: 'slide_from_right' }}
      />
      <Stack.Screen
        name={ShopRoutes.ADD_EDIT_ADDRESS}
        component={AddEditAddressScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
};

export default ShopNavigator;
