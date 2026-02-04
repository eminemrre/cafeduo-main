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
      <div className="text-center py-8 px-4">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-gray-800/50 mb-3">
          <Icon size={24} className="text-gray-500" />
        </div>
        <h4 className="text-white font-medium mb-1">{title}</h4>
        <p className="text-gray-500 text-sm mb-3">{description}</p>
        {action && (
          <RetroButton onClick={action.onClick} variant="primary" className="text-xs">
            {action.label}
          </RetroButton>
        )}
      </div>
    );
  }

  return (
    <div className="text-center py-16 px-4">
      {/* Icon */}
      <div className="relative inline-block mb-6">
        <div className="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full" />
        <div className="relative inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-gray-800 to-gray-900 border border-gray-700">
          <Icon size={40} className="text-gray-500" />
        </div>
      </div>

      {/* Title */}
      <h3 className="text-xl font-bold text-white mb-2">
        {title}
      </h3>

      {/* Description */}
      <p className="text-gray-400 max-w-sm mx-auto mb-6">
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
            className="text-gray-400 hover:text-white transition-colors text-sm underline underline-offset-4"
          >
            {secondaryAction.label}
          </button>
        )}
      </div>
    </div>
  );
};

export default EmptyState;
