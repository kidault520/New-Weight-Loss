import { useCallback, useEffect, useState } from 'react';
import { getUserStorageItem, setUserStorageItem } from '../utils/userStorage';

export function useMealAddressesMapping() {
  const [mealAddresses, setMealAddressesState] = useState<Record<string, string>>({});

  const refreshMealAddresses = useCallback(async () => {
    const saved = await getUserStorageItem<Record<string, string>>('mealAddresses');
    setMealAddressesState(saved || {});
    return saved || {};
  }, []);

  const saveMealAddresses = useCallback(async (next: Record<string, string>) => {
    setMealAddressesState(next);
    await setUserStorageItem('mealAddresses', next);
  }, []);

  const setMealAddress = useCallback(
    async (mealKey: string, addressId: string) => {
      const next = { ...mealAddresses, [mealKey]: addressId };
      await saveMealAddresses(next);
      return next;
    },
    [mealAddresses, saveMealAddresses]
  );

  useEffect(() => {
    refreshMealAddresses().catch(console.error);
  }, [refreshMealAddresses]);

  return {
    mealAddresses,
    refreshMealAddresses,
    saveMealAddresses,
    setMealAddress,
  };
}

