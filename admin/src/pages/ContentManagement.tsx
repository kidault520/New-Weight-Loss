import { useState } from 'react';
import { FileText, Utensils, Apple, Activity } from 'lucide-react';
import TemplateEditor from '../components/content/TemplateEditor';
import NutritionSolutionEditor from '../components/content/NutritionSolutionEditor';
import FoodLibraryManagement from '../components/content/FoodLibraryManagement';
import ExerciseLibraryManagement from '../components/content/ExerciseLibraryManagement';

type TabType = 'nutrition' | 'templates' | 'food-library' | 'exercise-library';

export default function ContentManagement() {
  const [activeTab, setActiveTab] = useState<TabType>('nutrition');

  const tabs = [
    { id: 'nutrition' as TabType, label: '营养方案', icon: Utensils },
    { id: 'templates' as TabType, label: '内容模板', icon: FileText },
    { id: 'food-library' as TabType, label: '食物库管理', icon: Apple },
    { id: 'exercise-library' as TabType, label: '运动库管理', icon: Activity },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">内容管理</h1>

      <div className="bg-white rounded-lg shadow border border-gray-200">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                    activeTab === tab.id
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

        <div className="p-6">
          {activeTab === 'nutrition' && <NutritionSolutionEditor />}
          {activeTab === 'templates' && <TemplateEditor />}
          {activeTab === 'food-library' && <FoodLibraryManagement />}
          {activeTab === 'exercise-library' && <ExerciseLibraryManagement />}
        </div>
      </div>
    </div>
  );
}






