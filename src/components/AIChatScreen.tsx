import React from 'react';
import { ChatProvider } from '../contexts/ChatContext';
import AIChatScreenContent from './AIChatScreenContent';
import { ErrorBoundary } from './ErrorBoundary';
import type { AbilityBarProps } from './singlepage/AbilityBar';
import type { RealtimeMetricKind } from './singlepage/TopSummaryRowContext';

interface AIChatScreenProps {
  onOpenSettings: () => void;
  abilityBarProps?: AbilityBarProps;
  showTopCards?: boolean;
  chatSelectedDate?: Date | null;
  onClearChatDate?: () => void;
  onTakePhoto?: () => void;
  onRealtimeCardClick?: (kind: RealtimeMetricKind) => void;
}

const AIChatScreen: React.FC<AIChatScreenProps> = ({
  onOpenSettings,
  abilityBarProps,
  showTopCards = true,
  chatSelectedDate = null,
  onClearChatDate,
  onTakePhoto,
  onRealtimeCardClick,
}) => {
  return (
    <ErrorBoundary>
      <ChatProvider chatSelectedDate={chatSelectedDate}>
        <AIChatScreenContent
          onOpenSettings={onOpenSettings}
          abilityBarProps={abilityBarProps}
          showTopCards={showTopCards}
          chatSelectedDate={chatSelectedDate}
          onClearChatDate={onClearChatDate}
          onTakePhoto={onTakePhoto}
          onRealtimeCardClick={onRealtimeCardClick}
        />
      </ChatProvider>
    </ErrorBoundary>
  );
};

export default AIChatScreen;
