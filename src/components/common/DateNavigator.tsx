import React from 'react'

type Props = {
  label: React.ReactNode
  onPrev: () => void
  onNext: () => void
  className?: string
  disablePrev?: boolean
  disableNext?: boolean
}

export function DateNavigator({ label, onPrev, onNext, className = '', disablePrev = false, disableNext = false }: Props) {
  return (
    <div className={`flex items-center justify-center space-x-4 ${className}`}>
      <button 
        className="p-1" 
        onClick={onPrev}
        disabled={disablePrev}
      >
        <svg viewBox="0 0 24 24" className={`w-5 h-5 ${disablePrev ? 'text-gray-300' : 'text-gray-600'}`}>
          <path fill="currentColor" d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
        </svg>
      </button>
      <span className="text-sm text-gray-800 font-medium">{label}</span>
      <button 
        className="p-1" 
        onClick={onNext}
        disabled={disableNext}
      >
        <svg viewBox="0 0 24 24" className={`w-5 h-5 ${disableNext ? 'text-gray-300' : 'text-gray-600'}`}>
          <path fill="currentColor" d="M8.59 16.59L10 18l6-6-6-6-1.41 1.41L12.17 12z"/>
        </svg>
      </button>
    </div>
  )
}

