/**
 * Platform-aware KeyboardAvoidingView.
 *
 * - Android: uses react-native-keyboard-controller (requires KeyboardProvider)
 * - iOS: uses the native RN KeyboardAvoidingView (avoids NativeEventEmitter crash
 *   with static frameworks)
 */
import { Platform } from 'react-native';
import { KeyboardAvoidingView as RNKeyboardAvoidingView } from 'react-native';
import { KeyboardAvoidingView as KCKeyboardAvoidingView } from 'react-native-keyboard-controller';

const KeyboardAvoidingView =
  Platform.OS === 'android' ? KCKeyboardAvoidingView : RNKeyboardAvoidingView;

export { KeyboardAvoidingView };
export default KeyboardAvoidingView;
