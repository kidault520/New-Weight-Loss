import React from 'react'

type BottomActionBarProps = {
  visible?: boolean
  primaryText?: string
  onPrimaryClick?: () => void
  extra?: React.ReactNode
  buttonClassName?: string
  containerClassName?: string
  disabled?: boolean
}

export function BottomActionBar({ 
  visible = true, 
  primaryText = '确认', 
  onPrimaryClick, 
  extra,
  buttonClassName = 'flex-1 rounded-lg bg-blue-600 px-4 py-3 text-center text-white',
  containerClassName = 'mx-4 mb-4 rounded-xl bg-white/95 p-3 shadow-lg backdrop-blur',
  disabled = false
}: BottomActionBarProps) {
  if (!visible) return null
  return (
    <div className="pointer-events-auto fixed inset-x-0 bottom-0 z-20">
      <div className="w-full max-w-sm mx-auto">
        <div className={containerClassName} style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <div className="flex flex-col gap-3">
            {extra}
            <button
              type="button"
              className={buttonClassName}
              onClick={disabled ? undefined : onPrimaryClick}
              disabled={disabled}
            >
              {primaryText}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

