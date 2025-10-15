import React from 'react'
import { 
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import ItemsPerPageSelector from './ItemsPerPageSelector'

type DashboardPaginationProps = {
  setItemsPerPage: (itemsPerPage: number) => void;
  setCurrentPage: (page: number) => void;
  currentPage: number;
  totalPages: number;
}

const DashboardPagination : React.FC<DashboardPaginationProps> = ({ setItemsPerPage, setCurrentPage, currentPage, totalPages }) => {

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages;

  // Render page numbers based on the rules:
  // 1. If total pages is 3 or fewer, show all pages
  // 2. Otherwise show: page 1, page 2 (only if current is 1-3), ellipsis, current page, ellipsis, last page
  const renderPageNumbers = () => {
    if (totalPages <= 3) {
      // Show all pages if 3 or fewer
      return Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
        <PaginationItem key={page}>
          <PaginationLink
            href='#'
            isActive={page === currentPage}
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(page);
            }}
          >
            {page}
          </PaginationLink>
        </PaginationItem>
      ));
    }

    // For 4+ pages
    const pages: (number | 'ellipsis-left' | 'ellipsis-right')[] = [];

    // Always show page 1
    pages.push(1);

    // Show page 2 only if current page is 1, 2, or 3
    if (currentPage <= 3) {
      pages.push(2);
    }

    // Show left ellipsis if current page is more than 3
    if (currentPage > 3) {
      pages.push('ellipsis-left');
    }

    // Show current page if it's not 1, 2, or last page
    if (currentPage > 2 && currentPage < totalPages) {
      pages.push(currentPage);
    }

    // Show right ellipsis if current page is less than totalPages - 1
    if (currentPage < totalPages - 1) {
      pages.push('ellipsis-right');
    }

    // Always show last page
    pages.push(totalPages);

    return pages.map((page, index) => {
      if (page === 'ellipsis-left' || page === 'ellipsis-right') {
        return (
          <PaginationItem key={`ellipsis-${index}`}>
            <PaginationEllipsis />
          </PaginationItem>
        );
      }

      return (
        <PaginationItem key={page}>
          <PaginationLink
            href='#'
            isActive={page === currentPage}
            onClick={(e) => {
              e.preventDefault();
              handlePageChange(page as number);
            }}
          >
            {page}
          </PaginationLink>
        </PaginationItem>
      );
    });
  };
  
  return (
    <div className='flex justify-between items-center px-4 py-1'>
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href='#'
              onClick={(e) => {
                e.preventDefault();
                if (canGoPrev) handlePageChange(currentPage - 1);
              }}
              className={!canGoPrev ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          {renderPageNumbers()}
          <PaginationItem>
            <PaginationNext
              href='#'
              onClick={(e) => {
                e.preventDefault();
                if (canGoNext) handlePageChange(currentPage + 1);
              }}
              className={!canGoNext ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      <div className='flex items-center gap-2'>
        <span className='text-sm whitespace-nowrap'>Items per page:</span>
        <ItemsPerPageSelector 
          setItemsPerPage={setItemsPerPage}
          setCurrentPage={setCurrentPage}
        />
      </div>
    </div>
  )
}

export default DashboardPagination