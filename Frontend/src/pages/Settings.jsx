import { useState } from 'react';
import { useDispatch } from 'react-redux';
import { KeyRound, LogOut } from 'lucide-react';
import { authApi, notificationApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { logoutUser } from '../store/authSlice';
import { Card, Button, FormRow, Input, Note } from '../design/primitives';
import { toast } from '../design/Toaster';

export default function Settings() {
  const dispatch = useDispatch();
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');

  const changePassword = async () => {
    setError('');
    setDone('');

    if (form.newPassword !== form.confirmPassword) {
      setError('The new passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const response = await authApi.changePassword({
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      setDone(response.message);
      setForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => dispatch(logoutUser()), 1500);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const clearNotifications = async () => {
    try {
      await notificationApi.clear();
      toast.success('Notifications cleared');
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <Card className="w-full lg:w-2/3">
        <h1 className="text-lg font-semibold">Change password</h1>
        <p className="mt-1 text-xs text-gray-400">You will be signed out of every device afterwards.</p>

        <div className="mt-4 flex flex-col gap-3.5">
          {error && <Note tone="error">{error}</Note>}
          {done && <Note tone="success">{done}</Note>}

          <FormRow label="Current password" required>
            <Input type="password" value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} />
          </FormRow>
          <FormRow label="New password" required hint="8+ characters, mixed case, number, symbol">
            <Input type="password" value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} />
          </FormRow>
          <FormRow label="Confirm new password" required>
            <Input type="password" value={form.confirmPassword} onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })} />
          </FormRow>

          <Button onClick={changePassword} loading={saving} className="self-start">
            <KeyRound className="h-4 w-4" />
            Update password
          </Button>
        </div>
      </Card>

      <Card className="w-full lg:w-1/3">
        <h1 className="text-lg font-semibold">Account</h1>

        <div className="mt-4 flex flex-col gap-3">
          <Button tone="outline" onClick={clearNotifications}>Clear all notifications</Button>
          <Button tone="danger" onClick={() => dispatch(logoutUser())}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  );
}
