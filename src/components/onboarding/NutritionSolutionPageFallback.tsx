import { SecondaryPageHeader } from '../common/SecondaryPageHeader';
import { LoadingState } from '../common/LoadingState';

type Props = {
  onBack?: () => void;
  /** 引导流程（非只读）页底有主按钮：占位与 BottomActionBar 同高，避免 chunk 加载后底部突然出现 */
  showBottomActionPlaceholder?: boolean;
};

/** 与 NutritionSolutionPage 首屏壳一致，供 Suspense 使用，避免「全屏转圈 → 再出现顶栏」二次跳动 */
export function NutritionSolutionPageFallback({ onBack, showBottomActionPlaceholder }: Props) {
  return (
    <div className="flex h-full w-full flex-col overflow-hidden bg-gray-50">
      <div className="sticky top-0 z-20 flex-shrink-0">
        <SecondaryPageHeader title="营养方案" onClose={onBack ?? (() => {})} />
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <LoadingState />
      </div>
      {showBottomActionPlaceholder ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20">
          <div className="mx-auto w-full max-w-sm">
            <div
              className="border-t border-gray-200 bg-white px-4 py-4"
              style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom, 0px))' }}
            >
              <div className="h-12 w-full rounded-2xl bg-gray-100" aria-hidden />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
