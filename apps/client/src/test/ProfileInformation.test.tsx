import { describe, expect, it } from 'vitest';
import { render, screen } from './test-utils';
import { ProfileInformation } from '@/components/Profile/components/ProfileInformation/ProfileInformation';

describe('ProfileInformation', () => {
	it('shows role, formatted member date, and a fallback for a missing phone number', () => {
		render(
			<ProfileInformation
				email="member@example.com"
				role="admin"
				createdAt="2026-08-11T12:00:00.000Z"
				phoneNumber={null}
			/>,
		);

		expect(screen.getByText('admin')).toBeInTheDocument();
		expect(screen.getByText('August 11, 2026')).toBeInTheDocument();
		expect(screen.getByText('—')).toBeInTheDocument();
	});
});
