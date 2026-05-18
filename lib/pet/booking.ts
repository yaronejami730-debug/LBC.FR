export function nightsBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 86_400_000));
}

export function hoursBetween(start: Date, end: Date): number {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.round(ms / 3_600_000));
}

export function bookingUnits(unit: string, start: Date, end: Date): number {
  return unit === "HOUR" ? hoursBetween(start, end) : nightsBetween(start, end);
}

export function bookingTotalCents(priceCents: number, unit: string, start: Date, end: Date, petCount: number): number {
  return priceCents * bookingUnits(unit, start, end) * Math.max(1, petCount);
}
