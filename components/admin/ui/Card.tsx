/**
 * Admin Card — paper on the ground, or an ice well (`muted`). No border, no shadow.
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
      'duo-card relative p-5 ' +
      (variant === 'default' ? 'bg-paper text-carbon ' : 'bg-paper-deep text-carbon ') +
      className
    }
  >
    {children}
  </div>
);
