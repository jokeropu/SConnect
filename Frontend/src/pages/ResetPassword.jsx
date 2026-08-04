import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound } from 'lucide-react';
import { authApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import AuthLayout from '../design/AuthLayout';
import { Button, FormRow, Input, Note } from '../design/primitives';

const schema = z
  .object({
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

function ResetPassword() {
  const { token } = useParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setError('');
    try {
      const response = await authApi.resetPassword(token, { password: data.password });
      setDone(response.message);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Make it something you have not used before."
      footer={
        <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {error && <Note tone="error">{error}</Note>}
        {done && <Note tone="success">{done}</Note>}

        <FormRow label="New password" error={errors.password?.message}>
          <Input {...register('password')} type="password" autoComplete="new-password" invalid={!!errors.password} />
        </FormRow>

        <FormRow label="Confirm password" error={errors.confirmPassword?.message}>
          <Input {...register('confirmPassword')} type="password" autoComplete="new-password" invalid={!!errors.confirmPassword} />
        </FormRow>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          <KeyRound className="h-4 w-4" strokeWidth={2} />
          Reset password
        </Button>
      </form>
    </AuthLayout>
  );
}

export default ResetPassword;
