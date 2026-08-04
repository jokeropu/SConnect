import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { userApi, classApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Modal } from '../design/Modal';
import { Button, FormRow, Input, Select, Note } from '../design/primitives';
import { toast } from '../design/Toaster';

const baseSchema = {
  firstName: z.string().min(2, { message: 'At least 2 characters' }),
  lastName: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  sex: z.string().optional(),
  bloodType: z.string().optional(),
  birthday: z.string().optional(),
};

const createSchema = z.object({
  ...baseSchema,
  email: z.string().email({ message: 'Enter a valid email address' }),
  password: z.string().min(8, { message: 'At least 8 characters' }),
});

const editSchema = z.object(baseSchema);

export default function UserFormModal({ open, onClose, role, user, onSaved }) {
  const isEdit = !!user;
  const [error, setError] = useState('');
  const [classes, setClasses] = useState([]);
  const [parents, setParents] = useState([]);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(isEdit ? editSchema : createSchema) });

  useEffect(() => {
    if (!open) return;
    setError('');
    reset({
      firstName: user?.firstName || '',
      lastName: user?.lastName || '',
      email: user?.email || '',
      phone: user?.phone || '',
      address: user?.address || '',
      sex: user?.sex || 'other',
      bloodType: user?.bloodType || '',
      birthday: user?.birthday ? String(user.birthday).slice(0, 10) : '',
      password: '',
    });
  }, [open, user, reset]);

  useEffect(() => {
    if (!open || role !== 'student') return;
    const load = async () => {
      try {
        const [classResponse, parentResponse] = await Promise.all([
          classApi.list({ limit: 100 }),
          userApi.list({ role: 'parent', limit: 100 }),
        ]);
        setClasses(classResponse.data);
        setParents(parentResponse.data);
      } catch {
        setClasses([]);
      }
    };
    load();
  }, [open, role]);

  const onSubmit = async (values) => {
    setError('');
    const payload = { ...values, role };
    if (!payload.birthday) delete payload.birthday;

    try {
      if (isEdit) {
        await userApi.update(user._id, payload);
        toast.success('User updated');
      } else {
        await userApi.create(payload);
        toast.success('User created');
      }
      onSaved();
      onClose();
    } catch (err) {
      setError(errorMessage(err));
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? `Edit ${role}` : `New ${role}`}
      description={isEdit ? user?.email : 'The account is approved immediately.'}
      footer={
        <>
          <Button tone="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSubmit(onSubmit)} loading={isSubmitting}>
            {isEdit ? 'Save changes' : 'Create'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3.5">
        {error && <Note tone="error">{error}</Note>}

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="First name" required error={errors.firstName?.message}>
            <Input {...register('firstName')} invalid={!!errors.firstName} />
          </FormRow>
          <FormRow label="Last name" error={errors.lastName?.message}>
            <Input {...register('lastName')} />
          </FormRow>
        </div>

        {!isEdit && (
          <>
            <FormRow label="Email" required error={errors.email?.message}>
              <Input {...register('email')} type="email" invalid={!!errors.email} />
            </FormRow>
            <FormRow label="Temporary password" required error={errors.password?.message} hint="Share it with the user">
              <Input {...register('password')} invalid={!!errors.password} />
            </FormRow>
          </>
        )}

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Phone">
            <Input {...register('phone')} />
          </FormRow>
          <FormRow label="Birthday">
            <Input {...register('birthday')} type="date" />
          </FormRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label="Sex">
            <Select {...register('sex')}>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </Select>
          </FormRow>
          <FormRow label="Blood type">
            <Input {...register('bloodType')} placeholder="O+" />
          </FormRow>
        </div>

        <FormRow label="Address">
          <Input {...register('address')} />
        </FormRow>

        {role === 'student' && (
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Class">
              <Select {...register('classId')}>
                <option value="">Unassigned</option>
                {classes.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.name}
                  </option>
                ))}
              </Select>
            </FormRow>
            <FormRow label="Parent">
              <Select {...register('parentId')}>
                <option value="">Unlinked</option>
                {parents.map((entry) => (
                  <option key={entry._id} value={entry._id}>
                    {entry.firstName} {entry.lastName}
                  </option>
                ))}
              </Select>
            </FormRow>
          </div>
        )}
      </form>
    </Modal>
  );
}
