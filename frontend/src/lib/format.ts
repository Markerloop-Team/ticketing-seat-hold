const money = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });

export function formatPrice(value: string | number): string {
  return `${money.format(Number(value))} ₸`;
}
