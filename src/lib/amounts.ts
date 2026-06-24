const DECIMAL_RE = /^\d+(\.\d+)?$/;

export function decimalToAtomic(value: string, decimals: number): string {
  const trimmed = value.trim();
  if (!DECIMAL_RE.test(trimmed)) {
    throw new Error("Enter a valid positive amount");
  }

  const [whole, fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new Error(`Amount supports up to ${decimals} decimal places`);
  }

  const scale = BigInt(10) ** BigInt(decimals);
  const wholeAtomic = BigInt(whole) * scale;
  const fractionAtomic = BigInt((fraction + "0".repeat(decimals)).slice(0, decimals) || "0");
  const total = wholeAtomic + fractionAtomic;

  if (total <= BigInt(0)) {
    throw new Error("Enter an amount greater than zero");
  }

  return total.toString();
}

export function atomicToDecimalString(raw: string, decimals: number, maxFraction = decimals): string {
  const value = BigInt(raw);
  const scale = BigInt(10) ** BigInt(decimals);
  const whole = value / scale;
  const fraction = value % scale;
  const padded = fraction.toString().padStart(decimals, "0").slice(0, maxFraction);
  const trimmed = padded.replace(/0+$/, "");
  return trimmed ? `${whole.toString()}.${trimmed}` : whole.toString();
}

export function decimalToNumber(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    throw new Error("Invalid numeric value");
  }
  return parsed;
}
