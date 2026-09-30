import React from 'react';
import { motion, AnimatePresence } from 'motion/react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular' | 'badge';
  width?: string | number;
  height?: string | number;
}

export function Skeleton({
  className = '',
  variant = 'rectangular',
  width,
  height,
}: SkeletonProps) {
  const variantClasses = {
    text: 'h-3.5 rounded-md',
    circular: 'rounded-full',
    rectangular: 'rounded-xl',
    badge: 'h-5 rounded-md w-16',
  };

  return (
    <div
      style={{ width, height }}
      className={`relative overflow-hidden bg-surface-2/80 before:absolute before:inset-0 before:-translate-x-full before:animate-shimmer before:bg-gradient-to-r before:from-transparent before:via-surface-3/50 before:to-transparent ${variantClasses[variant]} ${className}`}
    />
  );
}

export function SkeletonText({
  lines = 3,
  className = '',
}: {
  lines?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          variant="text"
          className={
            i === lines - 1 && lines > 1
              ? 'w-3/4'
              : i === 0
              ? 'w-full'
              : 'w-11/12'
          }
        />
      ))}
    </div>
  );
}

export function SkeletonCard({
  count = 3,
  className = '',
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ${className}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="p-4 bg-surface-1/70 border border-surface-3/60 rounded-xl space-y-3.5 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Skeleton variant="circular" className="w-8 h-8 shrink-0" />
              <div className="space-y-1.5">
                <Skeleton variant="text" className="w-28 h-4" />
                <Skeleton variant="text" className="w-16 h-3" />
              </div>
            </div>
            <Skeleton variant="badge" />
          </div>
          <SkeletonText lines={2} />
          <div className="flex items-center justify-between pt-2 border-t border-surface-2/60">
            <Skeleton variant="text" className="w-20 h-3" />
            <Skeleton variant="text" className="w-12 h-3" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function SkeletonList({
  rows = 4,
  className = '',
}: {
  rows?: number;
  className?: string;
}) {
  return (
    <div className={`space-y-2.5 ${className}`}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="p-3 bg-surface-1/60 border border-surface-3/40 rounded-xl flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3 flex-1">
            <Skeleton variant="circular" className="w-9 h-9 shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton variant="text" className="w-1/3 h-4" />
              <Skeleton variant="text" className="w-2/3 h-3" />
            </div>
          </div>
          <Skeleton variant="badge" className="shrink-0" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonDetails({ className = '' }: { className?: string }) {
  return (
    <div className={`p-6 bg-surface-1/80 border border-surface-3/60 rounded-2xl space-y-6 ${className}`}>
      <div className="flex items-start justify-between gap-4 border-b border-surface-2/80 pb-5">
        <div className="space-y-2 flex-1">
          <Skeleton variant="text" className="w-1/2 h-7" />
          <div className="flex gap-2">
            <Skeleton variant="badge" />
            <Skeleton variant="badge" />
            <Skeleton variant="badge" />
          </div>
        </div>
        <Skeleton variant="rectangular" className="w-16 h-16 shrink-0 rounded-2xl" />
      </div>

      <div className="space-y-3">
        <Skeleton variant="text" className="w-1/4 h-4" />
        <SkeletonText lines={4} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-4 border-t border-surface-2/80">
        <div className="space-y-1">
          <Skeleton variant="text" className="w-16 h-3" />
          <Skeleton variant="text" className="w-24 h-4" />
        </div>
        <div className="space-y-1">
          <Skeleton variant="text" className="w-16 h-3" />
          <Skeleton variant="text" className="w-24 h-4" />
        </div>
        <div className="space-y-1">
          <Skeleton variant="text" className="w-16 h-3" />
          <Skeleton variant="text" className="w-24 h-4" />
        </div>
      </div>
    </div>
  );
}

export function SkeletonTabContent({
  type = 'cards',
  count = 3,
  className = '',
}: {
  type?: 'cards' | 'list' | 'details' | 'calendar' | 'map';
  count?: number;
  className?: string;
}) {
  if (type === 'list') return <SkeletonList rows={count} className={className} />;
  if (type === 'details') return <SkeletonDetails className={className} />;
  if (type === 'map') {
    return (
      <div className={`relative w-full h-[400px] bg-surface-1/70 border border-surface-3/60 rounded-2xl overflow-hidden p-6 flex flex-col justify-between ${className}`}>
        <div className="flex justify-between items-center">
          <Skeleton variant="text" className="w-40 h-6" />
          <div className="flex gap-2">
            <Skeleton variant="rectangular" className="w-8 h-8 rounded-lg" />
            <Skeleton variant="rectangular" className="w-8 h-8 rounded-lg" />
          </div>
        </div>
        <div className="absolute inset-0 m-auto w-32 h-32 rounded-full border border-surface-3/40 flex items-center justify-center">
          <Skeleton variant="circular" className="w-12 h-12" />
        </div>
        <div className="flex gap-2">
          <Skeleton variant="badge" />
          <Skeleton variant="badge" />
        </div>
      </div>
    );
  }
  if (type === 'calendar') {
    return (
      <div className={`p-4 bg-surface-1/70 border border-surface-3/60 rounded-2xl space-y-4 ${className}`}>
        <div className="flex justify-between items-center">
          <Skeleton variant="text" className="w-36 h-6" />
          <div className="flex gap-2">
            <Skeleton variant="rectangular" className="w-20 h-8 rounded-lg" />
            <Skeleton variant="rectangular" className="w-20 h-8 rounded-lg" />
          </div>
        </div>
        <div className="grid grid-cols-7 gap-2 pt-2">
          {Array.from({ length: 28 }).map((_, i) => (
            <Skeleton key={i} variant="rectangular" className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return <SkeletonCard count={count} className={className} />;
}

export function TabSkeletonContainer({
  isLoading,
  type = 'cards',
  count = 3,
  children,
}: {
  isLoading: boolean;
  type?: 'cards' | 'list' | 'details' | 'calendar' | 'map';
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="skeleton"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          <SkeletonTabContent type={type} count={count} />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
