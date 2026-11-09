import { describe, expect, it } from 'vitest';
import { ConfigError } from '../../lib/config';
import { readOptions } from '../../lib/options';

const read = (ctx: Record<string, unknown>) => readOptions((k) => ctx[k]);
const errorOf = (ctx: Record<string, unknown>): string => {
  try {
    read(ctx);
    return 'no error';
  } catch (e) {
    if (!(e instanceof ConfigError)) throw e;
    return e.message;
  }
};

describe('readOptions', () => {
  it('既定値', () => {
    expect(read({})).toEqual({
      exposure: 'restPublic',
      auth: 'iam',
      vpcEndpointId: undefined,
      grafanaUser: false,
      grafanaRoleTrust: undefined,
      logRetentionDays: 7,
      throttleRate: 10,
      throttleBurst: 20,
      sample: false,
    });
  });

  it('-c の値は文字列で届くので変換する', () => {
    expect(read({ exposure: 'functionUrl', grafanaUser: 'true', sample: 'true', logRetentionDays: '30' })).toMatchObject({
      exposure: 'functionUrl',
      grafanaUser: true,
      sample: true,
      logRetentionDays: 30,
    });
    expect(read({ exposure: 'restPrivate', vpcEndpointId: 'vpce-0123456789abcdef0', auth: 'apiKey', throttleRate: '5' })).toMatchObject({ throttleRate: 5 });
  });

  it.each([
    [{ exposure: 'lambda' }, '-c exposure=lambda: restPublic / functionUrl / restPrivate のいずれか'],
    [{ auth: 'basic' }, '-c auth=basic: iam / apiKey のいずれか'],
    [{ logRetentionDays: '10' }, '-c logRetentionDays=10'],
    [{ throttleRate: '0' }, '-c throttleRate=0: 1 以上の整数'],
    [{ exposure: 'functionUrl', auth: 'apiKey' }, 'auth=apiKey は REST API'],
    [{ exposure: 'restPrivate' }, 'vpcEndpointId=vpce-xxxx'],
    [{ vpcEndpointId: 'vpce-0123456789abcdef0' }, 'vpcEndpointId は exposure=restPrivate のときだけ'],
    [{ exposure: 'restPrivate', vpcEndpointId: 'abc' }, 'vpce- で始まる ID'],
    [{ grafanaRoleTrust: 'foo' }, 'IAM ロール / ユーザー / アカウント（:root）の ARN'],
    [{ auth: 'apiKey', grafanaUser: 'true' }, 'auth=iam のときだけ使えます'],
  ])('%j → %s', (ctx, expected) => {
    expect(errorOf(ctx)).toContain(expected);
  });

  it('誤りはまとめて表示する', () => {
    const msg = errorOf({ exposure: 'functionUrl', auth: 'apiKey', logRetentionDays: '10', grafanaRoleTrust: 'foo' });
    expect(msg.split('\n').filter((l) => l.startsWith('  - '))).toHaveLength(4);
  });

  it('grafanaRoleTrust はロール・ユーザー・アカウントの ARN を受け付ける', () => {
    for (const arn of ['arn:aws:iam::123456789012:role/x', 'arn:aws:iam::123456789012:user/y', 'arn:aws:iam::123456789012:root']) {
      expect(read({ grafanaRoleTrust: arn }).grafanaRoleTrust).toBe(arn);
    }
  });
});
