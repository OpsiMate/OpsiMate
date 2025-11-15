import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@/test/test-utils';
import { ServiceFilterPanel } from '../FilterPanel';
import type { Service } from '@/components/ServiceTable';

const mockServices: Service[] = [
	{
		id: '1',
		name: 'Service 1',
		serviceStatus: 'running',
		serviceType: 'DOCKER',
		serviceIP: '192.168.1.1',
		provider: {
			id: 1,
			name: 'Provider 1',
			providerType: 'VM',
			providerIP: '192.168.1.100',
			username: 'admin',
			privateKeyFilename: 'key.pem',
			SSHPort: 22,
			createdAt: '2024-01-01',
		},
		tags: [{ id: 1, name: 'production' }],
		createdAt: '2024-01-01',
	},
	{
		id: '2',
		name: 'Service 2',
		serviceStatus: 'stopped',
		serviceType: 'SYSTEMD',
		serviceIP: '192.168.1.2',
		provider: {
			id: 2,
			name: 'Provider 2',
			providerType: 'K8S',
			providerIP: '192.168.1.101',
			username: 'admin',
			privateKeyFilename: 'key.pem',
			SSHPort: 22,
			createdAt: '2024-01-01',
		},
		tags: [{ id: 2, name: 'development' }],
		createdAt: '2024-01-01',
	},
];

describe('FilterPanel', () => {
	it('renders filter panel in expanded mode', () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel
				services={mockServices}
				filters={{}}
				onFilterChange={onFilterChange}
				collapsed={false}
			/>
		);

		expect(screen.getByText('Filters')).toBeInTheDocument();
		expect(screen.getByText('Status')).toBeInTheDocument();
	});

	it('renders filter panel in collapsed mode', () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel services={mockServices} filters={{}} onFilterChange={onFilterChange} collapsed={true} />
		);

		// In collapsed mode, we should see the slider icon container
		const containers = screen.getAllByRole('generic');
		expect(containers.length).toBeGreaterThan(0);
	});

	it('displays filter facets based on services', () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel
				services={mockServices}
				filters={{}}
				onFilterChange={onFilterChange}
				collapsed={false}
			/>
		);

		expect(screen.getByText('Status')).toBeInTheDocument();
		expect(screen.getByText('Service Type')).toBeInTheDocument();
		expect(screen.getByText('Provider Type')).toBeInTheDocument();
	});

	it('calls onFilterChange when a filter is selected', async () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel
				services={mockServices}
				filters={{}}
				onFilterChange={onFilterChange}
				collapsed={false}
			/>
		);

		// Status section is open by default, so we can click the Running checkbox
		const runningCheckbox = screen.getByRole('checkbox', { name: /running/i });
		fireEvent.click(runningCheckbox);

		expect(onFilterChange).toHaveBeenCalledWith({
			serviceStatus: ['running'],
		});
	});

	it('calls onFilterChange with empty object when reset is clicked', () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel
				services={mockServices}
				filters={{ serviceStatus: ['running'] }}
				onFilterChange={onFilterChange}
				collapsed={false}
			/>
		);

		const resetButton = screen.getByRole('button', { name: /reset/i });
		fireEvent.click(resetButton);

		expect(onFilterChange).toHaveBeenCalledWith({});
	});

	it('displays active filter count', () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel
				services={mockServices}
				filters={{ serviceStatus: ['running'], tags: ['production'] }}
				onFilterChange={onFilterChange}
				collapsed={false}
			/>
		);

		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('shows filter counts for each option', () => {
		const onFilterChange = vi.fn();
		render(
			<ServiceFilterPanel
				services={mockServices}
				filters={{}}
				onFilterChange={onFilterChange}
				collapsed={false}
			/>
		);

		// Service Type section is open by default, so we should see counts
		const badges = screen.getAllByText(/1/);
		expect(badges.length).toBeGreaterThan(0);
	});
});
