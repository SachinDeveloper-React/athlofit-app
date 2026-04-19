// src/features/account/components/AvatarPickerModal.tsx
// Modal that lets the user pick a photo from camera or gallery.
// Single photo only, auto-cropped to 800x800.

import React, { memo } from 'react';
import {
  Modal,
  StyleSheet,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  Alert,
  PermissionsAndroid,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '../../../components';
import { Icon } from '../../../components';
import { useTheme } from '../../../hooks/useTheme';

// Lazy-require so the app doesn't crash if native module isn't linked yet
let ImagePicker: typeof import('react-native-image-picker') | null = null;
try {
  ImagePicker = require('react-native-image-picker');
} catch {
  ImagePicker = null;
}

interface Props {
  visible: boolean;
  onClose: () => void;
  onPick: (uri: string) => void;
}

const CAMERA_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 1 as const,
  maxWidth: 800,
  maxHeight: 800,
  includeBase64: false,
  saveToPhotos: false,
};

const GALLERY_OPTIONS = {
  mediaType: 'photo' as const,
  quality: 1 as const,
  maxWidth: 800,
  maxHeight: 800,
  includeBase64: false,
  selectionLimit: 1,
};

const AvatarPickerModal = memo(({ visible, onClose, onPick }: Props) => {
  const { colors, radius } = useTheme();
  const { bottom } = useSafeAreaInsets();

  const handleResponse = (response: any) => {
    if (response.didCancel) return;
    if (response.errorCode) {
      Alert.alert('Error', response.errorMessage ?? 'Could not open camera');
      return;
    }
    const uri = response.assets?.[0]?.uri;
    if (uri) {
      onClose();
      onPick(uri);
    }
  };

  const checkModule = () => {
    if (!ImagePicker) {
      Alert.alert('Rebuild Required', 'Run: npx react-native run-android');
      return false;
    }
    return true;
  };

  const openCamera = async () => {
    if (!checkModule()) return;

    // Request camera permission on Android at runtime
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'Camera Permission',
          message: 'Athlofit needs camera access to take your profile photo.',
          buttonPositive: 'Allow',
          buttonNegative: 'Deny',
        },
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        Alert.alert('Permission Denied', 'Camera permission is required to take a photo.');
        return;
      }
    }

    ImagePicker!.launchCamera(CAMERA_OPTIONS, handleResponse);
  };

  const openGallery = () => {
    if (!checkModule()) return;
    ImagePicker!.launchImageLibrary(GALLERY_OPTIONS, handleResponse);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.backdrop} />
      </TouchableWithoutFeedback>

      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.card,
            paddingBottom: bottom + 16,
            borderTopLeftRadius: radius['2xl'] ?? 24,
            borderTopRightRadius: radius['2xl'] ?? 24,
          },
        ]}
      >
        {/* Handle */}
        <View style={[styles.handle, { backgroundColor: colors.border }]} />

        <AppText variant="headline" weight="semiBold" style={styles.title}>
          Change Photo
        </AppText>

        {/* Camera */}
        <TouchableOpacity
          style={[styles.option, { borderBottomColor: colors.border }]}
          onPress={openCamera}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
            <Icon name="Camera" size={22} color={colors.primary} />
          </View>
          <View style={styles.optionText}>
            <AppText variant="callout" weight="semiBold">Take Photo</AppText>
            <AppText variant="caption1" style={{ opacity: 0.55, marginTop: 2 }}>
              Use your camera
            </AppText>
          </View>
          <Icon name="ChevronRight" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Gallery */}
        <TouchableOpacity
          style={styles.option}
          onPress={openGallery}
          activeOpacity={0.7}
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.primary + '15' }]}>
            <Icon name="Image" size={22} color={colors.primary} />
          </View>
          <View style={styles.optionText}>
            <AppText variant="callout" weight="semiBold">Choose from Gallery</AppText>
            <AppText variant="caption1" style={{ opacity: 0.55, marginTop: 2 }}>
              Pick from your photos
            </AppText>
          </View>
          <Icon name="ChevronRight" size={18} color={colors.mutedForeground} />
        </TouchableOpacity>

        {/* Cancel */}
        <TouchableOpacity
          style={[styles.cancelBtn, { backgroundColor: colors.secondary }]}
          onPress={onClose}
          activeOpacity={0.7}
        >
          <AppText variant="callout" weight="semiBold" style={{ color: colors.destructive }}>
            Cancel
          </AppText>
        </TouchableOpacity>
      </View>
    </Modal>
  );
});

AvatarPickerModal.displayName = 'AvatarPickerModal';
export default AvatarPickerModal;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 20,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: { flex: 1 },
  cancelBtn: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
});
