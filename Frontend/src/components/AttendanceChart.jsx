import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EmptyState } from '../design/primitives';

export default function AttendanceChart({ data }) {
  return (
    <div className="h-full rounded-lg bg-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Attendance</h1>
        <span className="text-xs text-gray-400">Last 7 days</span>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState title="No attendance yet" detail="Registers appear here once a teacher marks one." />
      ) : (
        <ResponsiveContainer width="100%" height="90%">
          <BarChart data={data} barSize={20}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#ddd" />
            <XAxis dataKey="name" axisLine={false} tick={{ fill: '#d1d5db' }} tickLine={false} />
            <YAxis axisLine={false} tick={{ fill: '#d1d5db' }} tickLine={false} />
            <Tooltip contentStyle={{ borderRadius: '10px', borderColor: 'lightgray' }} />
            <Legend align="left" verticalAlign="top" wrapperStyle={{ paddingTop: '20px', paddingBottom: '40px' }} />
            <Bar dataKey="present" fill="#C3EBFA" legendType="circle" radius={[10, 10, 0, 0]} />
            <Bar dataKey="absent" fill="#FAE27C" legendType="circle" radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
