import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { AuditService } from './audit.service';

describe('AuditService', () => {
  it('stores only a keyed hash of the IP address', async () => {
    let capturedCreateInput: unknown;
    const auditLog = {
      create: jest.fn((input: unknown) => {
        capturedCreateInput = input;
        return Promise.resolve({});
      }),
    };
    const secret = 'a'.repeat(48);
    const service = new AuditService(
      {} as PrismaService,
      new ConfigService({ IP_HASH_SECRET: secret }),
    );

    await service.record({ auditLog } as never, {
      actorUserId: '9038cb70-d11b-4e33-957c-53d35e9a973e',
      actorRole: UserRole.MODERATOR,
      action: 'BUSINESS_VERIFIED',
      entityType: 'BUSINESS',
      entityId: 'a8b1aeb7-5f38-47f9-9c25-b10e8d41d44e',
      ip: '203.0.113.10',
    });

    const createInput = capturedCreateInput as {
      data: { ipHash?: string };
    };
    expect(createInput.data.ipHash).toBe(
      createHmac('sha256', secret).update('203.0.113.10').digest('hex'),
    );
    expect(JSON.stringify(auditLog.create.mock.calls)).not.toContain(
      '203.0.113.10',
    );
  });
});
