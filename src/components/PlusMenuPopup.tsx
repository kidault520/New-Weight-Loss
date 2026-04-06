/**
 * + 号菜单弹窗 - 类似图5交互设计
 * 内容：扫一扫、绑定设备、产品介绍、分享产品（拍照上传已移至聊天输入框相机图标）
 */

import React from 'react';
import { Scan, Link2, Info, Share2 } from 'lucide-react';
import { PLUS_MENU_TOP_CSS } from '../constants/appLayout';

export interface PlusMenuPopupProps {
  visible: boolean;
  onClose: () => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  /** 使用 absolute 时弹窗相对于父容器定位，保持在 app 主容器内 */
  position?: 'fixed' | 'absolute';
  onScan?: () => void;
  onBindDevice?: () => void;
  onProductIntro?: () => void;
  onShare?: () => void;
}

const MENU_ITEMS = [
  { id: 'scan', icon: Scan, label: '扫一扫', color: 'text-blue-600' },
  { id: 'device', icon: Link2, label: '绑定设备', color: 'text-purple-600' },
  { id: 'intro', icon: Info, label: '产品介绍', color: 'text-gray-600' },
  { id: 'share', icon: Share2, label: '分享产品', color: 'text-purple-600' },
] as const;

export default function PlusMenuPopup({
  visible,
  onClose,
  position = 'fixed',
  onScan,
  onBindDevice,
  onProductIntro,
  onShare,
}: PlusMenuPopupProps) {
  if (!visible) return null;

  const handlers: Record<string, () => void> = {
    scan: onScan || (() => {}),
    device: onBindDevice || (() => {}),
    intro: onProductIntro || (() => {}),
    share: onShare || (() => {}),
  };

  const isAbsolute = position === 'absolute';
  const menuClass = isAbsolute
    ? 'absolute right-0 top-full mt-1 z-[60] w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in slide-in-from-top-2 duration-200'
    : 'fixed right-4 z-[60] w-36 bg-white rounded-xl shadow-lg border border-gray-100 py-2 animate-in slide-in-from-top-2 duration-200';

  return (
    <>
      <div
        className="fixed inset-0 z-[55]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        className={menuClass}
        style={
          isAbsolute
            ? { transformOrigin: 'top right' }
            : { transformOrigin: 'top right', top: PLUS_MENU_TOP_CSS }
        }
        onClick={(e) => e.stopPropagation()}
      >
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const onClick = () => {
            handlers[item.id]?.();
            onClose();
          };
          return (
            <button
              key={item.id}
              onClick={onClick}
              className="w-full px-3 py-2 flex items-center gap-2 hover:bg-gray-50 transition-colors text-left"
            >
              <div className={`w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center shrink-0 ${item.color}`}>
                <Icon className="w-4 h-4" />
              </div>
              <span className="text-sm font-medium text-gray-800">{item.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}
