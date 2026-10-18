import { boolean, index, integer, pgTable, text, uuid, varchar } from 'drizzle-orm/pg-core';
import { money, timestamps } from './common.js';

const partyColumns = () => ({
  id: uuid().primaryKey().defaultRandom(),
  code: varchar({ length: 20 }).notNull().unique(),
  name: varchar({ length: 200 }).notNull(),
  contactPerson: varchar({ length: 150 }),
  email: varchar({ length: 255 }),
  phone: varchar({ length: 30 }),
  taxId: varchar({ length: 30 }),
  address: text(),
  paymentTermsDays: integer().notNull().default(30),
  isActive: boolean().notNull().default(true),
  ...timestamps,
});

export const customers = pgTable(
  'customers',
  {
    ...partyColumns(),
    creditLimit: money().notNull().default(0),
  },
  (t) => [index('customers_name_idx').on(t.name)],
);

export const suppliers = pgTable('suppliers', partyColumns(), (t) => [
  index('suppliers_name_idx').on(t.name),
]);
