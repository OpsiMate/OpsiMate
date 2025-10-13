import React from "react";
import { Link } from "react-router-dom";

const ResetPasswordByEmailInvalid: React.FC = () => {
  return (
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground mb-4">
        Invalid or Expired Token
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        This password reset link is no longer valid. You can request a new one
        below.
      </p>
      <Link
        to="/forgot-password"
        className="text-primary hover:underline text-sm inline-flex items-center gap-1"
      >
        Request new reset link
      </Link>
    </div>
  );
};

export default ResetPasswordByEmailInvalid;
