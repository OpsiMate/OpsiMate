import { describe, expect, it } from 'vitest';
import { render, screen } from './test-utils';
import { ProfileInformation } from '@/components/Profile/components/ProfileInformation/ProfileInformation';
import { formatDate } from '@/lib/datetime';

describe('ProfileInformation', () => {
	it('shows role, formatted member date, and a fallback for a missing phone number', () => {
		render(
			<ProfileInformation
				email="member@example.com"
				role="admin"
				createdAt="2026-08-11T12:00:00.000Z"
				phoneNumber={null}
			/>
		);

		expect(screen.getByText('admin')).toBeInTheDocument();
		expect(screen.getByText(formatDate('2026-08-11T12:00:00.000Z'))).toBeInTheDocument();
		expect(screen.getByText('—')).toBeInTheDocument();
	});
});
