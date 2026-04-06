import React from 'react';
import { ChevronRight } from 'lucide-react';

interface NutritionItemCardProps {
  id: string;
  name: string;
  description: string;
  dosage: string;
  icon: string;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

export const NutritionItemCard: React.FC<NutritionItemCardProps> = ({
  id,
  name,
  description,
  dosage,
  icon,
  isSelected,
  onToggle
}) => {
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm relative">
      <div className="flex items-stretch">
        <button
          onClick={() => onToggle(id)}
          className={`absolute top-3 left-3 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            isSelected
              ? 'bg-yellow-400 border-yellow-400'
              : 'border-gray-300 bg-white'
          }`}
        >
          {isSelected && (
            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          )}
        </button>

        <div className="w-32 flex-shrink-0 overflow-hidden">
          <img src={icon} alt={name} className="w-full h-full object-cover" />
        </div>

        <div className="flex-1 p-3 flex flex-col">
          <div className="flex items-start justify-between mb-2">
            <h4 className="text-base font-semibold text-gray-800 flex-1">{name}</h4>
            <button className="text-gray-400 flex items-center ml-2">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          <p className="text-xs text-gray-600 mb-3 leading-relaxed line-clamp-2">{description}</p>

          <div className="flex items-end justify-end mt-auto">
            <span className="text-xs text-gray-600">{dosage}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
















