import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { Eye, EyeOff, LogIn } from 'lucide-react';
import { loginUser, clearAuthError } from '../store/authSlice';
import AuthLayout from '../design/AuthLayout';
import GoogleBlock from '../design/GoogleBlock';
import { Button, FormRow, Input, Note } from '../design/primitives';

const loginSchema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z.string().min(1, { message: 'Enter your password' }),
});

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isAuthenticated, error } = useSelector((state) => state.auth);

  const [turnstileToken, setTurnstileToken] = useState('');
  const [shown, setShown] = useState(false);
  const turnstileRef = useRef(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(loginSchema) });

  useEffect(() => {
    if (isAuthenticated) navigate('/');
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (error) {
      turnstileRef.current?.reset();
      setTurnstileToken('');
    }
  }, [error]);

  const onSubmit = (data) => dispatch(loginUser({ ...data, turnstileToken }));
  const blocked = !!SITE_KEY && !turnstileToken;

  return (
    <AuthLayout
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <span className="text-gray-500">
          New student?{' '}
          <Link to="/register" className="font-semibold text-indigo-600 hover:underline">
            Create an account
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {error && <Note tone="error">{error}</Note>}

        <FormRow label="Email" error={errors.email?.message}>
          <Input {...register('email')} type="email" autoComplete="email" placeholder="you@school.edu" invalid={!!errors.email} />
        </FormRow>

        <FormRow
          label="Password"
          error={errors.password?.message}
          hint={
            <Link to="/forgot-password" className="text-indigo-600 hover:underline">
              Forgot password?
            </Link>
          }
        >
          <div className="relative">
            <Input
              {...register('password')}
              type={shown ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Your password"
              invalid={!!errors.password}
              className="pr-9"
            />
            <button
              type="button"
              onClick={() => setShown((s) => !s)}
              aria-label={shown ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
            >
              {shown ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FormRow>

        {SITE_KEY && (
          <div className="flex justify-center py-0.5">
            <Turnstile
              ref={turnstileRef}
              siteKey={SITE_KEY}
              onSuccess={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
            />
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={blocked}>
          <LogIn className="h-4 w-4" strokeWidth={2} />
          Sign in
        </Button>

        {blocked && (
          <p className="-mt-1.5 text-center text-xs text-gray-400">Complete the verification above to continue</p>
        )}
      </form>

      <GoogleBlock />
    </AuthLayout>
  );
}

export default Login;
