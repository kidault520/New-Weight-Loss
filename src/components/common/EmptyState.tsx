import React from 'react'

type Props = {
  icon?: React.ReactNode
  title?: string
  description?: string
  className?: string
}

export function EmptyState({ icon, title, description, className = '' }: Props) {
  return (
    <div className={`flex flex-col items-center justify-center py-12 ${className}`}>
      <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center mb-4">
        {icon}
      </div>
      {title && <p className="text-gray-700 text-sm font-medium mb-1">{title}</p>}
      {description && <p className="text-gray-500 text-sm">{description}</p>}
    </div>
  )
}

