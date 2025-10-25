/**
 * Builds the email skeleton with header and footer
 * @param content Main content of the email
 * @param subtitle Optional subtitle below the main title
 * @returns string
 */
function buildEmailSkeleton(content: string, subtitle?: string): string {
	subtitle = subtitle ? `<h2 style="color: #2d3748; margin: 8px 0 16px 0; font-size: 20px;">${subtitle}</h2>` : '';

	return `
    <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 32px;">
      <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 32px;">
        <div style="text-align: left; margin-bottom: 24px;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0;">OpsiMate</h1>
          ${subtitle}
        </div>
        ${content}
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">
          &copy; Copyright © ${new Date().getFullYear()} OpsiMate. All rights reserved.
        </p>
      </div>
    </div>
  `;
}

/**
 * Template for password reset email
 * @param resetUrl
 * @param userName
 * @returns
 */
export function passwordResetTemplate(resetUrl: string, userName?: string) {
	const content = `
    <p style="color: #4a5568; margin-bottom: 24px;">
      ${userName ? `Hi ${userName},` : 'Hello,'}<br/>
      We received a request to reset your password for your OpsiMate account.
    </p>
    <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
      Reset Password
    </a>
    <p style="color: #718096; margin-top: 24px; font-size: 14px;">
      If you did not request this, you can safely ignore this email.<br/>
      This link will expire in 15 minutes for your security.
    </p>
  `;

	return buildEmailSkeleton(content, 'Reset Your Password');
}

/**
 * Template for welcome email
 * @param customBody Optional custom body content
 * @returns string
 */
export function welcomeTemplate(customBody?: string, userName?: string) {
	const defaultBody = `
    <p style="color: #4a5568; margin-bottom: 24px;">
      Hey${userName ? ` ${userName}` : ''} 👋,<br>Welcome aboard! We’re happy to have you as part of the OpsiMate community.
    </p>`;
	const body = customBody === undefined || customBody === '' ? defaultBody : customBody;

	const content = `
    ${body}
    <div style="margin-bottom: 24px; text-align: center;">
      <div style="display: block;">
        <div style="margin-bottom: 20px; text-align: left;">
            <div style="font-weight: bold; color: #2563eb; margin-bottom: 2px;">Documentation</div>
            <a href="https://opsimate.vercel.app/" style="color:#2563eb;font-weight:bold;text-decoration:underline;font-size:16px;">Explore Docs</a>
            <div style="font-size: 13px; color: #4a5568; margin-top: 4px;">You can start exploring here: get started, find guides, and explore features.</div>
        </div>
        <div style="margin-bottom: 20px; text-align: left;">
          <div style="font-weight: bold; color: #36c5f0; margin-bottom: 2px;">Slack Community</div>
          <a href="https://join.slack.com/t/opsimate/shared_invite/zt-39bq3x6et-NrVCZzH7xuBGIXmOjJM7gA" style="color:#36c5f0;font-weight:bold;text-decoration:underline;font-size:16px;">Join Slack</a>
          <div style="font-size: 13px; color: #4a5568; margin-top: 4px;">Ask questions, share feedback, and connect with us!</div>
        </div>
        <div style="margin-bottom: 20px; text-align: left;">
            <div style="font-weight: bold; color: #24292f; margin-bottom: 2px;">GitHub</div>
            <a href="https://github.com/OpsiMate/OpsiMate" style="color:#24292f;font-weight:bold;text-decoration:underline;font-size:16px;">Visit Repository</a>
            <div style="font-size: 13px; color: #4a5568; margin-top: 4px;">Found a bug or want a new feature? Star, fork, or open an issue!</div>
        </div>
        <div style="margin-bottom: 20px; text-align: left;">
          <div style="font-weight: bold; color: #2563eb; margin-bottom: 2px;">OpsiMate Website</div>
          <a href="https://www.opsimate.com/" style="color:#2563eb;font-weight:bold;text-decoration:underline;font-size:16px;">Visit Website</a>
          <div style="font-size: 13px; color: #4a5568; margin-top: 4px;">Learn more about us.</div>
        </div>
      </div>
    </div>
  `;

	return buildEmailSkeleton(content);
}
