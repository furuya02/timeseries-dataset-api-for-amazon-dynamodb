import * as cdk from 'aws-cdk-lib/core';
import type { Construct } from 'constructs';
import { createApiFunction } from './api-function';
import type { ResolvedDataset } from './config';
import { createEndpoint } from './endpoint';
import { createGrafanaAccess } from './grafana-access';
import type { DeployOptions } from './options';
import { createSampleTable } from './sample-table';

export interface TimeseriesDatasetApiStackProps extends cdk.StackProps {
  /** 検証済みの config/datasets.yaml */
  datasets: Record<string, ResolvedDataset>;
  /** デプロイオプション（cdk deploy -c 名前=値） */
  options: DeployOptions;
}

/**
 * Lambda（API）と公開形態ごとの入口、Grafana 用の IAM、サンプルテーブルをまとめたスタック。
 * 各部品はスタックを scope として直接作る（子のコンストラクトにすると論理 ID が変わり、既存の環境でリソースが置き換わるため）
 */
export class TimeseriesDatasetApiStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: TimeseriesDatasetApiStackProps) {
    super(scope, id, props);
    const o = props.options;

    const fn = createApiFunction(this, { datasets: props.datasets, logRetentionDays: o.logRetentionDays });
    if (o.sample) createSampleTable(this);
    const endpoint = createEndpoint(this, fn, o);
    new cdk.CfnOutput(this, 'Endpoint', { value: endpoint.url, description: 'Infinity の URL に設定するベース URL（末尾に query?... を付ける）' });
    if (o.auth === 'iam') createGrafanaAccess(this, endpoint.invokeStatements, o);
    new cdk.CfnOutput(this, 'Region', { value: this.region, description: 'Infinity の AWS 認証に設定するリージョン' });
  }
}
