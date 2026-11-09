# Changelog

All notable changes to this project are documented in this file.
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [Unreleased]

## [0.1.0] - Unreleased

First release.

### Added

- API (`GET /query`, `/datasets`, `/keys`) on AWS Lambda (Node.js 24, arm64), deployed with the AWS CDK
- One configuration file, `config/datasets.yaml`, validated at `cdk synth` time
  - Prefixed partition keys (`template`), composite sort keys (`prefix`), date-split partition keys (`bucket`, `timezone`), GSIs (`index`)
  - Time formats: `epoch_s`, `epoch_ms`, `iso8601` (with time zone handling)
  - Allowed keys (`keys.pattern`, `keys.values`) and key lists for Grafana variables (`keys.list`)
  - Attribute allow list, type conversion, aliases, units, scaling, nested attributes
  - Limits (`maxRange`, `maxItems`, `maxPages`, `maxRcu`, `maxKeys`) and response cache (`cacheTtlSeconds`)
- Query parameters: `interval` / `agg` (downsampling), `latest`, `format` (long / wide), `tz`, `fields`
- Guardrails: truncation with `meta.truncatedBy`, a response size limit (5.5 MB) with an actionable error, a clear error when Grafana variables are not replaced (alerting)
- Structured JSON logs (one line per request, with the Lambda request ID)
- Deploy options: `exposure` (`restPublic`, `functionUrl`, `restPrivate`), `auth` (`iam`, `apiKey`), `grafanaUser`, `grafanaRoleTrust`, `logRetentionDays`, `throttleRate`, `throttleBurst`, `sample`
- Scripts: `pnpm seed`, `pnpm init-dataset`, `pnpm check`, `pnpm grafana-config`, `pnpm local-api`
- Sample data with day-to-day weather, weekday air conditioning, per-room differences, heat spikes, and gaps
- Local Grafana setup (Grafana OSS 13.3.0 + Infinity 4.1.5) with a sample dashboard (time series, gauge, bar gauge, bar chart, table) and alert rule
- Documentation in English and Japanese
- Tests (Vitest): unit, CDK template, and DynamoDB Local integration tests; CI on GitHub Actions
