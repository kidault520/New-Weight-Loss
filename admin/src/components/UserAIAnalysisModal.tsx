import { useEffect, useState } from 'react';
import { X, Loader2 } from 'lucide-react';

interface UserAIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function UserAIAnalysisModal({
  isOpen,
  onClose,
  userId,
}: UserAIAnalysisModalProps) {
  const [loading, setLoading] = useState(false);
  const [htmlReport, setHtmlReport] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && userId) {
      generateReport();
    } else {
      // Reset state when modal closes
      setHtmlReport(null);
      setError(null);
    }
  }, [isOpen, userId]);

  const generateReport = async () => {
    setLoading(true);
    setError(null);
    setHtmlReport(null);

    try {
      const { apiClient } = await import('../config/api');
      const response = await apiClient.post<{ html: string }>(
        `/api/admin/users/${userId}/ai-analysis`,
        undefined,
        { timeout: 120000 } // 120 seconds timeout
      );
      
      if (!response.html) {
        throw new Error('报告生成失败：服务器返回空内容');
      }
      
      setHtmlReport(response.html);
    } catch (err: any) {
      console.error('Failed to generate AI analysis:', err);
      
      let errorMessage = '生成健康解读报告失败，请稍后重试';
      
      if (err.message) {
        if (err.message.includes('超时') || err.message.includes('timeout')) {
          errorMessage = '报告生成超时，AI处理可能需要更长时间。请稍后重试，或联系技术支持。';
        } else if (err.message.includes('DeepSeek')) {
          errorMessage = `AI服务错误：${err.message}`;
        } else {
          errorMessage = err.message;
        }
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-2xl font-bold text-gray-900">AI健康数据解读</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden relative">
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-90 z-10">
              <div className="text-center">
                <Loader2 className="w-12 h-12 animate-spin text-purple-600 mx-auto mb-4" />
                <p className="text-gray-600 font-medium">正在生成健康解读报告，请稍候...</p>
                <p className="text-sm text-gray-500 mt-2">AI正在分析用户数据并生成报告，这可能需要30-120秒</p>
                <p className="text-xs text-gray-400 mt-1">请勿关闭此窗口</p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-8 text-center">
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4 max-w-md mx-auto">
                <p className="text-red-800 font-medium mb-2">生成报告时出错</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <button
                  onClick={generateReport}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  重试
                </button>
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  关闭
                </button>
              </div>
            </div>
          )}

          {htmlReport && !loading && (
            <iframe
              srcDoc={htmlReport}
              className="w-full h-full border-0"
              title="AI健康解读报告"
              sandbox="allow-scripts allow-same-origin"
            />
          )}

          {!htmlReport && !loading && !error && (
            <div className="p-8 text-center text-gray-500">
              <p>准备生成报告...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

