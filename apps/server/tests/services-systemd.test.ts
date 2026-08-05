import { CreateServiceSchema, UpdateServiceSchema, ServiceType } from '@OpsiMate/shared';

describe('Systemd service name validation (Schema)', () => {
  test('rejects systemd service names containing spaces on create', () => {
    const invalidData = {
      providerId: 1,
      name: 'invalid name',
      serviceStatus: 'unknown',
      serviceType: ServiceType.SYSTEMD
    };

    const result = CreateServiceSchema.safeParse(invalidData);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(i => i.message.includes('cannot contain spaces'))
      ).toBe(true);
    }
  });

  test('accepts systemd service names without spaces on create', () => {
    const validData = {
      providerId: 1,
      name: 'valid-service',
      serviceStatus: 'unknown',
      serviceType: ServiceType.SYSTEMD
    };

    const result = CreateServiceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('accepts non-systemd services with spaces', () => {
    const validData = {
      providerId: 1,
      name: 'valid name with spaces',
      serviceStatus: 'unknown',
      serviceType: ServiceType.DOCKER
    };

    const result = CreateServiceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('rejects systemd service names containing spaces on update', () => {
    const invalidData = {
      id: 1,
      name: 'invalid name',
      serviceType: ServiceType.SYSTEMD
    };

    const result = UpdateServiceSchema.safeParse(invalidData);
    
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toContain('cannot contain spaces');
    }
  });

  test('accepts systemd service name update without spaces', () => {
    const validData = {
      id: 1,
      name: 'valid_service_name',
      serviceType: ServiceType.SYSTEMD
    };

    const result = UpdateServiceSchema.safeParse(validData);
    expect(result.success).toBe(true);
  });

  test('allows partial updates without name field', () => {
    const partialData = {
      id: 1,
      serviceStatus: 'running',
      serviceType: ServiceType.SYSTEMD
    };

    const result = UpdateServiceSchema.safeParse(partialData);
    expect(result.success).toBe(true);
  });
});
