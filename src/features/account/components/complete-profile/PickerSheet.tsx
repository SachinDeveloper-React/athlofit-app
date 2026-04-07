import {
  FlatList,
  Modal,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { AppView, AppText } from '../../../../components';
import { useTheme } from '../../../../hooks/useTheme';
import { PickerSheetProps } from '../../types/completeProfile.types';

export const PickerSheet: React.FC<PickerSheetProps> = ({
  visible,
  onClose,
  title,
  options,
  selected,
  onSelect,
}) => {
  const { colors } = useTheme();

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={pk.backdrop}
        activeOpacity={1}
        onPress={onClose}
      />
      <AppView
        style={[
          pk.sheet,
          { backgroundColor: colors.card, borderTopColor: colors.border },
        ]}
      >
        <AppView style={pk.handle} />
        <AppText style={[pk.title, { color: colors.foreground }]}>{title}</AppText>
        <FlatList
          data={options}
          keyExtractor={i => i}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[pk.item, { borderBottomColor: colors.border }]}
              onPress={() => {
                onSelect(item);
                onClose();
              }}
            >
              <AppText style={[pk.itemText, { color: colors.foreground }]}>
                {item}
              </AppText>
              {selected === item && (
                <AppText style={[pk.checkmark, { color: colors.primary }]}>✓</AppText>
              )}
            </TouchableOpacity>
          )}
        />
      </AppView>
    </Modal>
  );
};

const pk = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sheet: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingBottom: 40,
    maxHeight: '60%',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#ccc',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
    paddingVertical: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  itemText: { flex: 1, fontSize: 17 },
  checkmark: { fontSize: 18, fontWeight: '700' },
});
