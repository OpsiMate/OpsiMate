import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { useFormErrors } from "@/hooks/useFormErrors";
import ForgotPasswordForm from "@/components/ForgotPasswordForm";
import ForgotPasswordSuccess from "@/components/ForgotPasswordSuccess";

const ForgotPassword: React.FC = () => {
  const [email, setEmail] = useState("");
  const { generalError, clearErrors, handleApiResponse } = useFormErrors({
    showFieldErrors: false,
  });
  const [emailSent, setEmailSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await apiRequest<{
        data: { id: string; email: string };
        error?: string;
      }>("/users/forgot-password", "POST", { email });

      if (res.success) {
        clearErrors();
        setEmail("");
        setEmailSent(true);
        setLoading(false);
      } else {
        setLoading(false);
        handleApiResponse(res);
      }
    } catch (error) {
      console.error("Error sending password reset link:", error);
      setLoading(false);
      handleApiResponse({
        success: false,
        error: error instanceof Error ? error.message : "Failed to send reset link"
      });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="bg-card text-card-foreground border border-border p-8 rounded shadow-md w-150">
        {emailSent ? (
          <ForgotPasswordSuccess />
        ) : (
          <ForgotPasswordForm
            email={email}
            setEmail={setEmail}
            loading={loading}
            error={generalError}
            handleSubmit={handleSubmit}
          />
        )}
        <div className="mt-6 text-center">
          <Link
            to="/login"
            className="text-primary hover:underline text-sm inline-flex items-center gap-1"
          >
            <ArrowLeft size={16} />
            Back to login
          </Link>
        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
