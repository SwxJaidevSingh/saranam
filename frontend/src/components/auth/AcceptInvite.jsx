/**
 * Accept Invite — an invited user sets their name + password to create the account.
 */
import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { User, Lock, Loader, CheckCircle } from 'lucide-react';
import authApi from '../../api/auth';

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const token = params.get('token') || '';
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (fullName.trim().length < 2) { setError('Please enter your name.'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return; }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await authApi.acceptInvite({ token, full_name: fullName.trim(), password });
      setDone(true);
      setTimeout(() => navigate('/login'), 2500);
    } catch (err) {
      setError(err.response?.data?.message || 'Could not accept the invitation.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h1 className="text-center text-3xl font-bold text-foreground">Saranam</h1>
          <h2 className="mt-6 text-center text-2xl font-semibold text-foreground">
            Accept your invitation
          </h2>
        </div>

        {done ? (
          <div className="bg-card p-8 rounded-lg shadow-md space-y-4 text-center">
            <CheckCircle className="h-10 w-10 text-green-600 mx-auto" />
            <p className="text-sm text-muted-foreground">Account created. Redirecting to sign in…</p>
            <Link to="/login" className="inline-block text-sm font-medium text-primary hover:underline">
              Go to sign in
            </Link>
          </div>
        ) : !token ? (
          <div className="bg-card p-8 rounded-lg shadow-md text-center">
            <p className="text-sm text-destructive">This invitation link is invalid or incomplete.</p>
          </div>
        ) : (
          <form className="mt-8 space-y-6 bg-card p-8 rounded-lg shadow-md" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">{error}</div>
            )}
            <div>
              <label className="block text-sm font-medium text-foreground">Full name</label>
              <div className="mt-1 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <User className="h-5 w-5 text-muted-foreground/70" />
                </div>
                <input
                  type="text"
                  required
                  minLength={2}
                  className="appearance-none block w-full pl-10 pr-3 py-2 bg-card text-foreground border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                  placeholder="Your name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={loading}
                />
              </div>
            </div>
            {['Password', 'Confirm password'].map((label, i) => (
              <div key={label}>
                <label className="block text-sm font-medium text-foreground">{label}</label>
                <div className="mt-1 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-muted-foreground/70" />
                  </div>
                  <input
                    type="password"
                    required
                    minLength={8}
                    className="appearance-none block w-full pl-10 pr-3 py-2 bg-card text-foreground border border-border rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary"
                    placeholder={label}
                    value={i === 0 ? password : confirm}
                    onChange={(e) => (i === 0 ? setPassword : setConfirm)(e.target.value)}
                    disabled={loading}
                  />
                </div>
              </div>
            ))}
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center items-center py-2 px-4 rounded-md shadow-sm text-sm font-medium text-primary-foreground bg-primary hover:bg-primary/90 disabled:opacity-50"
            >
              {loading ? (<><Loader className="animate-spin h-5 w-5 mr-2" /> Creating...</>) : 'Create account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default AcceptInvite;
