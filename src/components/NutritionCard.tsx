import React, { useEffect, useState } from 'react';
import { nutritionSyncService } from '../services/nutritionSyncService';

const NutritionCard: React.FC = () => {
  const [nutritionData, setNutritionData] = useState({
    protein: 0,
    carbs: 0,
    fat: 0
  });

  const [goals, setGoals] = useState({
    protein: 120,
    carbs: 178,
    fat: 109
  });

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadNutritionData();
  }, []);

  const loadNutritionData = async () => {
    try {
      setLoading(true);

      // Load daily totals and goals in parallel
      const [totals, nutritionGoals] = await Promise.all([
        nutritionSyncService.getDailyNutritionTotals(),
        nutritionSyncService.getNutritionGoals()
      ]);

      setNutritionData({
        protein: totals.totalProtein,
        carbs: totals.totalCarbs,
        fat: totals.totalFat
      });

      setGoals(nutritionGoals);
    } catch (error) {
      console.error('Failed to load nutrition data:', error);
    } finally {
      setLoading(false);
    }
  };

  const nutrients = [
    {
      name: '碳水',
      value: nutritionData.carbs,
      total: goals.carbs,
      dotColor: 'bg-yellow-400',
      barColor: 'bg-yellow-400'
    },
    {
      name: '蛋白质',
      value: nutritionData.protein,
      total: goals.protein,
      dotColor: 'bg-red-400',
      barColor: 'bg-red-400'
    },
    {
      name: '脂肪',
      value: nutritionData.fat,
      total: goals.fat,
      dotColor: 'bg-blue-400',
      barColor: 'bg-blue-400'
    },
  ];

  return (
    <div className="bg-white/60 rounded-2xl p-6">
      <div className="flex justify-between items-center mb-4">
        <div className="text-lg font-medium text-gray-700">营养素</div>
        {!loading && (
          <button
            onClick={loadNutritionData}
            className="text-xs text-purple-600 hover:text-purple-700"
          >
            刷新
          </button>
        )}
      </div>

      <div className="space-y-4">
        {nutrients.map((nutrient, index) => (
          <div key={index}>
            <div className="flex justify-between items-center mb-2">
              <div className="flex items-center space-x-2">
                <div className={`w-2 h-2 rounded-full ${nutrient.dotColor}`}></div>
                <span className="text-sm text-gray-600">{nutrient.name}</span>
              </div>
              <div className="text-right">
                <span className="text-lg font-bold text-gray-800">
                  {loading ? '...' : nutrient.value}
                </span>
                <span className="text-xs text-gray-400">/{nutrient.total}g</span>
              </div>
            </div>
            {/* Individual progress bar for each nutrient */}
            <div className="w-full bg-gray-200 rounded-full h-1.5">
              <div
                className={`h-1.5 rounded-full ${nutrient.barColor} transition-all duration-300`}
                style={{ width: `${Math.min((nutrient.value / nutrient.total) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NutritionCard;