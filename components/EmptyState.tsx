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
      <div className="text-center py-8 px-4 bg-paper-deep" data-testid="empty-state-compact">
        <Icon
          size={28}
          strokeWidth={2}
          className="mx-auto mb-3 text-carbon-muted"
          aria-hidden="true"
        />
        <h4 className="mb-1 font-candy-body text-[15px] font-semibold text-carbon">{title}</h4>
        <p className="mx-auto mb-4 max-w-xs font-candy-body text-sm leading-6 text-carbon-soft">
          {description}
        </p>
        {action && (
          <RetroButton onClick={action.onClick} variant="primary" size="sm">
            {action.label}
          </RetroButton>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4 bg-paper-deep" data-testid="empty-state">
      <Icon
        size={36}
        strokeWidth={2}
        className="mx-auto mb-5 text-carbon-muted"
        aria-hidden="true"
      />

      {/* Title */}
      <h3
        className="mb-2 font-candy-display text-[28px] leading-none text-carbon"
        data-testid="empty-state-title"
      >
        {title}
      </h3>

      {/* Description */}
      <p
        className="mx-auto mb-6 max-w-sm font-candy-body leading-6 text-carbon-soft"
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
          <button type="button" onClick={secondaryAction.onClick} className="duo-quiet duo-focus">
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
