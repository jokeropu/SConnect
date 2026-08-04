import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Turnstile } from '@marsidev/react-turnstile';
import { UserPlus } from 'lucide-react';
import { registerUser, clearAuthError } from '../store/authSlice';
import AuthLayout from '../design/AuthLayout';
import GoogleBlock from '../design/GoogleBlock';
import { Button, FormRow, Input, Note } from '../design/primitives';

const registerSchema = z
  .object({
    firstName: z.string().min(2, { message: 'At least 2 characters' }),
    lastName: z.string().optional(),
    email: z.string().email({ message: 'Enter a valid email address' }),
    phone: z.string().optional(),
    password: z
      .string()
      .min(8, { message: 'At least 8 characters' })
      .regex(/[A-Z]/, { message: 'Needs an uppercase letter' })
      .regex(/[a-z]/, { message: 'Needs a lowercase letter' })
      .regex(/[0-9]/, { message: 'Needs a number' })
      .regex(/[^A-Za-z0-9]/, { message: 'Needs a symbol' }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

function Register() {
  const dispatch = useDispatch();
  const { error, registered } = useSelector((state) => state.auth);

  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileRef = useRef(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(registerSchema) });

  useEffect(() => {
    dispatch(clearAuthError());
  }, [dispatch]);

  useEffect(() => {
    if (registered) {
      reset();
      turnstileRef.current?.reset();
      setTurnstileToken('');
    }
  }, [registered, reset]);

  const onSubmit = (data) => dispatch(registerUser({ ...data, turnstileToken }));
  const blocked = !!SITE_KEY && !turnstileToken;

  return (
    <AuthLayout
      title="Create a student account"
      subtitle="An administrator reviews every signup before it goes live."
      footer={
        <span className="text-gray-500">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
            Sign in
          </Link>
        </span>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {error && <Note tone="error">{error}</Note>}
        {registered && <Note tone="success">{registered}</Note>}

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="First name" required error={errors.firstName?.message}>
            <Input {...register('firstName')} placeholder="Aarav" invalid={!!errors.firstName} />
          </FormRow>
          <FormRow label="Last name" error={errors.lastName?.message}>
            <Input {...register('lastName')} placeholder="Sharma" />
          </FormRow>
        </div>

        <FormRow label="Email" required error={errors.email?.message}>
          <Input {...register('email')} type="email" autoComplete="email" placeholder="you@school.edu" invalid={!!errors.email} />
        </FormRow>

        <FormRow label="Phone" error={errors.phone?.message}>
          <Input {...register('phone')} placeholder="9876543210" />
        </FormRow>

        <FormRow label="Password" required error={errors.password?.message}>
          <Input {...register('password')} type="password" autoComplete="new-password" placeholder="At least 8 characters" invalid={!!errors.password} />
        </FormRow>

        <FormRow label="Confirm password" required error={errors.confirmPassword?.message}>
          <Input {...register('confirmPassword')} type="password" autoComplete="new-password" invalid={!!errors.confirmPassword} />
        </FormRow>

        {SITE_KEY && (
          <div className="flex justify-center py-0.5">
            <Turnstile ref={turnstileRef} siteKey={SITE_KEY} onSuccess={setTurnstileToken} onExpire={() => setTurnstileToken('')} />
          </div>
        )}

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting} disabled={blocked}>
          <UserPlus className="h-4 w-4" strokeWidth={2} />
          Create account
        </Button>
      </form>

      <GoogleBlock />
    </AuthLayout>
  );
}

export default Register;
