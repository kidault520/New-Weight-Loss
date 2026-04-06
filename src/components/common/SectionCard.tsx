import React from 'react'

type SectionCardProps = {
  className?: string
  children?: React.ReactNode
}

export function SectionCard({ className = '', children }: SectionCardProps) {
  return (
    <div className={`bg-white rounded-2xl p-4 shadow-md border border-gray-200 my-2 ${className}`}>
      {children}
    </div>
  )
}
