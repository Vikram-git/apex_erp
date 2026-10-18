export const round2 = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
export const round3 = (value: number) => Math.round((value + Number.EPSILON) * 1000) / 1000;

export interface LineInput {
  productId: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface ComputedLine extends LineInput {
  lineNo: number;
  lineSubtotal: number;
  lineTax: number;
  lineTotal: number;
}

export function computeDocumentTotals(lines: LineInput[]) {
  const computed: ComputedLine[] = lines.map((line, index) => {
    const lineSubtotal = round2(line.quantity * line.unitPrice);
    const lineTax = round2((lineSubtotal * line.taxRate) / 100);
    return {
      ...line,
      lineNo: index + 1,
      lineSubtotal,
      lineTax,
      lineTotal: round2(lineSubtotal + lineTax),
    };
  });

  const subtotal = round2(computed.reduce((sum, l) => sum + l.lineSubtotal, 0));
  const taxTotal = round2(computed.reduce((sum, l) => sum + l.lineTax, 0));

  return { lines: computed, subtotal, taxTotal, total: round2(subtotal + taxTotal) };
}
