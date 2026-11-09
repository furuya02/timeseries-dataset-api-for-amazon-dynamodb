// ---------------------------------------------------------------
// ダウンサンプリング（集計）と出力形式
// ---------------------------------------------------------------
import { compareRows } from './rows';
import { bucketStart } from './time';
import { round } from './transform';
import type { Agg, Column, Format, Row } from './types';

/**
 * キー × 区切りごとに集計する。欠損（null）は除く。
 * 数値以外の列は avg / min / max / sum のとき最後の値を返す。count は列の型に関係なく件数
 */
export function aggregate(rows: Row[], columns: Column[], interval: number, agg: Agg, tz: string): Row[] {
  const groups = new Map<string, { time: number; key: string; rows: Row[] }>();
  for (const r of rows) {
    const time = bucketStart(r.time, interval, tz);
    const id = `${r.key}\u0000${time}`;
    const g = groups.get(id);
    if (g) g.rows.push(r);
    else groups.set(id, { time, key: r.key, rows: [r] });
  }
  const out: Row[] = [];
  for (const g of groups.values()) {
    const values: Record<string, unknown> = {};
    for (const { column, field } of columns) {
      const vs = g.rows.map((r) => r.values[column]).filter((v) => v !== null && v !== undefined);
      values[column] = reduce(vs, agg, field.type === 'number');
    }
    out.push({ time: g.time, key: g.key, values });
  }
  return out.sort(compareRows);
}

function reduce(vs: unknown[], agg: Agg, numeric: boolean): unknown {
  if (agg === 'count') return vs.length;
  if (vs.length === 0) return null;
  if (agg === 'last' || !numeric) return vs[vs.length - 1];
  const ns = vs as number[];
  switch (agg) {
    case 'sum':
      return round(ns.reduce((a, b) => a + b, 0));
    case 'avg':
      return round(ns.reduce((a, b) => a + b, 0) / ns.length);
    case 'min':
      return round(Math.min(...ns));
    case 'max':
      return round(Math.max(...ns));
  }
}

/**
 * 行を応答の形にする。
 * long: 1 行 = 時刻 × キー / wide: 1 行 = 時刻、列 = キー_列名（値がない列は null で埋め、全行の列をそろえる）
 */
export function shape(rows: Row[], format: Format): Record<string, unknown>[] {
  if (format === 'long') return rows.map((r) => ({ time: r.time, key: r.key, ...r.values }));
  const byTime = new Map<number, Record<string, unknown>>();
  for (const r of rows) {
    let o = byTime.get(r.time);
    if (!o) {
      o = {};
      byTime.set(r.time, o);
    }
    for (const [c, v] of Object.entries(r.values)) o[`${r.key}_${c}`] = v;
  }
  const names = [...new Set(rows.flatMap((r) => Object.keys(r.values).map((c) => `${r.key}_${c}`)))];
  return [...byTime].map(([time, o]) => Object.fromEntries([['time', time], ...names.map((n) => [n, o[n] ?? null])]));
}
