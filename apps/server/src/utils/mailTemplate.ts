/**
 * Template for password reset email
 * @param resetUrl
 * @param userName
 * @returns
 */
export function passwordResetTemplate(resetUrl: string, userName?: string) {
  return `
    <div style="font-family: Arial, sans-serif; background: #f9f9f9; padding: 32px;">
      <div style="max-width: 480px; margin: auto; background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); padding: 32px;">
        <div style="text-align: left; margin-bottom: 24px;">
          <h1 style="color: #2563eb; font-size: 32px; margin: 0;">OpsiMate</h1>
          <h2 style="color: #2d3748; margin: 8px 0 16px 0; font-size: 20px;">Reset your password</h2>
        </div>
        <p style="color: #4a5568; margin-bottom: 24px;">
          ${userName ? `Hi ${userName},` : "Hello,"}<br/>
          We received a request to reset your password for your OpsiMate account.
        </p>
        <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #fff; padding: 12px 24px; border-radius: 4px; text-decoration: none; font-weight: bold;">
          Reset Password
        </a>
        <p style="color: #718096; margin-top: 24px; font-size: 14px;">
          If you did not request this, you can safely ignore this email.<br/>
          This link will expire in 15 minutes for your security.
        </p>
        <hr style="margin: 32px 0; border: none; border-top: 1px solid #e2e8f0;">
        <p style="color: #a0aec0; font-size: 12px; text-align: center;">
          &copy; ${new Date().getFullYear()} OpsiMate. All rights reserved.
        </p>
      </div>
    </div>
  `;
}
