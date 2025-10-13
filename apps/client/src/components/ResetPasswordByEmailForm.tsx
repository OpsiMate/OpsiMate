import { ErrorAlert } from "./ErrorAlert";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ResetPasswordFormProps {
  password: string;
  setPassword: (password: string) => void;
  confirm: string;
  setConfirm: (confirm: string) => void;
  loading: boolean;
  error: string;
  handleSubmit: (e: React.FormEvent) => void;
}

const ResetPasswordByEmailForm: React.FC<ResetPasswordFormProps> = ({
  password,
  setPassword,
  confirm,
  setConfirm,
  loading,
  error,
  handleSubmit,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        Reset your password
      </h1>
      <p className="text-sm text-muted-foreground text-center mb-4">
        Enter your new password below.
      </p>
      <div className="mb-4">
        <Input
          type="password"
          placeholder="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </div>
      <div className="mb-4">
        <Input
          type="password"
          placeholder="Confirm new password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
        />
      </div>
      {error && (
        <ErrorAlert message={error} className="mb-4" />
      )}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "Resetting..." : "Reset Password"}
      </Button>
    </form>
  );
};

export default ResetPasswordByEmailForm;
