/**
 * Skeleton Components
 *
 * @description Loading state UI elements with CSS shimmer effects
 * @usage <SkeletonCard />, <SkeletonText />, <SkeletonGrid />, <LoadingSpinner />
 */

import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`relative overflow-hidden bg-[#07142b]/75 border border-cyan-900/45 ${className}`}>
    <div
      className="absolute inset-0 -translate-x-full animate-shimmer"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)' }}
    />
  </div>
);

export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ lines = 1, className = '' }) => (
  <div className={`space-y-2 ${className}`}>
    {Array.from({ length: lines }).map((_, i) => (
      <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} />
    ))}
  </div>
);

export const SkeletonCard: React.FC = () => (
  <div className="rf-screen-card-muted border-gray-800 p-6 space-y-4">
    <div className="flex items-center gap-4">
      <Skeleton className="w-12 h-12" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-5 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
      </div>
    </div>
    <SkeletonText lines={2} />
    <Skeleton className="h-10 w-full" />
  </div>
);

export const SkeletonGrid: React.FC<{ count?: number; columns?: number }> = ({ count = 6, columns = 3 }) => (
  <div
    className={`grid gap-4 ${
      columns === 1 ? 'grid-cols-1' :
      columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
      'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
    }`}
  >
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="animate-fade-in-up" style={{ animationDelay: `${i * 50}ms` }}>
        <SkeletonCard />
      </div>
    ))}
  </div>
);

export const SkeletonStats: React.FC = () => (
  <div className="flex items-center gap-6">
    <Skeleton className="w-12 h-12" />
    <div className="flex gap-4">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-[#07142b]/75 border border-cyan-900/35 px-4 py-2 min-w-[80px]">
          <Skeleton className="h-6 w-12 mb-1" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  </div>
);

export const ButtonSkeleton: React.FC<{ fullWidth?: boolean }> = ({ fullWidth = false }) => (
  <Skeleton className={`h-10 ${fullWidth ? 'w-full' : 'w-32'}`} />
);

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const spinnerSizes = { sm: 'w-6 h-6 border-2', md: 'w-10 h-10 border-3', lg: 'w-16 h-16 border-4' };
const textSizes = { sm: 'text-xs', md: 'text-sm', lg: 'text-base' };

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ size = 'md', text, className = '' }) => (
  <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
    <div className={`${spinnerSizes[size]} border-cyan-900/60 border-t-blue-500 rounded-full animate-spin`} />
    {text && (
      <p className={`${textSizes[size]} text-[var(--rf-muted)] uppercase tracking-wider animate-pulse`}>
        {text}
      </p>
    )}
  </div>
);

interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ isLoading, text = 'Yükleniyor...', children }) => (
  <div className="relative">
    {children}
    {isLoading && (
      <div className="absolute inset-0 bg-[#071020]/85 backdrop-blur-sm flex items-center justify-center z-10 animate-fade-in">
        <LoadingSpinner size="lg" text={text} />
      </div>
    )}
  </div>
);

export const DotLoader: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`flex items-center gap-1 ${className}`}>
    {[0, 1, 2].map((i) => (
      <div
        key={i}
        className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"
        style={{ animationDelay: `${i * 150}ms` }}
      />
    ))}
  </div>
);

export default Skeleton;
