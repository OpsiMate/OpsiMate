import type { Alert } from "@OpsiMate/shared";

export const getAlertServiceId = (a: Alert): number | undefined => {
  const anyA = a as any;
  if (typeof anyA.serviceId === 'number') return anyA.serviceId;

  const parts = a.id.split(':');         // "fingerprint:123"
  const n = Number(parts[1]);
  return Number.isFinite(n) ? n : undefined;
};