import { render, screen } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { ProfileInformation } from '@/components/Profile/components/ProfileInformation/ProfileInformation';

describe('ProfileInformation', () => {
	test('renders profile details with the null-phone fallback and formatted member date', () => {
		render(
			<ProfileInformation
				email="member@example.com"
				role="admin"
				createdAt="2024-01-15T12:00:00.000Z"
				phoneNumber={null}
			/>
		);

		expect(screen.getByText('admin')).toBeInTheDocument();
		expect(screen.getByText('—')).toBeInTheDocument();
		expect(screen.getByText('January 15, 2024')).toBeInTheDocument();
	});
});
