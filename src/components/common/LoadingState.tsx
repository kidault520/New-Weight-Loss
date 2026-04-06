import { Loader2 } from 'lucide-react';

interface LoadingStateProps {
  message?: string;
  spinnerColor?: string;
  className?: string;
}

export function LoadingState({ 
  message = '加载中...', 
  spinnerColor = 'text-yellow-400',
  className = '' 
}: LoadingStateProps) {
  return (
    <div className={`flex items-center justify-center h-full ${className}`}>
      <div className="text-center">
        <Loader2 className={`w-12 h-12 ${spinnerColor} animate-spin mx-auto mb-4`} />
        <p className="text-gray-600">{message}</p>
      </div>
    </div>
  );
}
















