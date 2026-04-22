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
import { useTheme } from '../hooks/useTheme';

const Stack = createNativeStackNavigator<ShopStackParamList>();
const ShopNavigator: React.FC = () => {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        gestureEnabled: true,
        fullScreenGestureEnabled: true,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name={ShopRoutes.SHOP_SEARCH}     component={ShopSearchScreen} />
      <Stack.Screen name={ShopRoutes.PRODUCT_DETAIL}  component={ProductDetailScreen} />
      <Stack.Screen name={ShopRoutes.CART}            component={CartScreen} />
      <Stack.Screen name={ShopRoutes.CHECKOUT}        component={CheckoutScreen} />
      <Stack.Screen name={ShopRoutes.ORDER_HISTORY}   component={OrderHistoryScreen} />
      <Stack.Screen name={ShopRoutes.ADDRESSES}       component={AddressesScreen} />
      <Stack.Screen
        name={ShopRoutes.ADD_EDIT_ADDRESS}
        component={AddEditAddressScreen}
        options={{ animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
};

export default ShopNavigator;
