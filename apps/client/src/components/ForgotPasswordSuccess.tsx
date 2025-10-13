import React from "react";

const ForgotPasswordSuccess: React.FC = () => {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">
        We've emailed you a password reset link
      </h1>
      <p className="text-sm text-muted-foreground">
        Please check your inbox or spam folder for further instructions.
      </p>
    </div>
  );
};

export default ForgotPasswordSuccess;
