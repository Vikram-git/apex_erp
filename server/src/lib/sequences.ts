import { sql } from 'drizzle-orm';
import type { DbOrTx } from '../db/index.js';
import { documentSequences } from '../db/schema/index.js';

async function nextValue(tx: DbOrTx, prefix: string, year: number): Promise<number> {
  const [row] = await tx
    .insert(documentSequences)
    .values({ prefix, year, lastNumber: 1 })
    .onConflictDoUpdate({
      target: [documentSequences.prefix, documentSequences.year],
      set: { lastNumber: sql`${documentSequences.lastNumber} + 1` },
    })
    .returning({ lastNumber: documentSequences.lastNumber });

  if (!row) throw new Error(`Failed to allocate sequence for ${prefix}`);
  return row.lastNumber;
}

/** Yearly document number, e.g. SO-2026-00042. Gap-free within a committed transaction. */
export async function nextDocumentNumber(tx: DbOrTx, prefix: string): Promise<string> {
  const year = new Date().getFullYear();
  const value = await nextValue(tx, prefix, year);
  return `${prefix}-${year}-${String(value).padStart(5, '0')}`;
}

/** Non-yearly master data code, e.g. CUS-00042. */
export async function nextMasterCode(tx: DbOrTx, prefix: string): Promise<string> {
  const value = await nextValue(tx, prefix, 0);
  return `${prefix}-${String(value).padStart(5, '0')}`;
}
