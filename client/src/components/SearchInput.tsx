import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';
import { useEffect, useState } from 'react';

interface SearchInputProps {
  onSearch: (value: string) => void;
  placeholder?: string;
  width?: number;
}

/** Debounced search box so typing does not fire a request per keystroke. */
export function SearchInput({ onSearch, placeholder = 'Search…', width = 280 }: SearchInputProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    const handle = setTimeout(() => onSearch(value.trim()), 350);
    return () => clearTimeout(handle);
  }, [value, onSearch]);

  return (
    <Input
      allowClear
      prefix={<SearchOutlined />}
      placeholder={placeholder}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      style={{ width }}
    />
  );
}
