import { integer, pgTable, primaryKey, varchar } from 'drizzle-orm/pg-core';

export const documentSequences = pgTable(
  'document_sequences',
  {
    prefix: varchar({ length: 10 }).notNull(),
    year: integer().notNull(),
    lastNumber: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.prefix, t.year] })],
);
