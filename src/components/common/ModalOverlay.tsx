import React from 'react'

type ModalOverlayProps = {
  zIndex?: number
  onClickClose?: () => void
  children?: React.ReactNode
}

export function ModalOverlay({ zIndex = 65, onClickClose, children }: ModalOverlayProps) {
  const onOuterClick = () => {
    if (onClickClose) onClickClose()
  }
  const onInnerClick: React.MouseEventHandler<HTMLDivElement> = (e) => {
    e.stopPropagation()
  }
  return (
    <div
      style={{ zIndex }}
      className="fixed inset-0 pointer-events-auto"
      onClick={onOuterClick}
    >
      {/* 遮罩层覆盖 app 主容器（max-w-sm mx-auto） */}
      <div className="w-full max-w-sm mx-auto h-full bg-black/50" onClick={onInnerClick}>
        {children}
      </div>
    </div>
  )
}

