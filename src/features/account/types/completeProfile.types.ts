import { TextInput } from 'react-native';
import {
  BodyFormValues,
  PersonalFormValues,
} from '../utils/profileSetup.validation';
import { useTheme } from '../../../hooks/useTheme';

export interface FieldProps {
  label: string;
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  onBlur: () => void;
  error?: string;
  keyboardType?: React.ComponentProps<typeof TextInput>['keyboardType'];
  returnKeyType?: React.ComponentProps<typeof TextInput>['returnKeyType'];
  onSubmitEditing?: () => void;
  inputRef?: React.RefObject<TextInput>;
  hint?: string;
}

export interface StepperProps {
  label: string;
  unit: string;
  value: number | undefined;
  onChange: (v: number) => void;
  error?: string;
  min: number;
  max: number;
  step?: number;
}

export interface DateFieldProps {
  value: string;
  onChange: (v: string) => void;
  error?: string;
}

export interface PickerSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: string[];
  selected: string;
  onSelect: (v: string) => void;
}

export interface Step1Props {
  onNext: (v: PersonalFormValues) => void;
  colors: ReturnType<typeof useTheme>['colors'];
}

export interface Step2Props {
  onSubmit: (v: BodyFormValues) => void;
  loading: boolean;
  colors: ReturnType<typeof useTheme>['colors'];
}
