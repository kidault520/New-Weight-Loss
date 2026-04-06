import React from 'react'
import { ModalOverlay } from './ModalOverlay'

type ConfirmModalProps = {
  show: boolean
  title: string
  message?: string | React.ReactNode
  onCancel: () => void
  onConfirm: () => void
  cancelText?: string
  confirmText?: string
  confirmColor?: 'red' | 'blue' | 'green' | 'gray'
  zIndex?: number
}

export function ConfirmModal({ 
  show, 
  title, 
  message, 
  onCancel, 
  onConfirm,
  cancelText = '取消',
  confirmText = '删除',
  confirmColor = 'red',
  zIndex = 80
}: ConfirmModalProps) {
  if (!show) return null

  const confirmColorClasses = {
    red: 'text-red-600 hover:bg-red-50',
    blue: 'text-blue-600 hover:bg-blue-50',
    green: 'text-green-600 hover:bg-green-50',
    gray: 'text-gray-600 hover:bg-gray-50'
  }

  const confirmBgClasses = {
    red: 'bg-red-500 hover:bg-red-600 text-white',
    blue: 'bg-blue-500 hover:bg-blue-600 text-white',
    green: 'bg-green-500 hover:bg-green-600 text-white',
    gray: 'bg-gray-500 hover:bg-gray-600 text-white'
  }

  const isMessageString = typeof message === 'string'
  // 遮罩层级应该比弹窗低一层
  const overlayZIndex = zIndex - 1

  return (
    <>
      <ModalOverlay onClickClose={onCancel} zIndex={overlayZIndex} />
      <div 
        className="fixed inset-0 flex items-center justify-center pointer-events-none" 
        style={{ zIndex }}
      >
        <div className="w-full max-w-sm mx-auto px-4 pointer-events-auto">
          <div 
            className="bg-white rounded-2xl shadow-2xl w-full overflow-hidden" 
            onClick={e => e.stopPropagation()}
          >
          <div className="p-6">
            <div className="text-lg font-semibold text-gray-900 mb-2">{title}</div>
            {message && (
              isMessageString ? (
                <p className="text-gray-600 text-sm mb-4">{message}</p>
              ) : (
                <div className="text-gray-600 text-sm mb-4">{message}</div>
              )
            )}
          </div>
          <div className="flex border-t border-gray-200">
            <button 
              onClick={onCancel} 
              className="flex-1 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {cancelText}
            </button>
            <button 
              onClick={onConfirm} 
              className={`flex-1 py-3.5 text-sm font-medium border-l border-gray-200 ${
                confirmColor === 'red' 
                  ? confirmBgClasses.red 
                  : confirmColorClasses[confirmColor]
              }`}
            >
              {confirmText}
            </button>
          </div>
        </div>
        </div>
      </div>
    </>
  )
}

