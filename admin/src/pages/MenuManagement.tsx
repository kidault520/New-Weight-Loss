import { useState } from 'react';
import { UtensilsCrossed, Package, Calendar, CalendarDays, LayoutGrid } from 'lucide-react';
import DishManagement from '../components/menu/DishManagement';
import MealPackageManagement from '../components/menu/MealPackageManagement';
import MealPlanManagement from '../components/menu/MealPlanManagement';
import MealScheduleManagement from '../components/menu/MealScheduleManagement';

type TopTab = 'bundle' | 'course';
type BundleSubTab = 'dishes' | 'mealSlots' | 'schedule';

export default function MenuManagement() {
  const [topTab, setTopTab] = useState<TopTab>('bundle');
  const [bundleSubTab, setBundleSubTab] = useState<BundleSubTab>('dishes');

  const topTabs = [
    { id: 'bundle' as TopTab, label: '套餐管理', icon: LayoutGrid },
    { id: 'course' as TopTab, label: '餐食疗程', icon: Calendar },
  ];

  const bundleSubTabs = [
    { id: 'dishes' as BundleSubTab, label: '菜品', icon: UtensilsCrossed },
    { id: 'mealSlots' as BundleSubTab, label: '餐次', icon: Package },
    { id: 'schedule' as BundleSubTab, label: '排期', icon: CalendarDays },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">餐食管理</h1>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {topTabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTopTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    topTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {topTab === 'bundle' && (
          <div className="border-b border-gray-100 bg-gray-50/80">
            <nav className="flex flex-wrap gap-1 px-4 py-2">
              {bundleSubTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBundleSubTab(tab.id)}
                    className={`flex items-center rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                      bundleSubTab === tab.id
                        ? 'bg-white text-blue-600 shadow-sm ring-1 ring-gray-200'
                        : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4 mr-1.5" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>
        )}

        <div className="p-6">
          {topTab === 'bundle' && bundleSubTab === 'dishes' && <DishManagement />}
          {topTab === 'bundle' && bundleSubTab === 'mealSlots' && <MealPackageManagement />}
          {topTab === 'course' && <MealPlanManagement />}
          {topTab === 'bundle' && bundleSubTab === 'schedule' && <MealScheduleManagement />}
        </div>
      </div>
    </div>
  );
}
