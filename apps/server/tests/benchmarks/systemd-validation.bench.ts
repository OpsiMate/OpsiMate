import { bench, describe } from 'vitest';
import { CreateServiceSchema, ServiceType } from '@OpsiMate/shared';

describe('Systemd validation performance', () => {
	const validServiceName = 'nginx-service';
	const invalidServiceName = 'invalid service name';

	// Test 1: Valid service name validation
	bench('validate valid systemd service name', () => {
		CreateServiceSchema.safeParse({
			providerId: 1,
			name: validServiceName,
			serviceStatus: 'unknown',
			serviceType: ServiceType.SYSTEMD,
		});
	});

	// Test 2: Invalid service name validation
	bench('validate invalid systemd service name (with spaces)', () => {
		CreateServiceSchema.safeParse({
			providerId: 1,
			name: invalidServiceName,
			serviceStatus: 'unknown',
			serviceType: ServiceType.SYSTEMD,
		});
	});

	// Test 3: Docker service (no validation needed)
	bench('validate docker service name (no space check)', () => {
		CreateServiceSchema.safeParse({
			providerId: 1,
			name: invalidServiceName,
			serviceStatus: 'unknown',
			serviceType: ServiceType.DOCKER,
		});
	});

	// Test 4: Direct regex performance
	bench('direct regex /\\s/.test() on valid name', () => {
		/\s/.test(validServiceName);
	});

	// Test 5: Direct regex performance
	bench('direct regex /\\s/.test() on invalid name', () => {
		/\s/.test(invalidServiceName);
	});

	// Test 6: Alternative - indexOf approach
	bench('alternative: indexOf(" ") on valid name', () => {
		validServiceName.indexOf(' ') !== -1;
	});

	// Test 7: Alternative - indexOf approach
	bench('alternative: indexOf(" ") on invalid name', () => {
		invalidServiceName.indexOf(' ') !== -1;
	});

	// Test 8: Alternative - includes approach
	bench('alternative: includes(" ") on valid name', () => {
		validServiceName.includes(' ');
	});

	// Test 9: Alternative - includes approach
	bench('alternative: includes(" ") on invalid name', () => {
		invalidServiceName.includes(' ');
	});
});
