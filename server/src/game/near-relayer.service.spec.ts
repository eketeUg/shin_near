import * as nodemailer from 'nodemailer';
import { NearRelayerService } from './near-relayer.service';

describe('NearRelayerService gas alerts', () => {
  const originalEnv = process.env;
  let sendMailMock: jest.Mock;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      SMTP_USER: 'smtp@example.com',
      SMTP_PASS: 'secret',
      ADMIN_ALERT_EMAIL: 'admin@example.com',
      RELAYER_LOW_GAS_THRESHOLD_NEAR: '1.0',
      RELAYER_CRITICAL_GAS_THRESHOLD_NEAR: '0.2',
      RELAYER_ALERT_COOLDOWN_MINUTES: '60',
    };

    sendMailMock = jest.fn().mockResolvedValue({ messageId: 'test-id' });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    process.env = originalEnv;
  });

  it('calculates unlocked available NEAR after storage lock and sends LOW then EXHAUSTED alerts with cooldown', async () => {
    const service = new NearRelayerService();
    (service as any).mailTransporter = { sendMail: sendMailMock };

    // 5.62 NEAR total, 500_000 bytes storage -> 5.0 NEAR locked -> 0.62 NEAR available (LOW)
    const queryMock = jest.fn().mockResolvedValue({
      amount: '5620000000000000000000000',
      storage_usage: 500000,
    });
    (service as any).provider = { query: queryMock };

    await service.checkRelayerGasBalance('test_low');
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].to).toBe('admin@example.com');
    expect(sendMailMock.mock.calls[0][0].subject).toContain('WARNING: Low NEAR Gas');

    // Second LOW check within cooldown should not re-send
    await service.checkRelayerGasBalance('test_low_repeat');
    expect(sendMailMock).toHaveBeenCalledTimes(1);

    // Escalation to EXHAUSTED (0.10 NEAR available) should send immediately
    queryMock.mockResolvedValue({
      amount: '5100000000000000000000000',
      storage_usage: 500000,
    });
    await service.checkRelayerGasBalance('test_critical');
    expect(sendMailMock).toHaveBeenCalledTimes(2);
    expect(sendMailMock.mock.calls[1][0].subject).toContain('CRITICAL: Out of NEAR Gas');

    // Recovery above 1.0 NEAR resets cooldowns
    queryMock.mockResolvedValue({
      amount: '10000000000000000000000000',
      storage_usage: 500000,
    });
    await service.checkRelayerGasBalance('test_recovered');
    expect((service as any).lastGasAlertSentAt.size).toBe(0);
  });

  it('triggers CRITICAL email when a relayer tx fails with insufficient balance/storage error', async () => {
    const service = new NearRelayerService();
    (service as any).mailTransporter = { sendMail: sendMailMock };
    (service as any).provider = {
      query: jest.fn().mockResolvedValue({
        amount: '5050000000000000000000000',
        storage_usage: 500000,
      }),
    };
    (service as any).relayerAccount = {
      functionCall: jest
        .fn()
        .mockRejectedValue(
          new Error(
            "The account wouldn't have enough balance to cover storage, required to have 10122785308849300000792 yoctoNEAR more",
          ),
        ),
    };

    const res = await (service as any).executeFunctionCall(
      'create_tournament',
      {},
      '0',
      '30000000000000',
    );
    expect(res.ok).toBe(false);

    // Flush microtasks for non-blocking handleRelayerGasError
    await new Promise((r) => setImmediate(r));
    expect(sendMailMock).toHaveBeenCalledTimes(1);
    expect(sendMailMock.mock.calls[0][0].subject).toContain('CRITICAL: Out of NEAR Gas');
    expect(sendMailMock.mock.calls[0][0].text).toContain('tx_failed:create_tournament');
  });
});
