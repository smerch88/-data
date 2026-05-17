// Lightweight bar chart for activity.loginsByDay (last ~28 days). No chart lib.
export function LoginBars({ data }: { data: { date: string; clicks: number }[] }) {
  if (!data.length) {
    return <div className="text-sm text-neutral-400 py-8 text-center">Немає даних про логіни</div>;
  }
  const max = Math.max(1, ...data.map((d) => d.clicks));
  return (
    <div className="flex items-end gap-[3px] h-[180px]">
      {data.map((d) => (
        <div key={d.date} className="flex-1 flex flex-col justify-end" title={`${d.date}: ${d.clicks}`}>
          <div
            className="w-full rounded-[3px] bg-brand/80 min-h-[2px]"
            style={{ height: `${(d.clicks / max) * 100}%` }}
          />
        </div>
      ))}
    </div>
  );
}
