import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useCallback } from 'react'
import { APP_HEADER_HEIGHT_CSS, FULL_PANEL_HEIGHT_MINUS_HEADER_CSS } from '../../constants/appLayout'

type MaskProps = {
  visible?: boolean
  clickable?: boolean
  zIndex?: number
}

type DragPanelProps = {
  zIndex?: number
  animationDuration?: number
  onClose: () => void
  show: boolean
  header?: React.ReactNode
  footer?: React.ReactNode
  mask?: MaskProps
  children?: React.ReactNode
  maxHeight?: string | number // 最大高度，用于非全屏弹窗
  maxWidth?: string // 最大宽度，用于居中弹窗（如 'max-w-xs', 'max-w-sm' 等）
}

export function DragPanel(props: DragPanelProps) {
  const {
    zIndex = 60,
    animationDuration = 500,
    onClose,
    show,
    header,
    footer,
    mask,
    children,
    maxHeight,
    maxWidth = 'max-w-sm', // 默认值
  } = props

  const [closing, setClosing] = useState(false)
  const closingLock = useRef(false)
  const panelRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const startY = useRef<number | null>(null)
  const startX = useRef<number | null>(null)
  const currentY = useRef<number>(0)
  const dragging = useRef(false)
  const isScrolling = useRef(false)
  const prevShowRef = useRef(show)

  // 居中弹窗在重新打开时，强制清理上一次关闭过程中的锁和状态
  useEffect(() => {
    if (show) {
      closingLock.current = false
      setClosing(false)
    }
  }, [show])

  // 监听 show prop 的变化，当从 true 变为 false 时触发关闭动画
  useEffect(() => {
    if (prevShowRef.current && !show && !closing && !closingLock.current) {
      // show 从 true 变为 false，触发关闭动画，但不调用 onClose（因为父组件已经通过 show prop 控制关闭）
      closingLock.current = true
      setClosing(true)
      
      // 重置拖拽状态
      dragging.current = false
      isScrolling.current = false
      startY.current = null
      startX.current = null
      currentY.current = 0
      document.body.style.userSelect = ''
      
      if (panelRef.current) {
        if (maxHeight) {
          // 居中弹窗使用scale和opacity动画
          panelRef.current.style.transition = `transform ${animationDuration}ms ease-out, opacity ${animationDuration}ms ease-out`
          panelRef.current.style.transform = 'scale(0.95)'
          panelRef.current.style.opacity = '0'
        } else {
          // 全屏弹窗使用translateY动画
          panelRef.current.style.transition = `transform ${animationDuration}ms ease-out`
          panelRef.current.style.transform = 'translateY(100%)'
        }
      }
      
      const timeoutId = setTimeout(() => {
        closingLock.current = false
        setClosing(false)
        if (panelRef.current) {
          panelRef.current.style.transition = ''
          panelRef.current.style.willChange = ''
          panelRef.current.style.transform = maxHeight ? 'scale(1)' : 'translateY(0)'
          if (maxHeight) {
            panelRef.current.style.opacity = '1'
          }
        }
      }, animationDuration)
      
      return () => clearTimeout(timeoutId)
    }
    prevShowRef.current = show
  }, [show, closing, maxHeight, animationDuration])

  // 遮罩层比内容层低一个档位：z-60 内容 → z-55 遮罩，z-70 内容 → z-65 遮罩
  const maskZ = useMemo(() => {
    if (mask?.zIndex !== undefined) return mask.zIndex
    if (zIndex === 60) return 55
    if (zIndex === 70) return 65
    return zIndex - 5 // 默认低 5 个单位（保持向后兼容）
  }, [mask?.zIndex, zIndex])

  /** 全屏底部面板：滑入/滑出均由该状态 + CSS transition 驱动（避免子组件重绘冲掉 transform） */
  const [fsSlideIn, setFsSlideIn] = useState(false)

  // 定义 handleClose，必须在 useEffect 之前
  // 注意：onClick={handleClose} 会把 SyntheticEvent 作为首参传入，绝不能把「任意真值」当成 skipOnClose
  const handleClose = useCallback((skipOnClose?: boolean) => {
    const skip = skipOnClose === true
    if (closingLock.current) {
      return
    }
    closingLock.current = true
    setClosing(true)
    if (!maxHeight) {
      setFsSlideIn(false)
    }

    // 重置拖拽状态
    dragging.current = false
    isScrolling.current = false
    startY.current = null
    startX.current = null
    currentY.current = 0
    document.body.style.userSelect = ''
    
    // 立即调用 onClose，不要等待动画
    if (!skip) {
      try {
        onClose()
      } catch (error) {
        console.error('[DragPanel] Error in onClose callback:', error)
      }
    }
    
    if (panelRef.current) {
      if (maxHeight) {
        // 居中弹窗使用scale和opacity动画
        panelRef.current.style.transition = `transform ${animationDuration}ms ease-out, opacity ${animationDuration}ms ease-out`
        panelRef.current.style.transform = 'scale(0.95)'
        panelRef.current.style.opacity = '0'
      }
      // 全屏：关闭动画由 fsSlideIn=false + JSX transition 完成，勿再写 DOM transform，否则与 React 冲突
    }
    
    // 动画完成后重置状态
    const timeoutId = setTimeout(() => {
      closingLock.current = false
      setClosing(false)
      if (panelRef.current) {
        panelRef.current.style.transition = ''
        panelRef.current.style.willChange = ''
        if (maxHeight) {
          panelRef.current.style.transform = 'scale(1)'
          panelRef.current.style.opacity = '1'
        }
      }
    }, animationDuration)
    
    // 返回清理函数（虽然这里不会直接使用，但可以确保清理）
    return () => clearTimeout(timeoutId)
  }, [onClose, animationDuration, maxHeight])

  /** 居中弹窗：进入时自下而上 + 淡入 */
  const [centerEntered, setCenterEntered] = useState(false)
  useLayoutEffect(() => {
    if (!maxHeight) return
    if (!show) {
      setCenterEntered(false)
      return
    }
    if (closing) return
    setCenterEntered(false)
    const id0 = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCenterEntered(true))
    })
    return () => cancelAnimationFrame(id0)
  }, [show, maxHeight, closing])

  /** 全屏：打开时双帧后再 fsSlideIn，保证有过渡起点 */
  useLayoutEffect(() => {
    if (maxHeight) return
    if (!show) {
      setFsSlideIn(false)
      return
    }
    if (closing) return
    setFsSlideIn(false)
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setFsSlideIn(true))
    })
  }, [show, maxHeight, closing])

  useEffect(() => {
    const onTouchMove = (e: TouchEvent) => {
      if (!dragging.current && startY.current != null) {
        // 检查是否是滚动意图
        const sc = scrollRef.current
        if (sc && e.touches.length > 0 && startX.current != null) {
          const deltaX = Math.abs(e.touches[0].clientX - startX.current)
          const deltaY = e.touches[0].clientY - startY.current
          
          // 如果垂直移动大于水平移动，且是向下滚动，允许滚动
          if (deltaY > 0 && deltaY > deltaX) {
            isScrolling.current = true
            return // 不阻止默认滚动行为，让浏览器处理滚动
          }
          
          // 如果内容可以滚动且用户向上滚动，允许滚动
          if (deltaY < 0 && sc.scrollTop > 0) {
            isScrolling.current = true
            return
          }
          
          // 如果内容在顶部且用户向下拖拽超过一定距离，开始拖拽关闭
          if (sc.scrollTop === 0 && deltaY > 10 && deltaY > deltaX) {
            dragging.current = true
            currentY.current = 0
            if (panelRef.current) {
              panelRef.current.style.transition = ''
              panelRef.current.style.willChange = 'transform'
            }
            document.body.style.userSelect = 'none'
            if (e.cancelable) e.preventDefault()
          }
        }
        return
      }
      
      if (dragging.current) {
        if (e.cancelable) e.preventDefault()
        const y = e.touches[0].clientY
        if (startY.current == null) return
        currentY.current = Math.max(0, y - startY.current)
        if (panelRef.current) {
          panelRef.current.style.transform = `translateY(${currentY.current}px)`
        }
      }
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging.current && startY.current != null) {
        // 检查是否是滚动意图
        const sc = scrollRef.current
        if (sc && startX.current != null) {
          const deltaX = Math.abs(e.clientX - startX.current)
          const deltaY = e.clientY - startY.current
          
          // 如果垂直移动大于水平移动，且是向下滚动，允许滚动
          if (deltaY > 0 && deltaY > deltaX) {
            isScrolling.current = true
            return // 不阻止默认滚动行为
          }
          
          // 如果内容可以滚动且用户向上滚动，允许滚动
          if (deltaY < 0 && sc.scrollTop > 0) {
            isScrolling.current = true
            return
          }
          
          // 如果内容在顶部且用户向下拖拽超过一定距离，开始拖拽关闭
          if (sc.scrollTop === 0 && deltaY > 10 && deltaY > deltaX) {
            dragging.current = true
            currentY.current = 0
            if (panelRef.current) {
              panelRef.current.style.transition = ''
              panelRef.current.style.willChange = 'transform'
            }
            document.body.style.userSelect = 'none'
            e.preventDefault()
          }
        }
        return
      }
      
      if (dragging.current) {
        e.preventDefault()
        const y = e.clientY
        if (startY.current == null) return
        currentY.current = Math.max(0, y - startY.current)
        if (panelRef.current) {
          panelRef.current.style.transform = `translateY(${currentY.current}px)`
        }
      }
    }
    const onMoveEnd = () => {
      if (isScrolling.current) {
        // 如果是滚动，重置状态
        isScrolling.current = false
        startY.current = null
        startX.current = null
        return
      }
      
      if (!dragging.current) return
      dragging.current = false
      // 关闭阈值固定 100px，保证一致的拖拽体验
      const threshold = 100
      if (currentY.current > threshold) {
        // 使用最新的 handleClose 函数
        handleClose()
      } else {
        if (panelRef.current) {
          panelRef.current.style.transition = `transform 0.3s ease-out`
          panelRef.current.style.transform = `translateY(0)`
          setTimeout(() => {
            if (panelRef.current) panelRef.current.style.transition = ''
          }, 310)
        }
      }
      startY.current = null
      startX.current = null
      currentY.current = 0
      if (panelRef.current) panelRef.current.style.willChange = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('touchmove', onTouchMove, { passive: false })
    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('touchend', onMoveEnd)
    document.addEventListener('pointerup', onMoveEnd)
    return () => {
      document.removeEventListener('touchmove', onTouchMove)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('touchend', onMoveEnd)
      document.removeEventListener('pointerup', onMoveEnd)
    }
  }, [handleClose])

  const isInteractiveTarget = (el: HTMLElement | null): boolean => {
    if (!el) return false
    const interactiveTags = ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A']
    if (interactiveTags.includes(el.tagName)) return true
    const contentEditable = (el as HTMLElement).getAttribute('contenteditable')
    if (contentEditable === 'true') return true
    return false
  }

  const canStartDrag = (e: React.TouchEvent | React.PointerEvent) => {
    const target = e.target as HTMLElement
    // 检查是否点击在拖拽手柄上
    const isDragHandle = target.closest('.drag-handle')
    
    // 如果是交互元素（按钮等），且不在拖拽手柄上，不触发拖拽
    if (isInteractiveTarget(target) && !isDragHandle) return false
    
    const sc = scrollRef.current
    if (sc && sc.scrollTop > 0 && !isDragHandle) return false
    
    // 记录初始触摸点位置，用于判断滚动方向
    if ('touches' in e && e.touches.length > 0) {
      startX.current = e.touches[0].clientX
    } else if ('clientX' in e) {
      startX.current = e.clientX
    }
    
    return true
  }

  const onHandleStart = (e: React.TouchEvent | React.PointerEvent) => {
    const target = e.target as HTMLElement
    // 检查是否点击在拖拽手柄上
    const isDragHandle = target.closest('.drag-handle')
    
    // 如果是拖拽手柄，直接允许拖拽
    if (isDragHandle) {
      // 重置滚动状态
      isScrolling.current = false
      
      const isTouch = 'touches' in e
      if (isTouch) {
        const te = e as React.TouchEvent
        startY.current = te.touches[0].clientY
        startX.current = te.touches[0].clientX
      } else {
        const pe = e as React.PointerEvent
        startY.current = pe.clientY
        startX.current = pe.clientX
      }
      
      // 拖拽手柄上立即开始拖拽
      dragging.current = true
      currentY.current = 0
      if (panelRef.current) {
        panelRef.current.style.transition = ''
        panelRef.current.style.willChange = 'transform'
      }
      document.body.style.userSelect = 'none'
      return
    }
    
    // 非拖拽手柄区域，使用原有逻辑
    if (!canStartDrag(e)) return
    
    // 重置滚动状态
    isScrolling.current = false
    
    const isTouch = 'touches' in e
    if (isTouch) {
      const te = e as React.TouchEvent
      // 不preventDefault，让浏览器先处理滚动
      startY.current = te.touches[0].clientY
    } else {
      const pe = e as React.PointerEvent
      startY.current = pe.clientY
    }
    
    // 对于触摸事件，延迟判断是否是拖拽，让滚动优先
    if (isTouch) {
      // 不立即设置dragging，让浏览器先尝试滚动
      // 如果用户真的想拖拽关闭，会在move事件中检测到
    } else {
      // 对于 pointer 事件也走“位移阈值后再进入拖拽”，避免点击被过早劫持
      // 真实拖拽会在 onPointerMove 中根据 deltaY/deltaX 判定后开启
    }
  }

  // 居中弹窗（maxHeight）在 show=false 时直接卸载，避免残留遮罩阻塞页面点击
  if ((maxHeight && !show) || (!show && !closing)) return null

  return (
    <>
      {maxHeight ? (
        // 居中显示的小弹窗
        <>
          {mask?.visible && (
            <div
              style={{ 
                zIndex: maskZ,
                opacity: closing ? 0 : 1,
                transition: `opacity ${animationDuration}ms ease-out`,
                pointerEvents: closing ? 'none' : 'auto'
              }}
              className="fixed inset-0"
              onClick={mask?.clickable ? () => handleClose() : undefined}
            >
              {/* 遮罩层覆盖 app 主容器（max-w-sm mx-auto） */}
              <div className="w-full max-w-sm mx-auto h-full bg-black/50" />
            </div>
          )}
          <div 
            style={{ zIndex: zIndex + 1, pointerEvents: closing ? 'none' : 'auto' }}
            className="fixed inset-0 flex items-center justify-center px-4" 
            onClick={closing ? undefined : () => handleClose()}
          >
            <div
              ref={panelRef}
              className={`w-full ${maxWidth} flex flex-col rounded-2xl bg-gray-50 shadow-2xl pointer-events-auto relative`}
              style={{
                maxHeight: typeof maxHeight === 'string' ? maxHeight : `${maxHeight}px`,
                transform: closing
                  ? 'scale(0.95) translateY(0)'
                  : centerEntered
                    ? 'scale(1) translateY(0)'
                    : 'scale(0.98) translateY(24px)',
                opacity: closing ? 0 : centerEntered ? 1 : 0,
                transition: `transform ${animationDuration}ms ease-out, opacity ${animationDuration}ms ease-out`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
            {header}
            <div 
              ref={scrollRef} 
              className="overflow-y-auto"
              style={{ 
                maxHeight: typeof maxHeight === 'string' ? maxHeight : `${maxHeight}px`
              }}
            >
              {children}
            </div>
            {footer}
            </div>
          </div>
        </>
      ) : (
        // 底部弹出的全屏弹窗
        <>
          {mask?.visible && (
            <div
              style={{ 
                zIndex: maskZ,
                opacity: closing ? 0 : 1,
                transition: `opacity ${animationDuration}ms ease-out`,
                pointerEvents: closing ? 'none' : 'auto'
              }}
              className="fixed inset-0 bg-black/50"
              onClick={mask?.clickable ? () => handleClose() : undefined}
            />
          )}
          <div 
            style={{ zIndex }}
            className="fixed inset-0 pointer-events-none"
          >
            {/* 与 AppHeader 实测高度缝合；兜底与 constants/appLayout 一致 */}
            <div
              className="absolute left-0 right-0 max-w-sm mx-auto w-full"
              style={{
                top: APP_HEADER_HEIGHT_CSS,
                height: FULL_PANEL_HEIGHT_MINUS_HEADER_CSS,
              }}
            >
              <div
                ref={panelRef}
                className="w-full max-w-sm mx-auto flex flex-col rounded-t-2xl bg-gray-50 pointer-events-auto h-full"
                style={{
                  paddingTop: '10px',
                  paddingBottom: 'env(safe-area-inset-bottom)',
                  transform: fsSlideIn ? 'translateY(0)' : 'translateY(100%)',
                  transition: `transform ${animationDuration}ms ease-out`,
                }}
              >
                <div
                  className="drag-handle w-full select-none py-4"
                  onTouchStart={onHandleStart}
                  onPointerDown={onHandleStart}
                >
                  <div className="mx-auto h-1.5 w-10 rounded-full bg-gray-300" />
                </div>
                {header}
                <div 
                  ref={scrollRef} 
                  className="flex-1 overflow-y-auto"
                  style={{ 
                    paddingTop: '4px',
                    touchAction: 'pan-y'
                  }}
                  onTouchStart={onHandleStart}
                  onPointerDown={onHandleStart}
                >
                  {children}
                </div>
                {footer}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
