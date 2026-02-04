/**
 * Skeleton Components
 * 
 * @description Loading state UI elements
 * @usage <SkeletonCard />, <SkeletonText />, <SkeletonGrid />
 */

import React from 'react';

// Temel Skeleton elementi
interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div
      className={`animate-pulse bg-gray-700/50 rounded ${className}`}
    />
  );
};

// Yazı skeleton'u
export const SkeletonText: React.FC<{ lines?: number; className?: string }> = ({ 
  lines = 1, 
  className = '' 
}) => {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          className={`h-4 ${i === lines - 1 ? 'w-3/4' : 'w-full'}`} 
        />
      ))}
    </div>
  );
};

// Kart skeleton'u (Oyun kartları için)
export const SkeletonCard: React.FC = () => {
  return (
    <div className="bg-[#151921] border border-gray-800 rounded-xl p-6 space-y-4">
      {/* Icon alanı */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-lg" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      
      {/* Content */}
      <SkeletonText lines={2} />
      
      {/* Button */}
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
};

// Grid skeleton (Liste görünümleri için)
export const SkeletonGrid: React.FC<{ count?: number; columns?: number }> = ({ 
  count = 6,
  columns = 3
}) => {
  return (
    <div 
      className={`grid gap-4 ${
        columns === 1 ? 'grid-cols-1' :
        columns === 2 ? 'grid-cols-1 md:grid-cols-2' :
        'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}
    >
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
};

// Stats skeleton (Status bar için)
export const SkeletonStats: React.FC = () => {
  return (
    <div className="flex items-center gap-6">
      {/* Avatar */}
      <Skeleton className="w-12 h-12 rounded-full" />
      
      {/* Stats */}
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-gray-800/50 rounded-lg px-4 py-2 min-w-[80px]">
            <Skeleton className="h-6 w-12 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
};

// Button loading state
export const ButtonSkeleton: React.FC<{ fullWidth?: boolean }> = ({ fullWidth = false }) => {
  return (
    <Skeleton className={`h-10 rounded-lg ${fullWidth ? 'w-full' : 'w-32'}`} />
  );
};

export default Skeleton;
