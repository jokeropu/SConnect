import { MoreHorizontal } from 'lucide-react';

const BG = {
  students: 'bg-lama-purple',
  teachers: 'bg-lama-yellow',
  parents: 'bg-lama-purple',
  staff: 'bg-lama-yellow',
};

export default function UserCard({ type, count, year = '2025/26', tone }) {
  return (
    <div className={`min-w-[130px] flex-1 rounded-2xl p-4 ${BG[tone || type] || 'bg-lama-sky'}`}>
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-white px-2 py-1 text-[10px] text-green-600">{year}</span>
        <MoreHorizontal className="h-5 w-5 text-gray-600" />
      </div>
      <h1 className="my-4 text-2xl font-semibold">{count ?? 0}</h1>
      <h2 className="text-sm font-medium capitalize text-gray-500">{type}</h2>
    </div>
  );
}
