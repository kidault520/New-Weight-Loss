import { ModalOverlay } from '../../components/common/ModalOverlay'
import { DragPanel } from '../../components/common/DragPanel'

type Mode = 'day' | 'week' | 'month'

type DatePickerModalProps = {
  value: Date
  onChange: (d: Date) => void
  onClose: () => void
  mode?: Mode
  show: boolean
}

export function DatePickerModal({ value: _value, onChange, onClose, mode = 'day', show }: DatePickerModalProps) {
  void _value;
  const onMaskClose = () => onClose()
  const onSelect = (d: Date) => {
    onChange(d)
    onClose()
  }
  const days = Array.from({ length: 31 }).map((_, i) => i + 1)
  const weeks = Array.from({ length: 52 }).map((_, i) => i + 1)
  const months = Array.from({ length: 12 }).map((_, i) => i + 1)
  const items = mode === 'day' ? days : mode === 'week' ? weeks : months
  return (
    <>
      {show && (
        <ModalOverlay onClickClose={onMaskClose} />
      )}
      <DragPanel
        show={show}
        onClose={onClose}
        zIndex={70}
        mask={{ visible: false }}
        header={<div className="px-4 py-2 text-center text-sm text-gray-600">选择日期</div>}
      >
        <div className="px-4 py-3">
          <div className="grid grid-cols-6 gap-2">
            {items.map((n) => (
              <button
                key={n}
                type="button"
                className="rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700"
                onClick={() => onSelect(new Date())}
              >
                {n}
              </button>
            ))}
          </div>
        </div>
      </DragPanel>
    </>
  )
}

