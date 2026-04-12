// src/features/account/hooks/useUnitSystem.ts
import { useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuthStore } from '../../auth/store/authStore';
import { accountService } from '../service/accountService';
import {
  UnitSystem,
  formatWeight,
  formatHeight,
  formatWeightValue,
  formatWeightUnit,
  formatHeightValue,
  formatHeightUnit,
  heightToCm,
  weightToKg,
} from '../../../utils/unitConverter';

export const useUnitSystem = () => {
  const user = useAuthStore(s => s.user);
  const updateUser = useAuthStore(s => s.updateUser);

  const unitSystem: UnitSystem = (user?.unitSystem as UnitSystem) ?? 'metric';
  const isMetric = unitSystem === 'metric';
  const isImperial = unitSystem === 'imperial';

  const { mutate: switchUnit, isPending } = useMutation({
    mutationFn: (system: UnitSystem) =>
      accountService.updateProfile({ unitSystem: system }),
    onSuccess: (_, system) => {
      updateUser({ unitSystem: system });
    },
  });

  return {
    unitSystem,
    isMetric,
    isImperial,
    isPending,
    switchUnit,
    formatWeight: useCallback((kg: number) => formatWeight(kg, unitSystem), [unitSystem]),
    formatHeight: useCallback((cm: number) => formatHeight(cm, unitSystem), [unitSystem]),
    formatWeightValue: useCallback((kg: number) => formatWeightValue(kg, unitSystem), [unitSystem]),
    formatWeightUnit: () => formatWeightUnit(unitSystem),
    formatHeightValue: useCallback((cm: number) => formatHeightValue(cm, unitSystem), [unitSystem]),
    formatHeightUnit: () => formatHeightUnit(unitSystem),
    heightToCm: useCallback((v: number) => heightToCm(v, unitSystem), [unitSystem]),
    weightToKg: useCallback((v: number) => weightToKg(v, unitSystem), [unitSystem]),
  };
};
