import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

export default function CountChart({ gender }) {
  const male = gender?.male || 0;
  const female = gender?.female || 0;
  const total = male + female + (gender?.other || 0);

  const data = [
    { name: 'Total', count: total || 1, fill: 'white' },
    { name: 'Girls', count: female, fill: '#FAE27C' },
    { name: 'Boys', count: male, fill: '#C3EBFA' },
  ];

  const pct = (value) => (total === 0 ? 0 : Math.round((value / total) * 100));

  return (
    <div className="h-full w-full rounded-xl bg-white p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Students</h1>
      </div>

      <div className="relative h-[75%] w-full">
        <ResponsiveContainer>
          <RadialBarChart cx="50%" cy="50%" innerRadius="40%" outerRadius="100%" barSize={32} data={data}>
            <RadialBar background dataKey="count" />
          </RadialBarChart>
        </ResponsiveContainer>
        <Users className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-gray-400" strokeWidth={1.5} />
      </div>

      <div className="flex justify-center gap-16">
        <div className="flex flex-col items-center gap-1">
          <div className="h-5 w-5 rounded-full bg-lama-sky" />
          <h2 className="font-bold">{male}</h2>
          <h3 className="text-xs text-gray-400">Boys ({pct(male)}%)</h3>
        </div>
        <div className="flex flex-col items-center gap-1">
          <div className="h-5 w-5 rounded-full bg-lama-yellow" />
          <h2 className="font-bold">{female}</h2>
          <h3 className="text-xs text-gray-400">Girls ({pct(female)}%)</h3>
        </div>
      </div>
    </div>
  );
}
