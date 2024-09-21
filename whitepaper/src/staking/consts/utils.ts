import Big from "big.js";

export function toPercents(num: number | string | Big): string {
  return Big(num).mul(100).toFixed(2);
}