import React, { useState, useEffect } from 'react';
import { TouchableOpacity, StyleSheet, Linking, Keyboard, Platform } from 'react-native';
import { APP_CONFIG_DEFAULTS } from '../config/appConfig';
import { useAppConfigStore } from '../store/appConfigStore';
import { useTabBarHeight } from '../hooks/useTabBarHeight';
import WhatsAppIcon from './WhatsAppIcon';

interface WhatsAppSupportButtonProps {
  phoneNumber?: string; 
  message?: string; 
  bottom?: number; // Custom bottom position (overrides auto-calculation)
  right?: number;
  hideOnKeyboard?: boolean; // Hide button when keyboard is visible
}

const WhatsAppSupportButton: React.FC<WhatsAppSupportButtonProps> = ({
  phoneNumber,
  message,
  bottom,
  right = 20,
  hideOnKeyboard = true,
}) => {
  const config = useAppConfigStore(s => s.config);
  const { bottomSpacing } = useTabBarHeight();
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  
  // Use prop or config or default
  const supportNumber = phoneNumber || config?.support?.whatsapp || APP_CONFIG_DEFAULTS.support.whatsapp;
  const supportMessage = message || config?.support?.whatsappMessage || APP_CONFIG_DEFAULTS.support.whatsappMessage;

  // Use custom bottom prop if provided, otherwise use smart tab-aware spacing
  const calculatedBottom = bottom !== undefined ? bottom : bottomSpacing;

  // Listen to keyboard events
  useEffect(() => {
    if (!hideOnKeyboard) return;

    const showSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => setIsKeyboardVisible(true)
    );
    
    const hideSubscription = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setIsKeyboardVisible(false)
    );

    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [hideOnKeyboard]);

  const openWhatsApp = async () => {
    try {
      const encodedMessage = encodeURIComponent(supportMessage);
      
      // Try native WhatsApp app first with whatsapp:// scheme
      const whatsappUrl = `whatsapp://send?phone=${supportNumber}&text=${encodedMessage}`;
      const webUrl = `https://wa.me/${supportNumber}?text=${encodedMessage}`;
      
      // Check if WhatsApp app is installed
      const canOpenApp = await Linking.canOpenURL(whatsappUrl);
      
      if (canOpenApp) {
        // WhatsApp app installed - open directly in app
        await Linking.openURL(whatsappUrl);
      } else {
        // WhatsApp not installed - fallback to web.whatsapp.com
        console.warn('WhatsApp app not installed - opening web version');
        await Linking.openURL(`https://web.whatsapp.com/send?phone=${supportNumber}&text=${encodedMessage}`);
      }
    } catch (error) {
      console.error('Failed to open WhatsApp:', error);
      // Final fallback to wa.me link (opens in browser)
      try {
        const encodedMessage = encodeURIComponent(supportMessage);
        await Linking.openURL(`https://wa.me/${supportNumber}?text=${encodedMessage}`);
      } catch (fallbackError) {
        console.error('All WhatsApp open attempts failed:', fallbackError);
      }
    }
  };

  // Hide button when keyboard is visible (better UX)
  if (hideOnKeyboard && isKeyboardVisible) {
    return null;
  }

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          bottom: calculatedBottom,
          right,
          backgroundColor: '#25D366',
        },
      ]}
      onPress={openWhatsApp}
      activeOpacity={0.8}
    >
      <WhatsAppIcon size={32} color="#FFFFFF" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    zIndex: 999,
    // Shadow for iOS
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 4.65,
  },
});

export default WhatsAppSupportButton;
