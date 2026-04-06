import { supabase } from '../config/supabase';
import { toLocalDateString } from '../utils/dateUtils';

export interface UserPackage {
  id: string;
  user_id: string;
  package_duration: number;
  included_meals: string[];
  package_name: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MockPackageData {
  package_duration: number;
  included_meals: string[];
  package_name: string;
  start_date: Date;
  end_date: Date;
}

const MOCK_PACKAGES: Record<string, MockPackageData> = {
  '14-day-full': {
    package_duration: 14,
    included_meals: ['lunch', 'dinner'],
    package_name: '我的14天营养方案',
    start_date: new Date(),
    end_date: new Date(Date.now() + 13 * 24 * 60 * 60 * 1000),
  },
  '21-day-full': {
    package_duration: 21,
    included_meals: ['lunch', 'dinner'],
    package_name: '我的21天营养方案',
    start_date: new Date(),
    end_date: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  },
  '31-day-full': {
    package_duration: 31,
    included_meals: ['lunch', 'dinner'],
    package_name: '我的31天营养方案',
    start_date: new Date(),
    end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  },
};

const DEFAULT_MOCK_PACKAGE = MOCK_PACKAGES['21-day-full'];

export async function getUserActivePackage(userId?: string): Promise<UserPackage | null> {
  try {
    if (!userId) {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        console.log('No authenticated user, returning null');
        return null;
      }
      userId = user.id;
    }

    const { data, error } = await supabase
      .from('user_packages')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .maybeSingle();

    if (error) {
      console.error('Error fetching user package:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in getUserActivePackage:', error);
    return null;
  }
}

export function getMockPackage(packageType: string = '31-day-full'): MockPackageData {
  return MOCK_PACKAGES[packageType] || DEFAULT_MOCK_PACKAGE;
}

export function getDefaultMockPackage(): MockPackageData {
  return DEFAULT_MOCK_PACKAGE;
}

export async function createUserPackage(
  userId: string,
  packageData: {
    package_duration: number;
    included_meals: string[];
    package_name?: string;
    start_date?: Date;
  }
): Promise<UserPackage | null> {
  try {
    const startDate = packageData.start_date || new Date();
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + packageData.package_duration - 1);

    const packageName = packageData.package_name || `我的${packageData.package_duration}天营养方案`;

    await supabase
      .from('user_packages')
      .update({ is_active: false })
      .eq('user_id', userId)
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('user_packages')
      .insert({
        user_id: userId,
        package_duration: packageData.package_duration,
        included_meals: packageData.included_meals,
        package_name: packageName,
        start_date: toLocalDateString(startDate),
        end_date: toLocalDateString(endDate),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating user package:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in createUserPackage:', error);
    return null;
  }
}

export async function updateUserPackage(
  packageId: string,
  updates: Partial<{
    package_duration: number;
    included_meals: string[];
    package_name: string;
    start_date: string;
    end_date: string;
    is_active: boolean;
  }>
): Promise<UserPackage | null> {
  try {
    const { data, error } = await supabase
      .from('user_packages')
      .update(updates)
      .eq('id', packageId)
      .select()
      .single();

    if (error) {
      console.error('Error updating user package:', error);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error in updateUserPackage:', error);
    return null;
  }
}

export function getPackageSupplementName(_duration: number): string {
  return `我的补剂方案`;
}

export function getPackageMealPlanName(_duration: number): string {
  return `我的餐食方案`;
}

export function calculatePackageDates(
  startDate: Date,
  duration: number
): { dates: Date[]; currentMonthDays: number; nextMonthDays: number; nextMonthFullDays: number; actualStartDate: Date } {
  void startDate;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const todayDayOfWeek = today.getDay();
  const actualStartDate = new Date(today);

  if (todayDayOfWeek === 1) {
    actualStartDate.setDate(today.getDate() + 1);
  } else if (todayDayOfWeek === 0) {
    actualStartDate.setDate(today.getDate() + 1);
  } else {
    const daysUntilNextMonday = (8 - todayDayOfWeek) % 7;
    actualStartDate.setDate(today.getDate() + (daysUntilNextMonday === 0 ? 1 : daysUntilNextMonday));
  }

  const dates: Date[] = [];
  const currentMonth = actualStartDate.getMonth();
  const currentYear = actualStartDate.getFullYear();

  const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const currentMonthDays = lastDayOfMonth - actualStartDate.getDate() + 1;

  const nextMonthDays = Math.max(0, duration - currentMonthDays);

  for (let i = 0; i < duration; i++) {
    const date = new Date(actualStartDate);
    date.setDate(actualStartDate.getDate() + i);
    dates.push(date);
  }

  const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
  const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
  const nextMonthFullDays = new Date(nextYear, nextMonth + 1, 0).getDate();

  return {
    dates,
    currentMonthDays: Math.min(currentMonthDays, duration),
    nextMonthDays,
    nextMonthFullDays,
    actualStartDate,
  };
}

export interface MockOrderDetails {
  id: string;
  package_name: string;
  package_duration: number;
  included_meals: string[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  supplements_included: boolean;
  meals_included: boolean;
}

export function generateMockOrders(): MockOrderDetails[] {
  const today = new Date();

  const order1StartDate = new Date(today);
  order1StartDate.setDate(today.getDate() - 10);
  const order1EndDate = new Date(order1StartDate);
  order1EndDate.setDate(order1StartDate.getDate() + 20);

  const order2StartDate = new Date(today);
  order2StartDate.setDate(today.getDate() - 45);
  const order2EndDate = new Date(order2StartDate);
  order2EndDate.setDate(order2StartDate.getDate() + 13);

  const order3StartDate = new Date(today);
  order3StartDate.setDate(today.getDate() + 5);
  const order3EndDate = new Date(order3StartDate);
  order3EndDate.setDate(order3StartDate.getDate() + 30);

  return [
    {
      id: 'mock-order-1',
      package_name: '瑞丹维：21天减脂方案',
      package_duration: 21,
      included_meals: ['lunch', 'dinner'],
      start_date: toLocalDateString(order1StartDate),
      end_date: toLocalDateString(order1EndDate),
      is_active: true,
      created_at: new Date(order1StartDate.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      supplements_included: true,
      meals_included: true,
    },
    {
      id: 'mock-order-2',
      package_name: '瑞丹维：14天塑形方案',
      package_duration: 14,
      included_meals: ['lunch', 'dinner'],
      start_date: toLocalDateString(order2StartDate),
      end_date: toLocalDateString(order2EndDate),
      is_active: false,
      created_at: new Date(order2StartDate.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString(),
      supplements_included: true,
      meals_included: true,
    },
    {
      id: 'mock-order-3',
      package_name: '瑞丹维：31天健康管理方案',
      package_duration: 31,
      included_meals: ['breakfast', 'lunch', 'dinner'],
      start_date: toLocalDateString(order3StartDate),
      end_date: toLocalDateString(order3EndDate),
      is_active: true,
      created_at: today.toISOString(),
      supplements_included: true,
      meals_included: true,
    },
  ];
}
