import { numeric, timestamp } from 'drizzle-orm/pg-core';

export const timestamps = {
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
};

export const money = () => numeric({ precision: 14, scale: 2, mode: 'number' });
export const quantity = () => numeric({ precision: 14, scale: 3, mode: 'number' });
export const percent = () => numeric({ precision: 5, scale: 2, mode: 'number' });
