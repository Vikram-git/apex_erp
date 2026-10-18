import type { ThemeConfig } from 'antd';

export const BRAND = {
  primary: '#ea580c',
  primaryLight: '#fb923c',
  primaryDark: '#c2410c',
  charcoal: '#1c1917',
  charcoalDeep: '#131110',
  charcoalSoft: '#292524',
  slate: '#57534e',
  background: '#f5f5f4',
} as const;

export const CHART_COLORS = {
  sales: BRAND.primary,
  purchases: BRAND.slate,
};

export const KPI_COLORS = {
  sales: BRAND.primary,
  purchases: '#0891b2',
  inventory: '#16a34a',
  products: BRAND.slate,
};

export const theme: ThemeConfig = {
  token: {
    colorPrimary: BRAND.primary,
    colorLink: BRAND.primaryDark,
    colorInfo: BRAND.primary,
    borderRadius: 6,
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  components: {
    Layout: { siderBg: BRAND.charcoal, headerBg: '#ffffff', bodyBg: BRAND.background },
    Menu: {
      darkItemBg: BRAND.charcoal,
      darkSubMenuItemBg: BRAND.charcoalDeep,
      darkItemSelectedBg: BRAND.primary,
      darkItemHoverBg: BRAND.charcoalSoft,
    },
    Table: { headerBg: '#fafaf9' },
  },
};
