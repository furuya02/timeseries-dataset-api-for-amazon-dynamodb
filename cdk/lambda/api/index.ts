// ---------------------------------------------------------------
// Lambda の入口
// REST API（ペイロード 1.0 の event.path）と関数 URL（2.0 の event.rawPath）の両方を受ける
// ---------------------------------------------------------------
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';
import type { APIGatewayProxyEvent, APIGatewayProxyEventV2, APIGatewayProxyResult, Context } from 'aws-lambda';
import { createApi, writeLog } from './app';
import { ResponseCache } from './cache';
// cdk synth のときに、検証済みの config/datasets.yaml から生成される
import generated from './datasets.generated.json';
import type { Datasets } from './types';

const datasets: Datasets = generated;
const client = DynamoDBDocumentClient.from(new DynamoDBClient({}));
// キャッシュは実行環境（コンテナ）の寿命の間、リクエストをまたいで使う
const cache = new ResponseCache();

export const handler = async (event: APIGatewayProxyEvent | APIGatewayProxyEventV2, context: Context): Promise<APIGatewayProxyResult> => {
  const path = 'rawPath' in event ? event.rawPath : event.path;
  // ログにリクエスト ID を付け、同じロググループの REPORT 行（所要時間・メモリ）と突き合わせられるようにする
  const log = (line: Record<string, unknown>) => writeLog({ requestId: context.awsRequestId, ...line });
  const api = createApi({ datasets, client, cache, log });
  const { status, body, headers } = await api.handle(path, event.queryStringParameters ?? {});
  return { statusCode: status, headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) };
};
