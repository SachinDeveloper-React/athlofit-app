import { createMMKV } from 'react-native-mmkv';

export const mmkv = createMMKV({
  id: 'athlofit.storage',
});

export const mmkvStorage = {
  setItem: (name: string, value: string) => {
    mmkv.set(name, value);
  },
  getItem: (name: string) => {
    const v = mmkv.getString(name);
    return v ?? null;
  },
  removeItem: (name: string) => {
    mmkv.remove(name);
  },
};
