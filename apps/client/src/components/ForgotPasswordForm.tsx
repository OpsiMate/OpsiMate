import { ErrorAlert } from "./ErrorAlert";
import { Button } from "./ui/button";
import { Input } from "./ui/input";

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (email: string) => void;
  loading: boolean;
  error: string;
  handleSubmit: (e: React.FormEvent) => void;
}

const ForgotPasswordForm: React.FC<ForgotPasswordFormProps> = ({
  email,
  setEmail,
  loading,
  error,
  handleSubmit,
}) => {
  return (
    <form onSubmit={handleSubmit}>
      <h1 className="text-2xl font-bold text-center mb-6 text-foreground">
        Forgot your password?
      </h1>

      <p className="text-sm text-muted-foreground text-center mb-4">
        Enter your email to receive a password reset link.
      </p>
      <div className="mb-4">
        <Input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </div>
      {error && <ErrorAlert message={error} className="mb-4" />}
      <Button type="submit" className="w-full mt-2">
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>
    </form>
  );
};

export default ForgotPasswordForm;
