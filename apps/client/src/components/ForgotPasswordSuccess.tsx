import React from 'react';

const ForgotPasswordSuccess: React.FC = () => {
	return (
		<div className='text-center' aria-live='polite'>
			<h1 className='text-2xl font-bold text-foreground mb-4'>Password reset requested</h1>
			<p className='text-sm text-muted-foreground'>
				If your account is configured to send emails, you’ll receive password reset instructions soon.
				<br />
				<span className='block mt-2'>
					<strong>Note:</strong> You must set up your Mailer configuration before password reset emails can be
					delivered.
					<br />
					See{' '}
					<a
						href='https://opsimate.vercel.app/docs/getting-started/configuration'
						target='_blank'
						rel='noopener noreferrer'
						className='text-primary underline'
					>
						configuration instructions
					</a>
					.
				</span>
			</p>
		</div>
	);
};

export default ForgotPasswordSuccess;
