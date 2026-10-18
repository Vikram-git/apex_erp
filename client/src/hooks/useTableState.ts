import type { TablePaginationConfig } from 'antd';
import { useCallback, useState } from 'react';

export function useTableState(initialPageSize = 20) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [search, setSearchState] = useState('');

  const setSearch = useCallback((value: string) => {
    setSearchState(value);
    setPage(1);
  }, []);

  const pagination = (total: number | undefined): TablePaginationConfig => ({
    current: page,
    pageSize,
    total: total ?? 0,
    showSizeChanger: true,
    pageSizeOptions: [10, 20, 50, 100],
    showTotal: (t, [from, to]) => `${from}–${to} of ${t}`,
    onChange: (p, ps) => {
      setPage(ps !== pageSize ? 1 : p);
      setPageSize(ps);
    },
  });

  return { page, pageSize, search, setSearch, setPage, pagination };
}
