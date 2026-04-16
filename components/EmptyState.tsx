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
  variant = 'default'
}) => {
  if (variant === 'compact') {
    return (
      <div className="text-center py-8 px-4 rf-screen-card-muted" data-testid="empty-state-compact">
        <div className="inline-flex items-center justify-center w-12 h-12 border border-cyan-400/30 bg-[#09162f]/80 mb-3">
          <Icon size={24} className="text-cyan-300" />
        </div>
        <h4 className="text-white font-medium mb-1 uppercase tracking-[0.06em]">{title}</h4>
        <p className="text-[var(--rf-muted)] text-sm mb-3">{description}</p>
        {action && (
          <RetroButton onClick={action.onClick} variant="primary" className="text-xs">
            {action.label}
          </RetroButton>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4 rf-screen-card noise-bg" data-testid="empty-state">
      {/* Icon */}
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-cyan-400/15 blur-2xl" />
        <div className="relative inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-[#06142b] to-[#081b39] border border-cyan-400/30">
          <Icon size={40} className="text-cyan-300" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-white mb-2" data-testid="empty-state-title">
        {title}
      </h3>

      {/* Description */}
      <p className="text-[var(--rf-muted)] max-w-sm mx-auto mb-6" data-testid="empty-state-description">
        {description}
      </p>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
        {action && (
          <RetroButton 
            onClick={action.onClick} 
            variant="primary"
            className="w-full sm:w-auto"
          >
            {action.icon && <action.icon size={18} />}
            {action.label}
          </RetroButton>
        )}
        
        {secondaryAction && (
          <button
            onClick={secondaryAction.onClick}
            className="text-[var(--rf-muted)] hover:text-cyan-200 transition-colors text-sm underline underline-offset-4"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
