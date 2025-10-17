import React from "react";

const ForgotPasswordSuccess: React.FC = () => {
  return (
    <div className="text-center" aria-live="polite">
      <h1 className="text-2xl font-bold text-foreground mb-4">
        We've emailed you a password reset link
      </h1>
      <p className="text-sm text-muted-foreground">
        Check your inbox and spam folder for further instructions. If you don’t
        receive an email within 10 minutes, try again or contact support.
      </p>
    </div>
  );
};

export default ForgotPasswordSuccess;
