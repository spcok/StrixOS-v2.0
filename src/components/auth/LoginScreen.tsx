import React, { useState, useEffect } from 'react';
import {
  Lock,
  Mail,
  Loader2,
  ArrowRight,
  KeyRound,
  CheckCircle2,
  Eye,
  EyeOff,
  ShieldAlert,
  Scale,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { ResponsiveModal } from '../ui/ResponsiveModal';
import logoImg from '../../assets/logo.png';

interface LoginScreenProps {
  onSuccess?: () => void;
}

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_SECONDS = 30;

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);

  const [isResetModalOpen, setIsResetModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [isSendingReset, setIsSendingReset] = useState(false);
  const [resetSentSuccess, setResetSentSuccess] = useState(false);

  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const timer = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldownSeconds]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cooldownSeconds > 0) {
      toast.error(`Too many failed attempts. Please wait ${cooldownSeconds}s.`);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !password) {
      toast.error('Please provide both your email address and password.');
      return;
    }

    setIsLoggingIn(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });
      if (error) throw error;
      if (!data.session) throw new Error('No active session returned.');

      // Verify staff account is active in public.users
      const { data: staffRow } = await supabase
        .from('users')
        .select('is_active')
        .eq('id', data.session.user.id)
        .maybeSingle();

      if (staffRow && staffRow.is_active === false) {
        await supabase.auth.signOut();
        throw new Error('Staff account is deactivated. Contact an administrator.');
      }

      setFailedAttempts(0);
      setPassword('');
      toast.success('Signed in successfully.');
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const nextFailures = failedAttempts + 1;
      setFailedAttempts(nextFailures);
      if (nextFailures >= MAX_LOGIN_ATTEMPTS) {
        setCooldownSeconds(LOCKOUT_SECONDS);
        setFailedAttempts(0);
        toast.error(
          `Multiple failed sign-in attempts detected. Login locked for ${LOCKOUT_SECONDS} seconds.`
        );
      } else {
        const message =
          err instanceof Error && err.message.includes('deactivated')
            ? err.message
            : 'Invalid staff email or password.';
        toast.error(message);
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedResetEmail = resetEmail.trim().toLowerCase();
    if (!normalizedResetEmail) {
      toast.error('Please enter your email address.');
      return;
    }

    setIsSendingReset(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(
        normalizedResetEmail,
        {
          redirectTo: `${window.location.origin}/reset-password`,
        }
      );

      if (error) throw error;

      setResetSentSuccess(true);
      toast.success('If this email is registered, a recovery link has been dispatched.');
    } catch {
      // Prevent user enumeration by showing generic message or rate-limit notice
      setResetSentSuccess(true);
    } finally {
      setIsSendingReset(false);
    }
  };

  const closeResetModal = () => {
    setIsResetModalOpen(false);
    setResetSentSuccess(false);
    setResetEmail('');
  };

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col justify-center items-center p-4 selection:bg-emerald-500 selection:text-white font-sans text-left relative overflow-hidden py-10">
      {/* Background Ambience Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md relative z-10 space-y-4">
        {/* Main Login Card */}
        <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 sm:p-8 shadow-2xl backdrop-blur-xs space-y-6">
          {/* Header Branding */}
          <div className="flex flex-col items-center text-center space-y-3">
            <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 p-2 flex items-center justify-center shadow-inner">
              <img
                src={logoImg}
                alt="StrixOS Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">
                Strix<span className="text-emerald-500">OS</span>
              </h1>
              <p className="text-xs font-semibold text-slate-400 mt-0.5">
                Kent Owl Academy Husbandry Portal
              </p>
            </div>
          </div>

          {/* Login Form */}
          <form onSubmit={handleLogin} className="space-y-4 pt-2">
            {/* Email Field */}
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1.5 ml-1">
                Staff Email Address
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <input
                  type="email"
                  required
                  autoComplete="email"
                  disabled={cooldownSeconds > 0}
                  placeholder="keeper@kentowlacademy.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner transition-all disabled:opacity-50"
                />
              </div>
            </div>

            {/* Password Field */}
            <div>
              <div className="flex justify-between items-center mb-1.5 ml-1">
                <label className="text-xs font-bold text-slate-300">
                  Password
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setIsResetModalOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
                >
                  Forgot Password?
                </button>
              </div>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500"
                  size={16}
                />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  disabled={cooldownSeconds > 0}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-10 py-3 bg-slate-950 border border-slate-800 rounded-xl text-sm font-medium text-white placeholder:text-slate-600 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 shadow-inner transition-all disabled:opacity-50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors cursor-pointer p-1"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoggingIn || cooldownSeconds > 0}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-sm font-bold transition-all shadow-md active:scale-[0.99] cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4"
            >
              {cooldownSeconds > 0 ? (
                <span>Locked ({cooldownSeconds}s)</span>
              ) : isLoggingIn ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Legal, Statutory Compliance & Computer Misuse Notice Card */}
        <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-4 shadow-xl text-left space-y-3">
          <div className="flex items-start gap-2.5">
            <ShieldAlert size={15} className="text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-300">
                Authorized Access Only &bull; Computer Misuse Act 1990
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                This system is strictly reserved for authorized Kent Owl Academy
                personnel. Unauthorized access, alteration, or damage to data is
                a criminal offence under the Computer Misuse Act 1990 and may
                result in civil proceedings and criminal prosecution.
              </p>
            </div>
          </div>

          <div className="h-px bg-slate-800/60" />

          <div className="flex items-start gap-2.5">
            <Scale size={15} className="text-emerald-400 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-xs font-bold text-slate-300">
                UK GDPR &amp; Statutory Record-Keeping (SSSMZP)
              </h4>
              <p className="text-[11px] text-slate-400 leading-relaxed mt-0.5">
                User authentication events, access timestamps, and husbandry
                record entries are monitored and logged to satisfy statutory
                compliance obligations under the Zoo Licensing Act 1981 and the
                Data Protection Act 2018 (Article 6(1)(c) Legal Obligation).
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Universal Password Recovery Modal */}
      <ResponsiveModal
        isOpen={isResetModalOpen}
        onClose={closeResetModal}
        title="Reset Password"
        subtitle="Staff Credential Recovery Dispatch"
        icon={<KeyRound size={18} />}
        maxWidth="sm"
      >
        {resetSentSuccess ? (
          <div className="space-y-4">
            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-start gap-2.5 text-emerald-800">
              <CheckCircle2
                size={18}
                className="shrink-0 mt-0.5 text-emerald-600"
              />
              <p className="text-xs font-medium leading-relaxed">
                If <strong>{resetEmail}</strong> is registered, a recovery link
                has been dispatched. Please check your inbox and tap the link to
                reset your credentials.
              </p>
            </div>
            <button
              type="button"
              onClick={closeResetModal}
              className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
            >
              Return to Login
            </button>
          </div>
        ) : (
          <form onSubmit={handleRequestPasswordReset} className="space-y-4">
            <p className="text-xs text-slate-600 leading-relaxed">
              Enter your registered staff email address. We will send you a
              secure link to create a new password.
            </p>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1.5">
                Registered Email
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                  size={15}
                />
                <input
                  type="email"
                  required
                  placeholder="keeper@kentowlacademy.com"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={closeResetModal}
                className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSendingReset}
                className="flex-[2] py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isSendingReset ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span>Send Reset Link</span>
                )}
              </button>
            </div>
          </form>
        )}
      </ResponsiveModal>
    </div>
  );
}

export default LoginScreen;