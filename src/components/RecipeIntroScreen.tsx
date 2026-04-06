import React from 'react';
import { ChevronLeft } from 'lucide-react';
import { DragPanel } from './common/DragPanel';

interface RecipeIntroScreenProps {
  onClose: () => void;
  /** 顶栏标题，默认与「食谱介绍」一致 */
  title?: string;
  /** 自定义正文；不传时展示默认食谱简介（后续可由后台配置替换整段） */
  children?: React.ReactNode;
  /**
   * 与健康详情等全屏 DragPanel 一致；嵌套在 Drawer z-[80] 之上时请传 90。
   * @default 70
   */
  zIndex?: number;
}

const RecipeIntroScreen: React.FC<RecipeIntroScreenProps> = ({
  onClose,
  title = '瑞丹维·食谱简介',
  children,
  zIndex = 70,
}) => {
  return (
    <DragPanel
      show
      onClose={onClose}
      zIndex={zIndex}
      animationDuration={500}
      mask={{ visible: false }}
      header={
        <div className="flex items-center px-4 py-2 bg-gray-50 border-b border-gray-100/80">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-gray-200 rounded-lg transition-colors active:scale-95"
          >
            <ChevronLeft className="w-6 h-6 text-gray-700" />
          </button>
          <h1 className="flex-1 text-center text-base font-normal text-gray-700">{title}</h1>
          <div className="w-8 h-8 shrink-0" aria-hidden />
        </div>
      }
    >
      <div className="px-4 pb-6 pt-1">
        {children ?? (
          <>
            <div className="mb-8">
              <h2 className="text-lg font-bold text-gray-800 mb-4">食谱特点：</h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">
                    1. 全球最受欢迎的轻断食计划；
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">
                    2. 一天中有8小时的进食窗口，其余16小时均保持空腹的状态；
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">
                    3. 营养师全面考虑了食谱营养的均衡性，请放心食用。
                  </p>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-bold text-gray-800 mb-4">禁忌人群：</h2>
              <div className="space-y-3">
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">孕妇及哺乳期妇女；</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">18岁以下未成年人及65岁以上的老年人；</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">
                    患有饮食障碍（暴食症、厌食症）、胃食管返流病（GERD）、胃病的人群；
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">过低体重、营养不良、中度以上贫血的人群；</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">
                    刚做完手术、痛风病史、糖尿病、高血压、低血糖、正在服用药物的人群；
                  </p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-cyan-400 rounded-full mt-2 flex-shrink-0" />
                  <p className="text-gray-700 leading-relaxed">因断食而感到不舒服及便秘的人群。</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DragPanel>
  );
};

export default RecipeIntroScreen;
