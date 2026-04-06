import { Pill, Calendar, Clock, AlertCircle } from 'lucide-react'
import { StatusBadge } from '../common/StatusBadge'
import { formatDate } from '../../utils/dateFormatters'

interface CustomSupplement {
  id: string
  supplement_name: string
  supplement_type: string
  dosage: string
  frequency: string
  start_date: string
  end_date: string | null
  status: string
  instructions: string
  icon_path: string
}

interface SupplementCardProps {
  supplement: CustomSupplement
  isActive: boolean
  onPause?: () => void
  onRenew?: () => void
  getSupplementGradient: (type: string) => string
  getSupplementTypeColor: (type: string) => string
  getSupplementTypeLabel: (type: string) => string
  getStatusBadgeType: (status: string) => 'active' | 'completed' | 'paused'
}

export function SupplementCard({
  supplement,
  isActive,
  onPause,
  onRenew,
  getSupplementGradient,
  getSupplementTypeColor,
  getSupplementTypeLabel,
  getStatusBadgeType
}: SupplementCardProps) {
  return (
    <div className="relative bg-white rounded-3xl overflow-hidden pb-6 shadow-lg border-2 border-gray-100">
      {/* 1px spacing at top */}
      <div className="h-px bg-gray-100"></div>
      {/* Gradient Header */}
      <div
        className={`bg-gradient-to-br ${isActive ? getSupplementGradient(supplement.supplement_type) : 'from-gray-200 to-gray-300'} pt-8 px-6 pb-6 relative`}
        style={{ minHeight: '280px' }}
      >
        {/* Decorative Circle */}
        <div className="absolute top-6 right-6">
          <div className="w-24 h-32 bg-white/30 rounded-full shadow-lg transform rotate-12"></div>
        </div>

        {/* Icon Display */}
        <div className="absolute top-8 right-8">
          <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center shadow-md">
            <img
              src={supplement.icon_path}
              alt={supplement.supplement_name}
              className={`w-14 h-16 object-contain ${!isActive ? 'opacity-50' : ''}`}
              onError={(e) => {
                e.currentTarget.style.display = 'none'
                const parent = e.currentTarget.parentElement
                if (parent) {
                  parent.innerHTML = `<div class="w-10 h-10 ${isActive ? 'text-gray-600' : 'text-gray-400'}"><svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="2"></rect><line x1="9" y1="9" x2="15" y2="15"></line><line x1="15" y1="9" x2="9" y2="15"></line></svg></div>`
                }
              }}
            />
          </div>
        </div>

        {/* Supplement Info in Gradient Area */}
        <div className="relative z-10">
          <p className="text-sm text-gray-800 mb-3">{supplement.frequency}</p>
          <h3 className="text-3xl font-bold text-gray-900 mb-4">{supplement.supplement_name}</h3>

          <div className="flex items-center space-x-2 mb-4">
            <span className={`text-xs px-2 py-1 rounded-full ${getSupplementTypeColor(supplement.supplement_type)}`}>
              {getSupplementTypeLabel(supplement.supplement_type)}
            </span>
            <StatusBadge status={getStatusBadgeType(supplement.status)} className="px-3 py-1.5 rounded-lg" />
          </div>

          <div className="space-y-2 text-gray-800">
            <div className="flex items-center space-x-2 text-sm">
              <Pill className="w-4 h-4" />
              <span className="font-medium">用量：{supplement.dosage}</span>
            </div>
            <div className="flex items-center space-x-2 text-sm">
              <Clock className="w-4 h-4" />
              <span className="font-medium">频率：{supplement.frequency}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-200 mx-6"></div>

      {/* Details Section */}
      <div className="px-6 pt-6 pb-4">
        <h4 className="text-lg font-semibold text-gray-900 mb-4">补剂详情</h4>

        {supplement.instructions && (
          <div className="bg-blue-50 rounded-xl p-3 mb-4">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-gray-700 leading-relaxed">{supplement.instructions}</p>
            </div>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <Calendar className="w-4 h-4" />
              <span>开始时间</span>
            </div>
            <span className="text-sm font-medium text-gray-900">{formatDate(supplement.start_date)}</span>
          </div>
          {supplement.end_date && (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <Calendar className="w-4 h-4" />
                <span>结束时间</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{formatDate(supplement.end_date)}</span>
            </div>
          )}
        </div>

        {isActive && (
          <div className="flex space-x-3 mt-4">
            <button 
              onClick={onPause}
              className="flex-1 py-2.5 rounded-xl border-2 border-gray-900 text-gray-900 text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              暂停使用
            </button>
            <button 
              onClick={onRenew}
              className="flex-1 py-2.5 rounded-xl bg-purple-300 text-purple-800 text-sm font-semibold hover:bg-purple-400 transition-colors"
            >
              续订
            </button>
          </div>
        )}

        <button className="text-sm text-gray-500 hover:text-gray-700 transition-colors flex items-center mt-4">
          了解补剂详情和参考文献
          <span className="ml-1">›</span>
        </button>
      </div>
    </div>
  )
}














