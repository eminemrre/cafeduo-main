/**
 * Skeleton Components
 * 
 * @description Loading state UI elements with shimmer effects
 * @usage <SkeletonCard />, <SkeletonText />, <SkeletonGrid />, <LoadingSpinner />
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// Temel Skeleton elementi - Shimmer efekti ile
interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-[#07142b]/75 border border-cyan-900/45 ${className}`}>
      {/* Shimmer animation */}
      <motion.div
        className="absolute inset-0 -translate-x-full"
        style={{
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)',
        }}
        animate={{
          translateX: ['-100%', '100%'],
        }}
        transition={{
          repeat: Infinity,
          duration: 1.5,
          ease: 'linear',
        }}
      />
    </div>
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
    <div className="rf-screen-card-muted border-gray-800 p-6 space-y-4">
      {/* Icon alanı */}
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
      </div>
      
      {/* Content */}
      <SkeletonText lines={2} />
      
      {/* Button */}
      <Skeleton className="h-10 w-full" />
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
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <SkeletonCard />
        </motion.div>
      ))}
    </div>
  );
};

// Stats skeleton (Status bar için)
export const SkeletonStats: React.FC = () => {
  return (
    <div className="flex items-center gap-6">
      {/* Avatar */}
      <Skeleton className="w-12 h-12" />
      
      {/* Stats */}
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
};

// Button loading state
export const ButtonSkeleton: React.FC<{ fullWidth?: boolean }> = ({ fullWidth = false }) => {
  return (
    <Skeleton className={`h-10 ${fullWidth ? 'w-full' : 'w-32'}`} />
  );
};

// Loading Spinner - Retro tarzı
interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

export const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ 
  size = 'md', 
  text,
  className = ''
}) => {
  const sizeClasses = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-3',
    lg: 'w-16 h-16 border-4'
  };

  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <motion.div
        className={`${sizeClasses[size]} border-cyan-900/60 border-t-blue-500 rounded-full`}
        animate={{ rotate: 360 }}
        transition={{
          duration: 1,
          repeat: Infinity,
          ease: 'linear'
        }}
      />
      {text && (
        <motion.p 
          className={`${textSizes[size]} text-[var(--rf-muted)] font-pixel uppercase tracking-[0.14em]`}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
};

// Loading Overlay - Tam ekran loading
interface LoadingOverlayProps {
  isLoading: boolean;
  text?: string;
  children: React.ReactNode;
}

export const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ 
  isLoading, 
  text = 'Yükleniyor...',
  children 
}) => {
  return (
    <div className="relative">
      {children}
      
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-[#071020]/85 backdrop-blur-sm flex items-center justify-center z-10"
          >
            <LoadingSpinner size="lg" text={text} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// Dot loader (3 nokta animasyonu)
export const DotLoader: React.FC<{ className?: string }> = ({ className = '' }) => {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-2 h-2 bg-blue-500 rounded-full"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.5, 1, 0.5]
          }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.15
          }}
        />
      ))}
    </div>
  );
};

export default Skeleton;
