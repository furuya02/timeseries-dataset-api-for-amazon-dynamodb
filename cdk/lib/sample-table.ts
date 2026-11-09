import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cdk from 'aws-cdk-lib/core';
import type { Construct } from 'constructs';
import { SAMPLE_TABLE } from './constants';

/** サンプルテーブル（-c sample=true）。オンデマンド課金で、cdk destroy で一緒に消える */
export function createSampleTable(scope: Construct): dynamodb.TableV2 {
  return new dynamodb.TableV2(scope, 'SampleTable', {
    tableName: SAMPLE_TABLE,
    partitionKey: { name: 'deviceId', type: dynamodb.AttributeType.STRING },
    sortKey: { name: 'ts', type: dynamodb.AttributeType.NUMBER },
    billing: dynamodb.Billing.onDemand(),
    removalPolicy: cdk.RemovalPolicy.DESTROY,
  });
}
