import { useState } from 'react';
import { Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail } from 'lucide-react';
import { authApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import AuthLayout from '../design/AuthLayout';
import { Button, FormRow, Input, Note } from '../design/primitives';

const schema = z.object({
  email: z.string().email({ message: 'Enter a valid email address' }),
});

function ForgotPassword() {
  const [sent, setSent] = useState('');
  const [error, setError] = useState('');

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(schema) });

  const onSubmit = async (data) => {
    setError('');
    try {
      const response = await authApi.forgotPassword(data);
      setSent(response.message);
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link that works for 30 minutes."
      footer={
        <Link to="/login" className="font-semibold text-indigo-600 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {error && <Note tone="error">{error}</Note>}
        {sent && <Note tone="success">{sent}</Note>}

        <FormRow label="Email" error={errors.email?.message}>
          <Input {...register('email')} type="email" autoComplete="email" placeholder="you@school.edu" invalid={!!errors.email} />
        </FormRow>

        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          <Mail className="h-4 w-4" strokeWidth={2} />
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}

export default ForgotPassword;
