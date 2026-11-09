// ---------------------------------------------------------------
// サンプルデータの投入
//   pnpm seed                       … cdk deploy -c sample=true で作ったテーブルに、7 日分を投入
//   pnpm seed --days 1 --rooms 2    … 期間と部屋数を変える
//   pnpm seed --create              … テーブルがなければ作る（DynamoDB Local で試すとき）
// ---------------------------------------------------------------
import { parseArgs } from 'node:util';
import { CreateTableCommand, DescribeTableCommand, DynamoDBClient, ResourceNotFoundException } from '@aws-sdk/client-dynamodb';
import { BatchWriteCommand, DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import { generateItems, roomIds } from './lib/seed-data.ts';

const { values: args } = parseArgs({
  options: {
    table: { type: 'string', default: 'timeseries-dataset-api-sample' },
    days: { type: 'string', default: '7' },
    step: { type: 'string', default: '1' }, // 分
    rooms: { type: 'string', default: '3' },
    create: { type: 'boolean', default: false },
  },
});
const table = args.table;
const raw = new DynamoDBClient({ region: process.env.AWS_REGION ?? 'ap-northeast-1' });
const doc = DynamoDBDocumentClient.from(raw);

async function ensureTable(): Promise<void> {
  try {
    await raw.send(new DescribeTableCommand({ TableName: table }));
  } catch (e) {
    if (!(e instanceof ResourceNotFoundException)) throw e;
    if (!args.create)
      throw new Error(`テーブル ${table} がありません。cdk deploy -c sample=true でデプロイするか、DynamoDB Local では --create を付けてください`);
    await raw.send(
      new CreateTableCommand({
        TableName: table,
        BillingMode: 'PAY_PER_REQUEST',
        AttributeDefinitions: [
          { AttributeName: 'deviceId', AttributeType: 'S' },
          { AttributeName: 'ts', AttributeType: 'N' },
        ],
        KeySchema: [
          { AttributeName: 'deviceId', KeyType: 'HASH' },
          { AttributeName: 'ts', KeyType: 'RANGE' },
        ],
      }),
    );
    console.log(`テーブル ${table} を作りました`);
  }
}

/** 25 件ずつ 8 並列で書き込む。処理されなかった分（UnprocessedItems）は待ってから書き直す */
async function writeAll(items: Record<string, unknown>[]): Promise<void> {
  type Put = { PutRequest: { Item: Record<string, unknown> } };
  const batches: Put[][] = [];
  for (let i = 0; i < items.length; i += 25) batches.push(items.slice(i, i + 25).map((Item) => ({ PutRequest: { Item } })));
  let next = 0;
  let done = 0;
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (next < batches.length) {
        let requests = batches[next++];
        for (let attempt = 0; requests.length > 0; attempt++) {
          if (attempt > 0) await new Promise((ok) => setTimeout(ok, Math.min(100 * 2 ** attempt, 5000)));
          const r = await doc.send(new BatchWriteCommand({ RequestItems: { [table]: requests } }));
          requests = (r.UnprocessedItems?.[table] ?? []) as Put[];
        }
        done += 25;
        if (done % 5000 === 0) console.log(`  ${done} / ${items.length}`);
      }
    }),
  );
}

await ensureTable();
const rooms = Number(args.rooms);
const { items, start, end } = generateItems({ rooms, days: Number(args.days), stepMs: Number(args.step) * 60_000, end: Date.now() });
console.log(`${table} に ${items.length} 件を書き込みます（${roomIds(rooms).join(', ')}、${args.days} 日分、${args.step} 分おき）`);
await writeAll(items);
console.log(`完了しました: ${new Date(start).toISOString()} 〜 ${new Date(end).toISOString()}`);
