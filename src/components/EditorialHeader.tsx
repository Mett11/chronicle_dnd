import React from 'react';

interface EditorialHeaderProps {
  title: string;
  badgeText?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}

export function EditorialHeader({
  title,
  badgeText,
  subtitle,
  actions,
  icon,
  className = '',
}: EditorialHeaderProps) {
  return (
    <header className={`w-full bg-surface-1/70 border-b border-surface-2 relative overflow-hidden shrink-0 ${className}`}>
      {/* Subtle, non-overpowering theme accent gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/15 via-primary/5 to-transparent pointer-events-none" />

      <div className="max-w-[1700px] mx-auto w-full px-4 sm:px-8 lg:px-10 py-5 sm:py-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
        <div className="flex items-center gap-3.5 min-w-0">
          {icon && (
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary border border-primary/20 shrink-0 shadow-2xs">
              {icon}
            </div>
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="font-serif font-bold text-xl sm:text-2xl md:text-3xl text-content-1 tracking-tight">
                {title}
              </h1>
              {badgeText && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-semibold bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {badgeText}
                </span>
              )}
            </div>
            {subtitle && (
              <p className="text-xs sm:text-sm text-content-2 font-mono mt-1 leading-relaxed max-w-3xl">
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
