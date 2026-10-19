import React from 'react';
import { LucideIcon } from 'lucide-react';
import { RetroButton } from './RetroButton';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  variant?: 'default' | 'compact';
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = 'default',
}) => {
  if (variant === 'compact') {
    return (
      <div
        className="text-center py-8 px-4 border-2 border-carbon bg-paper-deep"
        data-testid="empty-state-compact"
      >
        <div className="inline-flex items-center justify-center w-12 h-12 border-2 border-carbon bg-riso-blue mb-3">
          <Icon size={24} className="text-paper" />
        </div>
        <h4 className="text-carbon font-riso-display font-bold mb-1 uppercase tracking-[0.06em]">
          {title}
        </h4>
        <p className="text-carbon-muted text-sm mb-3 font-riso-body">{description}</p>
        {action && (
          <RetroButton onClick={action.onClick} variant="primary" className="text-xs">
            {action.label}
          </RetroButton>
        )}
      </div>
    );
  }

  return (
    <div
      className="text-center py-16 px-4 border-2 border-carbon bg-paper riso-shadow-md"
      data-testid="empty-state"
    >
      {/* Icon — solid riso-blue sticker tile */}
      <div className="relative inline-block mb-6">
        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-riso-blue border-2 border-carbon riso-shadow-sm">
          <Icon size={40} className="text-paper" strokeWidth={2.2} />
        </div>
      </div>

      {/* Title */}
      <h3
        className="text-xl sm:text-2xl font-bold text-carbon font-riso-display mb-2 uppercase tracking-[0.06em]"
        data-testid="empty-state-title"
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="text-carbon-muted max-w-sm mx-auto mb-6 font-riso-body"
        data-testid="empty-state-description"
      >
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {action && (
          <RetroButton onClick={action.onClick} variant="primary" className="w-full sm:w-auto">
            {action.icon && <action.icon size={18} />}
            {action.label}
          </RetroButton>
        )}

        {secondaryAction && (
          <button
            type="button"
            onClick={secondaryAction.onClick}
            className="text-carbon-muted hover:text-carbon-soft transition-colors text-sm underline underline-offset-4"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
