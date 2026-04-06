import React, { useState, useCallback, useEffect } from 'react';
import { Pencil, User, Users, ChevronRight } from 'lucide-react';
import { supabase } from '../config/supabase';
import { aiSettingsService, DEFAULT_AI_COMPANION_NAME } from '../services/aiSettingsService';
import { DragPanel } from './common/DragPanel';
import { DetailHeader } from './common/DetailHeader';

interface AISettingsScreenProps {
  onClose: () => void;
}

const AISettingsScreen: React.FC<AISettingsScreenProps> = ({ onClose }) => {
  const [ownerName, setOwnerName] = useState('');
  const [gender, setGender] = useState('');
  const [identity, setIdentity] = useState('');
  const [description, setDescription] = useState('');
  const [tataName, setTataName] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  const handlePanelClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Load AI settings on mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          setOwnerName('owner');
          setGender('保密');
          setIdentity('你的教练');
          setDescription('虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。');
          setTataName(DEFAULT_AI_COMPANION_NAME);
          setIsLoading(false);
          return;
        }

        const settings = await aiSettingsService.getSettings(user.id);
        if (settings) {
          setTataName(settings.name);
          setOwnerName(settings.owner_name);
          setGender(settings.gender);
          setIdentity(settings.identity);
          setDescription(settings.description);
        } else {
          setOwnerName('owner');
          setGender('保密');
          setIdentity('你的教练');
          setDescription('虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。');
          setTataName(DEFAULT_AI_COMPANION_NAME);
        }
      } catch (error) {
        console.error('Failed to load AI settings:', error);
        setOwnerName('owner');
        setGender('保密');
        setIdentity('你的教练');
        setDescription('虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。');
        setTataName(DEFAULT_AI_COMPANION_NAME);
      } finally {
        setIsLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handleRandom = () => {
    const identities = ['你的教练', '你的助手', '你的朋友', '你的导师', '你的伙伴'];
    const descriptions = [
      '虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。',
      '温柔体贴，总是耐心地倾听和帮助。',
      '活泼开朗，充满正能量，喜欢和你分享快乐。',
      '睿智沉稳，用丰富的经验指导你前进。',
      '忠诚可靠，永远站在你身边支持你。',
    ];

    const randomIdentity = identities[Math.floor(Math.random() * identities.length)];
    const randomDescription = descriptions[Math.floor(Math.random() * descriptions.length)];

    setIdentity(randomIdentity);
    setDescription(randomDescription);
  };

  const handleSave = async () => {
    setIsSaving(true);
    setShowSuccessMessage(false);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setIsSaving(false);
        return;
      }

      const settings = {
        name: tataName,
        owner_name: ownerName,
        gender: gender,
        identity: identity,
        description: description,
      };

      const success = await aiSettingsService.updateSettings(user.id, settings);

      if (success) {
        setShowSuccessMessage(true);
        window.dispatchEvent(
          new CustomEvent('rl-ai-companion-settings-saved', { detail: settings }),
        );
        setTimeout(() => {
          onClose();
        }, 1200);
      }
    } catch (error) {
      console.error('Failed to save AI settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DragPanel
      show={true}
      onClose={handlePanelClose}
      zIndex={60}
      mask={{ visible: false }}
      header={
        <DetailHeader
          title="定制你的AI伙伴"
          leftAction={{ label: '返回', onClick: handlePanelClose }}
        />
      }
    >
      <div className="px-4 pb-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-gray-400">加载中...</div>
          </div>
        ) : (
          <>
            <div className="flex justify-center px-2 mb-3">
              <div className="w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                <span className="text-4xl">🐰</span>
              </div>
            </div>

            <div className="mb-2">
              <div className="bg-white rounded-2xl p-2.5 shadow-sm">
                <div className="flex items-center space-x-3">
                  <Pencil className="w-5 h-5 text-gray-600 shrink-0" />
                  <input
                    type="text"
                    value={tataName}
                    onChange={(e) => setTataName(e.target.value)}
                    className="flex-1 text-base font-medium text-gray-800 bg-transparent border-none outline-none"
                    placeholder="输入AI名称"
                  />
                </div>
              </div>
            </div>

            <div className="mb-3">
              <div className="bg-white rounded-2xl p-2.5 shadow-sm space-y-2">
                <div className="w-full flex items-center justify-between rounded-lg p-2">
                  <div className="flex items-center space-x-3">
                    <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center">
                      <User className="w-4 h-4 text-blue-600" />
                    </div>
                    <span className="text-gray-800 text-sm">称呼我为</span>
                  </div>
                  <input
                    type="text"
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    maxLength={15}
                    className="text-gray-600 text-sm bg-transparent border-none outline-none text-right max-w-[50%]"
                    placeholder="owner"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => {
                    const genders = ['男', '女', '保密'];
                    const currentIndex = genders.indexOf(gender);
                    const nextIndex = (currentIndex + 1) % genders.length;
                    setGender(genders[nextIndex]);
                  }}
                  className="w-full flex items-center justify-between hover:bg-gray-50 rounded-lg p-2 transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                      <Users className="w-4 h-4 text-orange-600" />
                    </div>
                    <span className="text-gray-800 text-sm">性别</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-gray-600 text-sm">{gender}</span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                </button>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-base">🐰</span>
                      </div>
                      <span className="text-gray-800 text-sm">宠物设定</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleRandom}
                      className="flex items-center space-x-1 px-2 py-1 text-orange-600 rounded-full text-xs hover:bg-orange-100 transition-colors"
                    >
                      <span className="text-sm">🎲</span>
                      <span>随机</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center space-x-3">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-blue-600 text-xs">👤</span>
                      </div>
                      <div className="flex items-center flex-1 min-w-0">
                        <span className="text-gray-400 text-xs mr-2 shrink-0">身份：</span>
                        <input
                          type="text"
                          value={identity}
                          onChange={(e) => setIdentity(e.target.value)}
                          className="flex-1 min-w-0 text-gray-500 text-xs bg-transparent border-none outline-none"
                          placeholder="你的教练"
                        />
                      </div>
                    </div>

                    <div className="flex items-start space-x-3">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-green-600 text-xs">📝</span>
                      </div>
                      <div className="flex items-start flex-1 min-w-0">
                        <span className="text-gray-400 text-xs mr-2 shrink-0">描述：</span>
                        <textarea
                          value={description}
                          onChange={(e) => setDescription(e.target.value)}
                          className="flex-1 min-w-0 text-gray-500 text-xs leading-relaxed bg-transparent border-none outline-none resize-none"
                          placeholder="虽然命令和利嘴讯不断，外冷内热，但关心隐藏在严厉下。"
                          rows={3}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="text-center text-gray-400 text-xs mt-2">
                  *别担心，后续你还可以继续修改这些配置
                </div>
              </div>
            </div>

            <div className="pb-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || isLoading || showSuccessMessage}
                className={`w-full py-2.5 rounded-2xl text-base font-medium shadow-lg disabled:cursor-not-allowed transition-all ${
                  showSuccessMessage
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white'
                    : 'bg-gradient-to-r from-purple-500 to-purple-600 text-white disabled:opacity-50'
                }`}
              >
                {isSaving ? '保存中...' : showSuccessMessage ? '✓ 保存成功' : '保存'}
              </button>
            </div>
          </>
        )}
      </div>
    </DragPanel>
  );
};

export default AISettingsScreen;
