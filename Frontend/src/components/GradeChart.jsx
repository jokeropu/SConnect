import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { EmptyState } from '../design/primitives';

export default function GradeChart({ data }) {
  return (
    <div className="h-full rounded-lg bg-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Grade distribution</h1>
        <span className="text-xs text-gray-400">All published results</span>
      </div>

      {!data || data.length === 0 ? (
        <EmptyState title="No results yet" detail="Grades appear once exam results are published." />
      ) : (
        <ResponsiveContainer width="100%" height="90%">
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#ddd" />
            <XAxis dataKey="name" axisLine={false} tick={{ fill: '#d1d5db' }} tickLine={false} tickMargin={10} />
            <YAxis axisLine={false} tick={{ fill: '#d1d5db' }} tickLine={false} tickMargin={20} />
            <Tooltip contentStyle={{ borderRadius: '10px', borderColor: 'lightgray' }} />
            <Legend align="center" verticalAlign="top" wrapperStyle={{ paddingTop: '10px', paddingBottom: '30px' }} />
            <Line type="monotone" dataKey="count" stroke="#CFCEFF" strokeWidth={4} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
