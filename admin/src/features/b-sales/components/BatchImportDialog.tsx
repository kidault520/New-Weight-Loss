/**
 * 批量导入成员对话框 - 支持CSV文件导入
 */

import React, { useState, useRef } from 'react';
import { X, Upload, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Person, Rank, JoinMethod } from '../types/organization';
import { OrganizationService } from '../services/organizationService';
import { RecommendationService } from '../services/recommendationService';

interface BatchImportDialogProps {
  orgService: OrganizationService;
  onImport: (persons: Person[]) => void;
  onCancel: () => void;
}

interface ImportRow {
  name: string;
  level: Rank;
  performance: string;
  avatarUrl: string;
  region?: string;
  province?: string;
  city?: string;
  recommenderName?: string;
  joinMethod?: JoinMethod;
  errors?: string[];
}

export const BatchImportDialog: React.FC<BatchImportDialogProps> = ({
  orgService,
  onImport,
  onCancel,
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<ImportRow[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 解析CSV文件
  const parseCSV = (text: string): ImportRow[] => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const rows: ImportRow[] = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      const row: ImportRow = {
        name: '',
        level: '收展员',
        performance: '0',
        avatarUrl: 'https://i.pravatar.cc/150',
        errors: [],
      };

      headers.forEach((header, index) => {
        const value = values[index] || '';
        switch (header) {
          case '姓名':
          case 'name':
            row.name = value;
            break;
          case '职级':
          case 'level':
          case 'rank':
            row.level = (value as Rank) || '收展员';
            break;
          case '业绩':
          case 'performance':
          case 'sales':
            row.performance = value;
            break;
          case '头像':
          case 'avatar':
          case 'avatarurl':
            row.avatarUrl = value || 'https://i.pravatar.cc/150';
            break;
          case '地区':
          case 'region':
            row.region = value;
            break;
          case '省份':
          case 'province':
            row.province = value;
            break;
          case '城市':
          case 'city':
            row.city = value;
            break;
          case '推荐人':
          case 'recommender':
            row.recommenderName = value;
            break;
          case '加入方式':
          case 'joinmethod':
            row.joinMethod = (value as JoinMethod) || '自主加入';
            break;
        }
      });

      // 验证数据
      const errors: string[] = [];
      if (!row.name) errors.push('姓名不能为空');
      if (!['收展员', '组经理', '部经理', '区经理'].includes(row.level)) {
        errors.push('职级无效');
      }
      if (row.recommenderName && !row.joinMethod) {
        row.joinMethod = '推荐加入';
      }

      row.errors = errors;
      rows.push(row);
    }

    return rows;
  };

  // 处理文件选择
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      alert('请选择CSV文件');
      return;
    }

    setFile(selectedFile);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const data = parseCSV(text);
      setPreviewData(data);
    };
    reader.readAsText(selectedFile, 'UTF-8');
  };

  // 执行导入
  const handleImport = async () => {
    if (previewData.length === 0) {
      alert('没有可导入的数据');
      return;
    }

    const hasErrors = previewData.some(row => row.errors && row.errors.length > 0);
    if (hasErrors) {
      if (!confirm('部分数据有错误，是否继续导入有效数据？')) {
        return;
      }
    }

    setIsProcessing(true);
    const recommendationService = new RecommendationService(orgService);
    const importedPersons: Person[] = [];
    const errors: string[] = [];

    try {
      for (const row of previewData) {
        if (row.errors && row.errors.length > 0) {
          errors.push(`${row.name}: ${row.errors.join(', ')}`);
          continue;
        }

        try {
          const performanceValue = parseFloat(row.performance.replace('w', '')) || 0;
          const performanceInYuan = performanceValue * 10000;

          let person: Person;

          if (row.joinMethod === '推荐加入' && row.recommenderName) {
            // 查找推荐人
            const allPersons = orgService.persons.getAllPersons();
            const recommender = allPersons.find(p => p.name === row.recommenderName);
            
            if (!recommender) {
              errors.push(`${row.name}: 找不到推荐人 ${row.recommenderName}`);
              continue;
            }

            person = recommendationService.handleRecommendationJoin(
              {
                name: row.name,
                performance: performanceInYuan,
                avatarUrl: row.avatarUrl,
                regionId: row.region,
                provinceId: row.province,
                cityId: row.city,
              },
              recommender.id
            );
          } else {
            person = recommendationService.handleSelfJoin({
              name: row.name,
              performance: performanceInYuan,
              avatarUrl: row.avatarUrl,
              regionId: row.region,
              provinceId: row.province,
              cityId: row.city,
            });
          }

          importedPersons.push(person);
        } catch (error: any) {
          errors.push(`${row.name}: ${error.message}`);
        }
      }

      if (importedPersons.length > 0) {
        onImport(importedPersons);
        alert(`成功导入 ${importedPersons.length} 条记录${errors.length > 0 ? `，${errors.length} 条失败` : ''}`);
      } else {
        alert('导入失败：' + errors.join('\n'));
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const validRows = previewData.filter(row => !row.errors || row.errors.length === 0);
  const errorRows = previewData.filter(row => row.errors && row.errors.length > 0);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <h3 className="text-lg font-bold text-slate-800">批量导入成员</h3>
          <button
            onClick={onCancel}
            className="p-1 hover:bg-slate-100 rounded transition-colors"
            disabled={isProcessing}
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* 文件选择 */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              选择CSV文件
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleFileSelect}
                className="hidden"
                disabled={isProcessing}
              />
              <Upload className="w-12 h-12 text-slate-400 mx-auto mb-3" />
              <p className="text-sm text-slate-600 mb-2">
                {file ? file.name : '点击选择或拖拽CSV文件到此处'}
              </p>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                disabled={isProcessing}
              >
                选择文件
              </button>
              <p className="text-xs text-slate-500 mt-3">
                CSV格式：姓名,职级,业绩,地区,省份,城市,推荐人,加入方式
              </p>
            </div>
          </div>

          {/* 预览数据 */}
          {previewData.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-slate-700">数据预览</h4>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-emerald-600">
                    <CheckCircle className="w-4 h-4 inline mr-1" />
                    有效: {validRows.length}
                  </span>
                  {errorRows.length > 0 && (
                    <span className="text-rose-600">
                      <XCircle className="w-4 h-4 inline mr-1" />
                      错误: {errorRows.length}
                    </span>
                  )}
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 sticky top-0">
                      <tr>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">姓名</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">职级</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">业绩</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">地区</th>
                        <th className="px-3 py-2 text-left text-xs font-semibold text-slate-600">状态</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewData.slice(0, 20).map((row, index) => (
                        <tr
                          key={index}
                          className={`border-t border-slate-100 ${
                            row.errors && row.errors.length > 0 ? 'bg-rose-50' : 'bg-white'
                          }`}
                        >
                          <td className="px-3 py-2">{row.name}</td>
                          <td className="px-3 py-2">{row.level}</td>
                          <td className="px-3 py-2">{row.performance}</td>
                          <td className="px-3 py-2">{row.region || '-'}</td>
                          <td className="px-3 py-2">
                            {row.errors && row.errors.length > 0 ? (
                              <div className="flex items-center gap-1 text-rose-600">
                                <AlertCircle className="w-4 h-4" />
                                <span className="text-xs">{row.errors[0]}</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle className="w-4 h-4" />
                                <span className="text-xs">有效</span>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {previewData.length > 20 && (
                  <div className="bg-slate-50 px-3 py-2 text-xs text-slate-500 text-center">
                    还有 {previewData.length - 20} 条记录...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 p-6 border-t border-slate-200">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition-colors"
            disabled={isProcessing}
          >
            取消
          </button>
          <button
            onClick={handleImport}
            disabled={previewData.length === 0 || isProcessing}
            className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
          >
            {isProcessing ? '导入中...' : `导入 ${validRows.length} 条记录`}
          </button>
        </div>
      </div>
    </div>
  );
};




















