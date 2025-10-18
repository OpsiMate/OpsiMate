import React from "react";

const ResetPasswordByEmailSuccess: React.FC = () => {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">
        Password reset successful!
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        You can now log in with your new password.
      </p>
    </div>
  );
};

export default ResetPasswordByEmailSuccess;
