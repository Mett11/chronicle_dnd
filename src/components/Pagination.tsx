import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  pageSize?: number;
  onPageSizeChange?: (newSize: number) => void;
  pageSizeOptions?: number[];
  totalItems?: number;
  compact?: boolean;
}

export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [5, 10, 20],
  totalItems,
  compact = false,
}: PaginationProps) {
  if (totalPages <= 1 && !onPageSizeChange && totalItems === undefined) return null;

  // Calculate pages window for display
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, '...', totalPages];
    }
    if (currentPage >= totalPages - 3) {
      return [1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }
    return [1, '...', currentPage - 1, currentPage, currentPage + 1, '...', totalPages];
  };

  const pages = getPageNumbers();

  const startIdx = pageSize && totalItems !== undefined ? (currentPage - 1) * pageSize + 1 : null;
  const endIdx = pageSize && totalItems !== undefined ? Math.min(currentPage * pageSize, totalItems) : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`flex flex-wrap items-center justify-between gap-3 pt-3 text-xs ${
        compact ? 'border-t border-surface-3/60' : 'border-t border-surface-2 mt-4'
      }`}
    >
      {/* Total Items and Page Size Selector */}
      <div className="flex items-center gap-2 text-content-3 text-[11px]">
        {totalItems !== undefined && (
          <span>
            {startIdx && endIdx ? (
              <>
                <strong className="text-content-2">{startIdx}-{endIdx}</strong> di <strong className="text-content-2">{totalItems}</strong>
              </>
            ) : (
              <>Totale: <strong className="text-content-2">{totalItems}</strong></>
            )}
          </span>
        )}

        {onPageSizeChange && pageSize && (
          <div className="flex items-center gap-1.5 ml-1">
            <span className="hidden sm:inline text-content-3">Mostra:</span>
            <div className="flex items-center bg-surface-2 rounded-lg p-0.5 border border-surface-3">
              {pageSizeOptions.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => onPageSizeChange(opt)}
                  className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-medium transition-colors cursor-pointer ${
                    pageSize === opt
                      ? 'bg-primary text-surface-0 font-bold shadow-xs'
                      : 'text-content-3 hover:text-content-1'
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pages Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1 ml-auto">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            title="Pagina precedente"
            className="w-7 h-7 rounded-lg bg-surface-2 border border-surface-3 text-content-2 hover:text-primary hover:border-primary/50 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1">
            {pages.map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`dots-${idx}`} className="w-5 text-center text-content-3 text-[10px]">
                    ...
                  </span>
                );
              }
              const pageNum = Number(p);
              const isActive = currentPage === pageNum;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => onPageChange(pageNum)}
                  className={`min-w-[28px] h-7 px-1.5 rounded-lg flex items-center justify-center text-[11px] font-medium font-mono transition-all cursor-pointer ${
                    isActive
                      ? 'bg-primary text-surface-0 font-bold shadow-xs'
                      : 'bg-surface-2 border border-surface-3 text-content-2 hover:text-content-1 hover:border-surface-3/80'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            title="Pagina successiva"
            className="w-7 h-7 rounded-lg bg-surface-2 border border-surface-3 text-content-2 hover:text-primary hover:border-primary/50 disabled:opacity-30 disabled:pointer-events-none transition-all flex items-center justify-center cursor-pointer"
          >
            <ChevronRight size={14} />
          </button>
        </div>
      )}
    </motion.div>
  );
}
