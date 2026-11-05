export type ManualLine = { item: 'gateau-cupcake-basic' | 'smore-stick'; quantity: number }
export type ManualOrder = {
  version: 'manual-order.v1'; source: 'admin'; currency: 'AUD'; reason: 'owner-approved-off-menu';
  audit: { operatorId: string; reference: string; createdAt: string };
  lines: ManualLine[]; totalPriceCents: number;
}
export const MANUAL_ORDER_VERSION: 'manual-order.v1'
export const MANUAL_ORDER_PRODUCT_ID: 'manual-order'
export function isManualOrderDocument(document: unknown): boolean
export function validateManualOrder(value: unknown): ManualOrder
export function buildManualOrderData(input: ManualOrder): Record<string, unknown>
export function readManualOrder(document: unknown): ManualOrder
export function manualLineSummary(line: unknown): string
export function manualOrderSummary(order: unknown): string
export function manualReservationProjection(document: unknown): Record<string, unknown>
export function assertNotManualOrder(document: unknown): void
export function assertManualOrderEditAllowed(edits: unknown): void
