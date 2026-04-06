type StatusType = 
  | 'active'           // 使用中
  | 'pending'          // 待开启
  | 'expired'          // 已过期
  | 'completed'        // 已完成
  | 'in-progress'      // 进行中
  | 'not-started'      // 未开始
  | 'preparing'        // 准备中
  | 'making'           // 制作中
  | 'delivering'       // 配送中
  | 'delivered'        // 已配送完成
  | 'paused'           // 已暂停

type StatusBadgeProps = {
  status: StatusType
  className?: string
}

const statusConfig: Record<StatusType, { label: string; bg: string; text: string; border?: string }> = {
  'active': {
    label: '使用中',
    bg: 'bg-purple-100',
    text: 'text-gray-700',
    border: 'border-purple-200'
  },
  'pending': {
    label: '待开启',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200'
  },
  'expired': {
    label: '已过期',
    bg: 'bg-gray-100',
    text: 'text-gray-500'
  },
  'completed': {
    label: '已完成',
    bg: 'bg-green-100',
    text: 'text-green-600',
    border: 'border-green-200'
  },
  'in-progress': {
    label: '进行中',
    bg: 'bg-blue-100',
    text: 'text-blue-600',
    border: 'border-blue-200'
  },
  'not-started': {
    label: '未开始',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200'
  },
  'preparing': {
    label: '准备中',
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200'
  },
  'making': {
    label: '制作中',
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    border: 'border-purple-200'
  },
  'delivering': {
    label: '配送中',
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    border: 'border-purple-200'
  },
  'delivered': {
    label: '已配送完成',
    bg: 'bg-purple-100',
    text: 'text-purple-600',
    border: 'border-purple-200'
  },
  'paused': {
    label: '已暂停',
    bg: 'bg-yellow-100',
    text: 'text-yellow-700',
    border: 'border-yellow-200'
  }
}

export function StatusBadge({ status, className = '' }: StatusBadgeProps) {
  const config = statusConfig[status]
  
  return (
    <span className={`${config.bg} ${config.text} ${config.border ? `border ${config.border}` : ''} px-2 py-1 rounded-full text-xs font-medium backdrop-blur-sm ${className}`}>
      {config.label}
    </span>
  )
}














