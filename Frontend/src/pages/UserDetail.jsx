import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { Mail, Phone, MapPin, Cake, Droplet, IdCard, Hash } from 'lucide-react';
import { userApi } from '../api/endpoints';
import { errorMessage } from '../api/axiosClient';
import { Card, Loader, Note, Avatar, Chip } from '../design/primitives';
import { formatDate, fullName, rollPosition, ROLE_LABEL, STATUS_TONE } from '../design/cn';

const Detail = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2 text-sm text-gray-600">
    <Icon className="h-3.5 w-3.5 shrink-0 text-gray-400" />
    <span className="text-gray-400">{label}</span>
    <span className="font-medium">{value || '—'}</span>
  </div>
);

export default function UserDetail() {
  const { id } = useParams();
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        setPayload(await userApi.byId(id));
      } catch (err) {
        setError(errorMessage(err));
      }
    };
    load();
  }, [id]);

  if (error) return <div className="p-4"><Note tone="error">{error}</Note></div>;
  if (!payload) return <Loader label="Loading profile" />;

  const { user, profile } = payload;
  const tone = STATUS_TONE[user.status] || STATUS_TONE.pending;

  return (
    <div className="flex flex-col gap-4 p-4 lg:flex-row">
      <Card className="w-full lg:w-1/3">
        <div className="flex flex-col items-center gap-3 py-4">
          <Avatar src={user.avatarUrl} name={`${user.firstName}${user.lastName || ''}`} size={88} className="text-xl" />
          <div className="text-center">
            <p className="text-lg font-semibold">{fullName(user)}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
          </div>
          <div className="flex gap-2">
            <Chip className="bg-lama-purple-light text-indigo-700">{ROLE_LABEL[user.role]}</Chip>
            <Chip className={tone.className}>{tone.label}</Chip>
          </div>
        </div>

        <div className="mt-2 flex flex-col gap-2 border-t border-gray-100 pt-4">
          <Detail icon={IdCard} label="ID" value={user.memberId} />
          <Detail icon={Mail} label="Email" value={user.email} />
          <Detail icon={Phone} label="Phone" value={user.phone} />
          <Detail icon={MapPin} label="Address" value={user.address} />
          <Detail icon={Cake} label="Birthday" value={user.birthday ? formatDate(user.birthday) : null} />
          <Detail icon={Droplet} label="Blood" value={user.bloodType} />
        </div>
      </Card>

      <Card className="w-full lg:w-2/3">
        <h1 className="text-lg font-semibold">{ROLE_LABEL[user.role]} details</h1>

        {user.role === 'student' && (
          <div className="mt-4 flex flex-col gap-3">
            <Detail icon={Hash} label="Roll number" value={rollPosition(profile?.rollNumber)} />
            <Detail icon={Mail} label="Class" value={profile?.classId?.name} />
            <Detail icon={Mail} label="Parent" value={profile?.parentId ? fullName(profile.parentId) : null} />
            <div className="flex gap-2">
              <Link
                to={`/report-card/${user._id}`}
                className="inline-flex h-8 items-center rounded-md border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Report card
              </Link>
            </div>
          </div>
        )}

        {user.role === 'teacher' && (
          <div className="mt-4 flex flex-col gap-3">
            <div>
              <p className="text-xs text-gray-400">Subjects</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(profile?.subjects || []).length === 0 && <span className="text-sm text-gray-400">None assigned</span>}
                {(profile?.subjects || []).map((subject) => (
                  <Chip key={subject._id} className="bg-lama-sky-light text-sky-700">{subject.name}</Chip>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-400">Classes</p>
              <div className="mt-1 flex flex-wrap gap-1.5">
                {(profile?.classes || []).length === 0 && <span className="text-sm text-gray-400">None assigned</span>}
                {(profile?.classes || []).map((entry) => (
                  <Chip key={entry._id} className="bg-lama-purple-light text-indigo-700">{entry.name}</Chip>
                ))}
              </div>
            </div>
            {profile?.qualifications && <Detail icon={Mail} label="Qualifications" value={profile.qualifications} />}
          </div>
        )}

        {user.role === 'parent' && (
          <div className="mt-4 flex flex-col gap-2">
            <p className="text-xs text-gray-400">Children</p>
            {(profile?.children || []).length === 0 && <span className="text-sm text-gray-400">None linked</span>}
            {(profile?.children || []).map((child) => (
              <Link
                key={child._id}
                to={`/users/${child._id}`}
                className="flex items-center gap-3 rounded-md bg-gray-50 px-3 py-2 hover:bg-lama-purple-light"
              >
                <Avatar src={child.avatarUrl} name={child.firstName} size={28} />
                <span className="text-sm font-medium">{fullName(child)}</span>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
