import ResetPasswordByEmailForm from "@/components/ResetPasswordByEmailForm";
import ResetPasswordByEmailInvalid from "@/components/ResetPasswordByEmailInvalid";
import ResetPasswordByEmailSuccess from "@/components/ResetPasswordByEmailSuccess";
import { useFormErrors } from "@/hooks/useFormErrors";
import { apiRequest } from "@/lib/api";
import { ArrowLeft } from "lucide-react";
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const ResetPasswordByEmail: React.FC = () => {
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const token = query.get("token");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [valid, setValid] = useState<boolean | null>(null);
  const { generalError, clearErrors, handleApiResponse } = useFormErrors({
    showFieldErrors: false,
  });

  const validateToken = async () => {
    if (!token) {
      setValid(false);
      return;
    }
    const res = await apiRequest<{
      data: { success: boolean; message: string };
      error?: string;
    }>("/users/validate-reset-password-token", "POST", { token });

    setValid(res.success);
  };

  useEffect(() => {
    if (token) validateToken();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearErrors();
    if (!password || !confirm) {
      handleApiResponse({ success: false, error: "Please fill in both fields." });
      return;
    }
    if (password !== confirm) {
      handleApiResponse({ success: false, error: "Passwords do not match." });
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest<{
        data: { id: string; email: string };
        error?: string;
      }>("/users/reset-password", "POST", { token, newPassword: password });

      if (res.success) {
        setSuccess(true);
      } else {
        handleApiResponse(res);
      }
    } catch {
      handleApiResponse({ success: false, error: "Network error. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      {valid === null ? (
        <div>Loading...</div>
      ) : (
        <div className="bg-card text-card-foreground border border-border p-8 rounded shadow-md w-180">
          {!valid ? (
            <ResetPasswordByEmailInvalid />
          ) : success ? (
            <ResetPasswordByEmailSuccess />
          ) : (
            <ResetPasswordByEmailForm
              password={password}
              setPassword={setPassword}
              confirm={confirm}
              setConfirm={setConfirm}
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
      )}
    </div>
  );
};

export default ResetPasswordByEmail;
