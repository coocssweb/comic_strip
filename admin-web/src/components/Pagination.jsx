import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from "@/utils/cn";
import {
  Pagination as ShadcnPagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
} from "./ui/pagination";
import FormSelect from './FormSelect';

const Pagination = ({
  page,
  limit,
  total,
  totalPages,
  onChange,
  limitOptions = [10, 20, 50, 100]
}) => {


  if (total === 0) return null;

  const getPageNumbers = () => {
    const pages = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else if (page <= 4) {
      pages.push(1, 2, 3, 4, 5, '...', totalPages);
    } else if (page >= totalPages - 3) {
      pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
    } else {
      pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
    }

    return pages;
  };

  const scrollToTop = () => {
    if (typeof window !== 'undefined' && typeof window.scrollTo === 'function') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const changePage = (nextPage, nextLimit = limit) => {
    onChange(nextPage, nextLimit);
    scrollToTop();
  };

  const handlePageClick = (p) => {
    if (p === '...' || p === page) return;
    changePage(p);
  };

  const handlePrev = () => {
    if (page > 1) {
      changePage(page - 1);
    }
  };

  const handleNext = () => {
    if (page < totalPages) {
      changePage(page + 1);
    }
  };





  const startItem = (page - 1) * limit + 1;
  const endItem = Math.min(page * limit, total);
  const pageNumbers = getPageNumbers();

  return (
    <div className="flex w-full flex-col gap-3 border-t border-border bg-card px-1 py-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-0">
      <div className="whitespace-nowrap text-xs font-medium">
        显示 <span className="font-semibold text-foreground">{startItem}-{endItem}</span> / <span className="font-semibold text-foreground">{total}</span>
      </div>

      <ShadcnPagination className="mx-0 w-auto justify-center">
        <PaginationContent>
          {/* 上一页 */}
          <PaginationItem>
            <PaginationLink
              asChild
              isActive={false}
              onClick={handlePrev}
              disabled={page === 1}
              className={cn(
                "h-9 w-9 rounded-full p-0 cursor-pointer text-muted-foreground focus-visible:ring-primary/30",
                page === 1 ? "pointer-events-none opacity-50" : ""
              )}
              title="上一页"
              aria-label="上一页"
            >
              <button type="button">
                <ChevronLeft className="h-4 w-4" />
              </button>
            </PaginationLink>
          </PaginationItem>

          {/* 页码与省略号 */}
          {pageNumbers.map((num, index) => {
            if (num === '...') {
              return (
                <PaginationItem key={`ellipsis-${index}`}>
                  <PaginationEllipsis className="h-9 w-9 text-muted-foreground/60" />
                </PaginationItem>
              );
            }

            const isActive = num === page;

            return (
              <PaginationItem key={`page-${num}`}>
                <PaginationLink
                  asChild
                  isActive={isActive}
                  onClick={() => handlePageClick(num)}
                  className={cn(
                    "h-9 w-9 rounded-full text-xs font-semibold p-0 cursor-pointer focus-visible:ring-primary/30",
                    isActive
                      ? 'bg-secondary text-primary hover:bg-secondary hover:text-primary border-none'
                      : 'text-muted-foreground'
                  )}
                >
                  <button type="button">
                    {num}
                  </button>
                </PaginationLink>
              </PaginationItem>
            );
          })}

          {/* 下一页 */}
          <PaginationItem>
            <PaginationLink
              asChild
              isActive={false}
              onClick={handleNext}
              disabled={page === totalPages}
              className={cn(
                "h-9 w-9 rounded-full p-0 cursor-pointer text-muted-foreground focus-visible:ring-primary/30",
                page === totalPages ? "pointer-events-none opacity-50" : ""
              )}
              title="下一页"
              aria-label="下一页"
            >
              <button type="button">
                <ChevronRight className="h-4 w-4" />
              </button>
            </PaginationLink>
          </PaginationItem>
        </PaginationContent>
      </ShadcnPagination>

      <div className="flex flex-wrap items-center justify-center gap-3 sm:justify-end">
        <label className="flex items-center gap-2 text-xs font-medium">
          <span>每页</span>
          <FormSelect
            value={limit}
            onChange={(newLimit) => changePage(1, newLimit)}
            options={limitOptions.map((opt) => ({
              label: `${opt} 条/页`,
              value: opt,
            }))}
            size="sm"
            className="w-[96px]"
          />
        </label>


      </div>
    </div>
  );
};

export default Pagination;
