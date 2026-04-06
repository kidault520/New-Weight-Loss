type Option = { label: string; value: string }

type Props = {
  options: Option[]
  value: string
  onChange: (v: string) => void
  className?: string
}

export function PeriodSelector({ options, value, onChange, className = '' }: Props) {
  return (
    <div className={`bg-gray-200 rounded-2xl p-0.5 flex w-full ${className}`}>
      {options.map(opt => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          className={`flex-1 py-1.5 px-3 rounded-xl text-sm font-medium transition-colors ${
            value === opt.value ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-600'
          }`}
          style={{ flex: '1 1 auto', minWidth: '0' }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

