/**
 * Forgot Password — request a reset link by email.
 */
import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Loader, CheckCircle } from 'lucide-react';
import authApi from '../../api/auth';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await authApi.forgotPassword(email);
    } catch {
      // Intentionally ignore — the endpoint always returns a generic success.
    } finally {
      setSent(true);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-foreground">Saranam</h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-foreground">
            Reset your password
          </h2>
        </div>

        {sent ? (
          <div className="bg-card p-8 rounded-lg shadow-md space-y-4 text-center">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <p className="text-sm text-muted-foreground">
              If an account exists for that email, a reset link has been sent. Check your inbox.
            </p>
            <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline">
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="mt-8 space-y-6 bg-card p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
            <p className="text-sm text-muted-foreground">
              Enter your email and we'll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-foreground">
                Email address
              </label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Mail className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <input
                  id="email"
                  type="email"
                  required
                  className="appearance-none block w-full pl-10 pr-3 py-2 bg-card text-foreground border border-border rounded-md shadow-sm placeholder-muted-foreground/70 focus:outline-none focus:ring-primary focus:border-primary"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (<><Loader className="animate-spin h-5 w-5 mr-2" /> Sending...</>) : 'Send reset link'}
            </button>

            <div className="text-center">
              <Link to="/login" className="text-sm font-medium text-primary hover:underline">
                Back to sign in
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
