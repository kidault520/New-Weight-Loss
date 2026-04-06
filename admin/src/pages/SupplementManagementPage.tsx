import { useState } from 'react';
import { Pill, Package } from 'lucide-react';
import SupplementManagement from '../components/content/SupplementManagement';
import SupplementCourseManagement from '../components/supplements/SupplementCourseManagement';

type TabType = 'supplements' | 'packages';

export default function SupplementManagementPage() {
  const [activeTab, setActiveTab] = useState<TabType>('supplements');

  const tabs = [
    { id: 'supplements' as TabType, label: '补剂产品', icon: Pill },
    { id: 'packages' as TabType, label: '补剂疗程', icon: Package },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">补剂管理</h1>

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
          {activeTab === 'supplements' && <SupplementManagement />}
          {activeTab === 'packages' && <SupplementCourseManagement />}
        </div>
      </div>
    </div>
  );
}
