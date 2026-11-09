// ---------------------------------------------------------------
// /query の応答の組み立て
// ---------------------------------------------------------------
import { aggregate, shape } from './aggregate';
import { ApiError } from './errors';
import type { QueryRequest, ReadResult } from './types';

/** Lambda の同期呼び出しの応答上限（6MB）に余裕を持たせた値 */
export const MAX_RESPONSE_BYTES = 5_500_000;

/**
 * 応答。Infinity では rows を行として読む（Rows / Root に rows を指定）。
 * columns は列の型と単位、meta は打ち切り（truncated）や消費 RCU の確認用
 */
export function toResponse(req: QueryRequest, result: ReadResult) {
  const rows = req.interval === undefined ? result.rows : aggregate(result.rows, req.columns, req.interval, req.agg, req.tz);
  const counted = req.interval !== undefined && req.agg === 'count';
  return {
    rows: shape(rows, req.format),
    columns: req.columns.map((c) => ({
      name: c.column,
      type: counted ? 'number' : c.field.type,
      unit: counted ? undefined : c.field.unit,
    })),
    meta: {
      dataset: req.name,
      ...result.meta,
      points: rows.length,
      interval: req.interval,
      agg: req.interval === undefined ? undefined : req.agg,
    },
  };
}

export type QueryResponse = ReturnType<typeof toResponse>;

/**
 * 応答の大きさ（バイト数）を確かめる。
 * 上限を超えると API Gateway が 502 になり理由がわからないため、手前で理由つきの 400 にする
 */
export function measureResponse(body: QueryResponse, maxBytes = MAX_RESPONSE_BYTES): number {
  const bytes = Buffer.byteLength(JSON.stringify(body));
  if (bytes > maxBytes) {
    throw new ApiError(
      400,
      `応答が大きすぎます（${(bytes / 1e6).toFixed(1)}MB、上限 ${maxBytes / 1e6}MB）。interval で集計する、期間を短くする、fields で列を減らす、のいずれかを試してください`,
    );
  }
  return bytes;
}
