import { useMemo } from 'react';

interface ContributionDay {
    date: string;
    count: number;
    repos: string[]; // List of repo names contributed to on this day
    commits: {
        message: string;
        repo: string;
        sha: string;
        time: string;
    }[];
}

interface ContributionGraphProps {
    data: ContributionDay[];
    year?: number;
    isLoading?: boolean;
    className?: string;
    onDayClick?: (data: ContributionDay) => void;
}



export function ContributionGraph({ data, year, isLoading = false, className = '', onDayClick }: ContributionGraphProps) {

    // Default to current year if not provided
    const targetYear = year || new Date().getFullYear();

    // Generate calendar grid for the year (or last 365 days)
    const calendarData = useMemo(() => {
        const today = new Date();
        const endDate = new Date(today);
        const startDate = new Date(today);
        startDate.setFullYear(today.getFullYear() - 1); // Last 365 days strategy like GitHub

        // Use a map for O(1) lookups
        const dataMap = new Map(data.map(d => [d.date, d]));

        const weeks: (ContributionDay | null)[][] = [];
        let currentWeek: (ContributionDay | null)[] = [];

        // Align start date to Sunday
        const dayOfWeek = startDate.getDay();
        for (let i = 0; i < dayOfWeek; i++) {
            currentWeek.push(null);
        }

        const msPerDay = 24 * 60 * 60 * 1000;
        for (let d = startDate.getTime(); d <= endDate.getTime(); d += msPerDay) {
            const dateObj = new Date(d);
            const dateStr = dateObj.toISOString().split('T')[0];
            const dayData = dataMap.get(dateStr) || { date: dateStr, count: 0, repos: [], commits: [] };

            currentWeek.push(dayData);

            if (currentWeek.length === 7) {
                weeks.push(currentWeek);
                currentWeek = [];
            }
        }
        if (currentWeek.length > 0) {
            while (currentWeek.length < 7) currentWeek.push(null);
            weeks.push(currentWeek);
        }

        return weeks;

    }, [data, targetYear]);

    // Color scale helper
    const getColor = (count: number) => {
        if (count === 0) return 'bg-slate-800/50';
        if (count <= 3) return 'bg-emerald-900/60';
        if (count <= 6) return 'bg-emerald-700/80';
        if (count <= 10) return 'bg-emerald-500';
        return 'bg-emerald-400';
    };

    return (
        <div className={`w-full overflow-x-auto ${className} ${isLoading ? 'opacity-50 pointer-events-none' : ''}`}>
            <div className="min-w-fit mx-auto select-none p-2">
                {/* Months Header */}
                <div className="flex text-xs text-slate-500 mb-2 pl-9 h-5 relative font-medium">
                    {(() => {
                        const monthLabels: React.ReactNode[] = [];
                        let currentMonth = -1;

                        calendarData.forEach((week, weekIndex) => {
                            const firstDay = week.find(d => d !== null);
                            if (firstDay) {
                                const date = new Date(firstDay.date);
                                const month = date.getMonth();

                                if (month !== currentMonth) {
                                    currentMonth = month;
                                    // Skip if too close to the end to avoid cutoff/overlap
                                    if (weekIndex < calendarData.length - 1) {
                                        monthLabels.push(
                                            <span
                                                key={`month-${weekIndex}`}
                                                className="absolute top-0"
                                                style={{ left: `${weekIndex * 16 + 36}px` }} // 12px width + 4px gap = 16px per week. 36px is boolean for pl-9
                                            >
                                                {date.toLocaleString('default', { month: 'short' })}
                                            </span>
                                        );
                                    }
                                }
                            }
                        });
                        return monthLabels;
                    })()}
                </div>

                <div className="flex gap-2">
                    {/* Day labels */}
                    <div className="flex flex-col gap-[4px] text-[10px] text-slate-400 font-medium pt-[16px] w-7 text-right leading-[12px]">
                        <span>Mon</span>
                        <span className="mt-[16px]">Wed</span>
                        <span className="mt-[16px]">Fri</span>
                    </div>

                    {/* Columns (Weeks) */}
                    <div className="flex gap-1">
                        {calendarData.map((week, wIndex) => (
                            <div key={wIndex} className="flex flex-col gap-1">
                                {week.map((day, dIndex) => (
                                    <div
                                        key={dIndex}
                                        onClick={() => {
                                            if (day && onDayClick) {
                                                onDayClick(day); // day is { date, count, repos }
                                            }
                                        }}
                                        className={`
                                            w-3 h-3 rounded-[2px] transition-all duration-200
                                            ${day
                                                ? (day.count > 0 ? getColor(day.count) : 'bg-[#161b22] hover:bg-[#1f2631]')
                                                : 'bg-transparent'
                                            }
                                            ${day && onDayClick ? 'cursor-pointer hover:ring-1 hover:ring-slate-400 hover:scale-110 hover:z-10' : ''}
                                        `}
                                        title={day ? `${day.count} contributions on ${day.date}` : ''}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>
                </div>

                {/* Legend */}
                <div className="flex items-center justify-end gap-2 mt-4 text-xs text-slate-500">
                    <span>Less</span>
                    <div className="flex gap-[3px]">
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-slate-800/50" />
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-900/60" />
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-700/80" />
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-500" />
                        <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400" />
                    </div>
                    <span>More</span>
                </div>
            </div>
        </div>
    );
}
