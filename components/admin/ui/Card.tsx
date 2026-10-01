/**
 * Admin Card — Riso Kantin re-skin (PR #24). API preserved.
 */
import React from 'react';

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'muted';
}

export const Card: React.FC<CardProps> = ({
  variant = 'default',
  className = '',
  children,
  ...rest
}) => (
  <div
    {...rest}
    className={
      'duo-card relative border-2 border-carbon p-5 ' +
      (variant === 'default'
        ? 'bg-paper text-carbon riso-shadow-sm '
        : 'bg-paper-deep text-carbon ') +
      className
    }
  >
    {children}
  </div>
);
