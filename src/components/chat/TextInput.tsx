import React from 'react';

interface TextInputProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSend: (text?: string) => void;
  disabled: boolean;
  placeholder?: string;
  /** 无边框模式，用于嵌入带边框的容器中 */
  borderless?: boolean;
}

const TextInput: React.FC<TextInputProps> = ({ value, onChange, onSend, disabled, placeholder = '说点什么呢...', borderless }) => {
  return (
    <div className={`flex-1 flex items-center min-w-0 ${borderless ? 'px-2 py-1' : 'border border-gray-300 rounded-full px-4 py-2'}`}>
      <input
        type="text"
        value={value}
        onChange={onChange}
        disabled={disabled}
        placeholder={placeholder}
        className="flex-1 bg-transparent outline-none text-gray-700 placeholder-gray-400 text-sm"
        onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), onSend(value.trim()))}
      />
    </div>
  );
};

export default TextInput;
