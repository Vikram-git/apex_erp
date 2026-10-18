import dayjs from 'dayjs';

const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactCurrencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  notation: 'compact',
  maximumFractionDigits: 1,
});

const quantityFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 3 });

export const formatCurrency = (value: number | null | undefined) => currencyFormatter.format(value ?? 0);
export const formatCompactCurrency = (value: number | null | undefined) => compactCurrencyFormatter.format(value ?? 0);
export const formatQuantity = (value: number | null | undefined) => quantityFormatter.format(value ?? 0);
export const formatDate = (value: string | null | undefined) => (value ? dayjs(value).format('DD MMM YYYY') : '—');
export const formatDateTime = (value: string | null | undefined) => (value ? dayjs(value).format('DD MMM YYYY, HH:mm') : '—');

export const PRODUCT_TYPE_LABELS: Record<string, string> = {
  raw_material: 'Raw Material',
  semi_finished: 'Semi-Finished',
  finished_good: 'Finished Good',
  consumable: 'Consumable',
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  opening: 'Opening Balance',
  purchase_receipt: 'Purchase Receipt',
  sales_delivery: 'Sales Delivery',
  adjustment: 'Adjustment',
  transfer_in: 'Transfer In',
  transfer_out: 'Transfer Out',
};
