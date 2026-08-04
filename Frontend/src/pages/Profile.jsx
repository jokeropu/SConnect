import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Camera, Save } from 'lucide-react';
import { userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { updateUserProfile } from '../store/authSlice';
import { Card, Button, FormRow, Input, Select, Note, Avatar, Chip } from '../design/primitives';
import { toast } from '../design/Toaster';
import { formatDate, fullName, ROLE_LABEL, STATUS_TONE } from '../design/cn';

export default function Profile() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [form, setForm] = useState({ firstName: '', lastName: '', phone: '', address: '', sex: 'other', bloodType: '', birthday: '' });
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setForm({
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      phone: user.phone || '',
      address: user.address || '',
      sex: user.sex || 'other',
      bloodType: user.bloodType || '',
      birthday: user.birthday ? String(user.birthday).slice(0, 10) : '',
    });
  }, [user]);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      const payload = { ...form };
      if (!payload.birthday) delete payload.birthday;
      const response = await userApi.updateProfile(payload);
      dispatch(updateUserProfile(response.user));
      toast.success('Profile updated');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file) => {
    if (!file) return;
    setUploading(true);
    try {
      const payload = new FormData();
      payload.append('avatar', file);
      const response = await userApi.updateAvatar(payload);
      dispatch(updateUserProfile(response.user));
      toast.success('Photo updated');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const tone = STATUS_TONE[user?.status] || STATUS_TONE.pending;

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <Card className="w-full lg:w-1/3">
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="relative">
            <Avatar src={user?.avatarUrl} name={`${user?.firstName || ''}${user?.lastName || ''}`} size={96} className="text-2xl" />
            <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-lama-yellow">
              <Camera className="h-4 w-4 text-gray-700" />
              <input type="file" accept="image/*" className="hidden" onChange={(e) => uploadAvatar(e.target.files?.[0])} />
            </label>
          </div>

          <div className="text-center">
            <p className="text-lg font-semibold">{fullName(user)}</p>
            <p className="text-xs text-gray-400">{user?.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <Chip className="bg-lama-purple-light text-indigo-700">{ROLE_LABEL[user?.role]}</Chip>
            <Chip className={tone.className}>{tone.label}</Chip>
          </div>

          {uploading && <p className="text-xs text-gray-400">Uploading photo…</p>}
          <p className="text-[11px] text-gray-400">Joined {formatDate(user?.createdAt)}</p>
        </div>
      </Card>

      <Card className="w-full lg:w-2/3">
        <h1 className="text-lg font-semibold">Your details</h1>

        <div className="mt-4 flex flex-col gap-3.5">
          {error && <Note tone="error">{error}</Note>}

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="First name" required>
              <Input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} />
            </FormRow>
            <FormRow label="Last name">
              <Input value={form.lastName} onChange={(e) => setForm({ ...form, lastName: e.target.value })} />
            </FormRow>
          </div>

          <FormRow label="Email" hint="Cannot be changed">
            <Input value={user?.email || ''} disabled />
          </FormRow>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Phone">
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </FormRow>
            <FormRow label="Birthday">
              <Input type="date" value={form.birthday} onChange={(e) => setForm({ ...form, birthday: e.target.value })} />
            </FormRow>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormRow label="Sex">
              <Select value={form.sex} onChange={(e) => setForm({ ...form, sex: e.target.value })}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </Select>
            </FormRow>
            <FormRow label="Blood type">
              <Input value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} />
            </FormRow>
          </div>

          <FormRow label="Address">
            <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </FormRow>

          <Button onClick={save} loading={saving} className="self-start">
            <Save className="h-4 w-4" />
            Save changes
          </Button>
        </div>
      </Card>
    </div>
  );
}
