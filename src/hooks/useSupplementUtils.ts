export function useSupplementUtils() {
  const getSupplementTypeColor = (type: string) => {
    const colors: { [key: string]: string } = {
      vitamin: 'bg-yellow-100 text-yellow-700',
      mineral: 'bg-blue-100 text-blue-700',
      protein: 'bg-purple-100 text-purple-700',
      herbal: 'bg-green-100 text-green-700',
      general: 'bg-gray-100 text-gray-700'
    }
    return colors[type] || colors.general
  }

  const getSupplementTypeLabel = (type: string) => {
    const labels: { [key: string]: string } = {
      vitamin: '维生素',
      mineral: '矿物质',
      protein: '蛋白质',
      herbal: '草本',
      general: '综合'
    }
    return labels[type] || '综合'
  }

  const getSupplementGradient = (type: string) => {
    const gradients: { [key: string]: string } = {
      vitamin: 'from-yellow-200 to-yellow-300',
      mineral: 'from-blue-200 to-blue-300',
      protein: 'from-purple-200 to-purple-300',
      herbal: 'from-green-200 to-green-300',
      general: 'from-gray-200 to-gray-300'
    }
    return gradients[type] || gradients.general
  }

  const getStatusBadgeType = (status: string): 'active' | 'completed' | 'paused' | 'pending' => {
    if (status === 'active') return 'active'
    if (status === 'completed') return 'completed'
    if (status === 'pending') return 'pending'
    if (status === 'paused') return 'paused'
    return 'active'
  }

  return {
    getSupplementTypeColor,
    getSupplementTypeLabel,
    getSupplementGradient,
    getStatusBadgeType
  }
}














