import React, { useEffect, useState } from 'react';
import { subMonths } from 'date-fns';
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    LineChart,
    Line,
    Pie,
    PieChart,
    Cell,
} from 'recharts';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import { ChartCard } from './ChartCard';
import { TimelineSwitch } from './TimelineSwitch';
import analyticsApi from '@/api/analytics';

const CHART_COLORS = {
    primary: '#0ea5e9',
    success: '#22c55e',
};

const COLORS = [
    "#b3afb4ff",
    "#3b82f6",
    "#10b981",
    "#f59e0b"
];

// Reusable Chart/Table Toggle
const ViewToggle = ({ view, onChange }) => (
    <div className="flex border border-border rounded-lg overflow-hidden text-[11px] bg-background">
        <button
            onClick={() => onChange('chart')}
            className={`px-2.5 py-1 font-semibold transition-all ${
                view === 'chart' 
                    ? 'bg-primary text-white border-primary' 
                    : 'text-muted-foreground hover:bg-muted'
            }`}
        >
            Chart
        </button>
        <button
            onClick={() => onChange('table')}
            className={`px-2.5 py-1 font-semibold transition-all ${
                view === 'table' 
                    ? 'bg-primary text-white border-primary' 
                    : 'text-muted-foreground hover:bg-muted'
            }`}
        >
            Table
        </button>
    </div>
);

// Standardized Unified Chart Filters Component
const ChartFilters = ({ status, onStatusChange, age, onAgeChange, range, onRangeChange }) => {
    return (
        <div className="flex items-center gap-2 flex-wrap">
            <Select value={status} onValueChange={onStatusChange}>
                <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
                    <SelectValue placeholder="Patient Status" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-xs">All Patients</SelectItem>
                    <SelectItem value="alive_active" className="text-xs">Alive & Active</SelectItem>
                    <SelectItem value="inactive" className="text-xs">Alive & Inactive</SelectItem>
                    <SelectItem value="dead" className="text-xs">Deceased</SelectItem>
                </SelectContent>
            </Select>
            <Select value={age} onValueChange={onAgeChange}>
                <SelectTrigger className="w-[130px] h-8 text-xs font-semibold bg-background border-border">
                    <SelectValue placeholder="Age Group" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all" className="text-xs">All Ages</SelectItem>
                    <SelectItem value="child_adolescent" className="text-xs">Child & Adolescent (1-19)</SelectItem>
                    <SelectItem value="adults" className="text-xs">Adults (19-59)</SelectItem>
                    <SelectItem value="older_adults" className="text-xs">Older Adults (&gt;=60)</SelectItem>
                </SelectContent>
            </Select>
            <TimelineSwitch
                value={range}
                onChange={onRangeChange}
            />
        </div>
    );
};

// Inline Data Table Components
const HomeVisitsTable = ({ data }) => (
    <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
        <table className="min-w-full divide-y divide-border text-xs text-left">
            <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Month</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Completed Home Visits</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={2} className="p-3 text-center text-muted-foreground">No data available</td>
                    </tr>
                ) : (
                    data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-medium text-foreground">{item.month}</td>
                            <td className="p-3 text-right font-mono text-foreground">{item.count}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

const VisitTypeTable = ({ data }) => (
    <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
        <table className="min-w-full divide-y divide-border text-xs text-left">
            <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Month</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Initial Visits</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Follow-up Visits</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Total Visits</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="p-3 text-center text-muted-foreground">No data available</td>
                    </tr>
                ) : (
                    data.map((item, idx) => {
                        const total = (item.initial || 0) + (item.follow_up || 0);
                        return (
                            <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                <td className="p-3 font-medium text-foreground">{item.month}</td>
                                <td className="p-3 text-right font-mono text-foreground">{item.initial || 0}</td>
                                <td className="p-3 text-right font-mono text-foreground">{item.follow_up || 0}</td>
                                <td className="p-3 text-right font-mono font-semibold text-foreground">{total}</td>
                            </tr>
                        );
                    })
                )}
            </tbody>
        </table>
    </div>
);

const AverageVisitsTable = ({ data }) => (
    <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
        <table className="min-w-full divide-y divide-border text-xs text-left">
            <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Month</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Average Visits/Patient</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={2} className="p-3 text-center text-muted-foreground">No data available</td>
                    </tr>
                ) : (
                    data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-medium text-foreground">{item.month}</td>
                            <td className="p-3 text-right font-mono text-foreground">{item.average_visits}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

const VisitFrequencyTable = ({ data }) => {
    const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
    return (
        <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
            <table className="min-w-full divide-y divide-border text-xs text-left">
                <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                    <tr>
                        <th className="p-3 font-semibold text-muted-foreground">Visit Category</th>
                        <th className="p-3 font-semibold text-muted-foreground text-right">Patient Count</th>
                        <th className="p-3 font-semibold text-muted-foreground text-right">Percentage</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {data.length === 0 || total === 0 ? (
                        <tr>
                            <td colSpan={3} className="p-3 text-center text-muted-foreground">No data available</td>
                        </tr>
                    ) : (
                        data.map((item, idx) => {
                            const pct = total > 0 ? ((item.value / total) * 100).toFixed(1) : '0.0';
                            return (
                                <tr key={idx} className="hover:bg-muted/10 transition-colors">
                                    <td className="p-3 font-medium text-foreground">{item.name}</td>
                                    <td className="p-3 text-right font-mono text-foreground">{item.value || 0}</td>
                                    <td className="p-3 text-right font-mono text-muted-foreground">{pct}%</td>
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>
        </div>
    );
};

const CalendarTimeToFirstVisitTable = ({ data }) => (
    <div className="h-[300px] overflow-y-auto border border-border rounded-lg bg-card custom-scrollbar">
        <table className="min-w-full divide-y divide-border text-xs text-left">
            <thead className="bg-muted/50 sticky top-0 backdrop-blur-sm z-10">
                <tr>
                    <th className="p-3 font-semibold text-muted-foreground">Month</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Working/Operational Days Avg</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Calendar Days Avg</th>
                    <th className="p-3 font-semibold text-muted-foreground text-right">Cohort Size (Patients)</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-border">
                {data.length === 0 ? (
                    <tr>
                        <td colSpan={4} className="p-3 text-center text-muted-foreground">No data available</td>
                    </tr>
                ) : (
                    data.map((item, idx) => (
                        <tr key={idx} className="hover:bg-muted/10 transition-colors">
                            <td className="p-3 font-medium text-foreground">{item.month}</td>
                            <td className="p-3 text-right font-mono text-foreground">{item.average_days} Days</td>
                            <td className="p-3 text-right font-mono text-foreground">{item.calendar_days} Days</td>
                            <td className="p-3 text-right font-mono text-muted-foreground">{item.patient_count}</td>
                        </tr>
                    ))
                )}
            </tbody>
        </table>
    </div>
);

export const VisitAnalysisView = () => {
    // 1. Home Visits States
    const [homeVisitsRange, setHomeVisitsRange] = useState('1M');
    const [homeVisitsDateRange, setHomeVisitsDateRange] = useState({
        from: subMonths(new Date(), 1),
        to: new Date()
    });
    const [homeVisitsStatus, setHomeVisitsStatus] = useState('all');
    const [homeVisitsAge, setHomeVisitsAge] = useState('all');
    const [homeVisitsData, setHomeVisitsData] = useState([]);
    const [homeVisitsLoading, setHomeVisitsLoading] = useState(true);
    const [homeVisitsView, setHomeVisitsView] = useState('chart');

    // 2. Initial vs Follow-up States
    const [visitTypeRange, setVisitTypeRange] = useState('1M');
    const [visitTypeDateRange, setVisitTypeDateRange] = useState({
        from: subMonths(new Date(), 1),
        to: new Date()
    });
    const [visitTypeStatus, setVisitTypeStatus] = useState('all');
    const [visitTypeAge, setVisitTypeAge] = useState('all');
    const [visitTypeData, setVisitTypeData] = useState([]);
    const [visitTypeLoading, setVisitTypeLoading] = useState(true);
    const [visitTypeView, setVisitTypeView] = useState('chart');

    // 3. Average Visits States
    const [avgVisitsRange, setAvgVisitsRange] = useState('1M');
    const [avgVisitsDateRange, setAvgVisitsDateRange] = useState({
        from: subMonths(new Date(), 1),
        to: new Date()
    });
    const [avgVisitsStatus, setAvgVisitsStatus] = useState('all');
    const [avgVisitsAge, setAvgVisitsAge] = useState('all');
    const [averageVisitsData, setAverageVisitsData] = useState([]);
    const [avgVisitsLoading, setAvgVisitsLoading] = useState(true);
    const [avgVisitsView, setAvgVisitsView] = useState('chart');

    // 4. Visit Frequency States
    const [visitFreqRange, setVisitFreqRange] = useState('1M');
    const [visitFreqDateRange, setVisitFreqDateRange] = useState({
        from: subMonths(new Date(), 1),
        to: new Date()
    });
    const [visitFreqStatus, setVisitFreqStatus] = useState('all');
    const [visitFreqAge, setVisitFreqAge] = useState('all');
    const [visitFrequencyData, setVisitFrequencyData] = useState([]);
    const [visitFreqLoading, setVisitFreqLoading] = useState(true);
    const [visitFreqView, setVisitFreqView] = useState('chart');

    // 5. Avg. Time to First Visit States (Historical & Recent)
    const [averageTimeToFirstVisitBefore, setAverageTimeToFirstVisitBefore] = useState(0);
    const [calendarTimeToFirstVisitBefore, setCalendarTimeToFirstVisitBefore] = useState(0);
    const [averageTimeToFirstVisitAfter, setAverageTimeToFirstVisitAfter] = useState(0);
    const [calendarTimeToFirstVisitAfter, setCalendarTimeToFirstVisitAfter] = useState(0);
    const [avgTimeLoadingBefore, setAvgTimeLoadingBefore] = useState(true);
    const [avgTimeLoadingAfter, setAvgTimeLoadingAfter] = useState(true);

    // 6. Time to First Visit Trend Chart States
    const [trendRange, setTrendRange] = useState('1M');
    const [trendDateRange, setTrendDateRange] = useState({
        from: subMonths(new Date(), 1),
        to: new Date()
    });
    const [trendStatus, setTrendStatus] = useState('all');
    const [trendAge, setTrendAge] = useState('all');
    const [trendView, setTrendView] = useState('chart');
    const [trendLoading, setTrendLoading] = useState(true);
    const [combinedTrendData, setCombinedTrendData] = useState([]);

    // 1. Fetch Home Visits
    useEffect(() => {
        let cancelled = false;
        const fetchHomeVisits = async () => {
            try {
                setHomeVisitsLoading(true);
                const res = await analyticsApi.getHomeVisitsByMonth({
                    start_date: homeVisitsDateRange.from.toISOString(),
                    end_date: homeVisitsDateRange.to.toISOString(),
                    patient_status: homeVisitsStatus !== 'all' ? homeVisitsStatus : undefined,
                    age_group: homeVisitsAge !== 'all' ? homeVisitsAge : undefined
                });
                if (!cancelled && res?.success) {
                    setHomeVisitsData(res.data || []);
                }
            } catch (err) {
                console.error('Error fetching home visits:', err);
            } finally {
                if (!cancelled) setHomeVisitsLoading(false);
            }
        };
        fetchHomeVisits();
        return () => { cancelled = true; };
    }, [homeVisitsDateRange, homeVisitsStatus, homeVisitsAge]);

    // 2. Fetch Visit Types
    useEffect(() => {
        let cancelled = false;
        const fetchVisitTypes = async () => {
            try {
                setVisitTypeLoading(true);
                const res = await analyticsApi.getVisitTypeByMonth({
                    start_date: visitTypeDateRange.from.toISOString(),
                    end_date: visitTypeDateRange.to.toISOString(),
                    patient_status: visitTypeStatus !== 'all' ? visitTypeStatus : undefined,
                    age_group: visitTypeAge !== 'all' ? visitTypeAge : undefined
                });
                if (!cancelled && res?.success) {
                    setVisitTypeData(res.data || []);
                }
            } catch (err) {
                console.error('Error fetching visit types:', err);
            } finally {
                if (!cancelled) setVisitTypeLoading(false);
            }
        };
        fetchVisitTypes();
        return () => { cancelled = true; };
    }, [visitTypeDateRange, visitTypeStatus, visitTypeAge]);

    // 3. Fetch Average Visits
    useEffect(() => {
        let cancelled = false;
        const fetchAvgVisits = async () => {
            try {
                setAvgVisitsLoading(true);
                const res = await analyticsApi.getAverageVisitsByMonth({
                    start_date: avgVisitsDateRange.from.toISOString(),
                    end_date: avgVisitsDateRange.to.toISOString(),
                    patient_status: avgVisitsStatus !== 'all' ? avgVisitsStatus : undefined,
                    age_group: avgVisitsAge !== 'all' ? avgVisitsAge : undefined
                });
                if (!cancelled && res?.success) {
                    setAverageVisitsData(res.data || []);
                }
            } catch (err) {
                console.error('Error fetching avg visits:', err);
            } finally {
                if (!cancelled) setAvgVisitsLoading(false);
            }
        };
        fetchAvgVisits();
        return () => { cancelled = true; };
    }, [avgVisitsDateRange, avgVisitsStatus, avgVisitsAge]);

    // 4. Fetch Visit Frequency
    useEffect(() => {
        let cancelled = false;
        const fetchVisitFreq = async () => {
            try {
                setVisitFreqLoading(true);
                const res = await analyticsApi.getVisitFrequencyDistribution({
                    start_date: visitFreqDateRange.from.toISOString(),
                    end_date: visitFreqDateRange.to.toISOString(),
                    patient_status: visitFreqStatus !== 'all' ? visitFreqStatus : undefined,
                    age_group: visitFreqAge !== 'all' ? visitFreqAge : undefined
                });
                if (!cancelled && res?.success && res.data) {
                    setVisitFrequencyData([
                        { name: "0 Visits", value: res.data.zero_visits },
                        { name: "1 Visit", value: res.data.one_visit },
                        { name: "2 Visits", value: res.data.two_visits },
                        { name: "3+ Visits", value: res.data.three_plus_visits }
                    ]);
                }
            } catch (err) {
                console.error('Error fetching visit frequency:', err);
            } finally {
                if (!cancelled) setVisitFreqLoading(false);
            }
        };
        fetchVisitFreq();
        return () => { cancelled = true; };
    }, [visitFreqDateRange, visitFreqStatus, visitFreqAge]);

    // 5. Fetch Avg. Time to First Visit (Before & After)
    useEffect(() => {
        let cancelled = false;
        
        const fetchAvgTimeBefore = async () => {
            try {
                setAvgTimeLoadingBefore(true);
                const res = await analyticsApi.getAverageTimeToFirstVisit({
                    end_date: '2026-07-31T23:59:59Z'
                });
                if (!cancelled && res?.success) {
                    setAverageTimeToFirstVisitBefore(res.data.average_days ?? 0);
                    setCalendarTimeToFirstVisitBefore(res.data.calendar_days ?? 0);
                }
            } catch (err) {
                console.error('Error fetching avg time before:', err);
            } finally {
                if (!cancelled) setAvgTimeLoadingBefore(false);
            }
        };

        const fetchAvgTimeAfter = async () => {
            try {
                setAvgTimeLoadingAfter(true);
                const res = await analyticsApi.getAverageTimeToFirstVisit({
                    start_date: '2026-08-01T00:00:00Z'
                });
                if (!cancelled && res?.success) {
                    setAverageTimeToFirstVisitAfter(res.data.average_days ?? 0);
                    setCalendarTimeToFirstVisitAfter(res.data.calendar_days ?? 0);
                }
            } catch (err) {
                console.error('Error fetching avg time after:', err);
            } finally {
                if (!cancelled) setAvgTimeLoadingAfter(false);
            }
        };

        fetchAvgTimeBefore();
        fetchAvgTimeAfter();
        return () => { cancelled = true; };
    }, []);

    // 6. Fetch Combined Trend Data for Time to First Visit (Chart)
    useEffect(() => {
        let cancelled = false;
        const fetchTrendData = async () => {
            try {
                setTrendLoading(true);
                const cutoffDate = new Date('2026-08-01T00:00:00Z');
                const cutoffDateEnd = new Date('2026-07-31T23:59:59Z');

                const fromDate = new Date(trendDateRange.from);
                const toDate = new Date(trendDateRange.to);

                const histStart = fromDate.toISOString();
                const histEnd = toDate.getTime() < cutoffDateEnd.getTime() ? toDate.toISOString() : cutoffDateEnd.toISOString();

                const recentStart = fromDate.getTime() > cutoffDate.getTime() ? fromDate.toISOString() : cutoffDate.toISOString();
                const recentEnd = toDate.toISOString();

                const reqPeriod = ['5Y', 'Max'].includes(trendRange)
                    ? 'yearly'
                    : ['1D', '5D', '1M'].includes(trendRange)
                    ? 'daily'
                    : 'monthly'; // 6M, 1Y, YTD

                const paramsBefore = {
                    start_date: histStart,
                    end_date: histEnd,
                    patient_status: trendStatus !== 'all' ? trendStatus : undefined,
                    age_group: trendAge !== 'all' ? trendAge : undefined,
                    period: reqPeriod
                };
                const paramsAfter = {
                    start_date: recentStart,
                    end_date: recentEnd,
                    patient_status: trendStatus !== 'all' ? trendStatus : undefined,
                    age_group: trendAge !== 'all' ? trendAge : undefined,
                    period: reqPeriod
                };
                
                let resBefore = null;
                let resAfter = null;
                const promises = [];

                if (fromDate.getTime() <= cutoffDateEnd.getTime() && new Date(histStart).getTime() <= new Date(histEnd).getTime()) {
                    promises.push(analyticsApi.getAverageTimeToFirstVisit(paramsBefore).then(res => { resBefore = res; }));
                } else {
                    resBefore = { success: true, data: { average_days: 0, calendar_days: 0, trend: [] } };
                }

                if (toDate.getTime() >= cutoffDate.getTime() && new Date(recentStart).getTime() <= new Date(recentEnd).getTime()) {
                    promises.push(analyticsApi.getAverageTimeToFirstVisit(paramsAfter).then(res => { resAfter = res; }));
                } else {
                    resAfter = { success: true, data: { average_days: 0, calendar_days: 0, trend: [] } };
                }

                await Promise.all(promises);

                if (!cancelled) {
                    const beforeTrend = resBefore?.success ? (resBefore.data.trend || []) : [];
                    const afterTrend = resAfter?.success ? (resAfter.data.trend || []) : [];
                    
                    // Merge trends chronologically and average overlapping intervals (like 2026) mathematically
                    const mergedMap = new Map();
                    beforeTrend.forEach(item => {
                        mergedMap.set(item.month, {
                            month: item.month,
                            total_working_days: (item.average_days || 0) * (item.patient_count || 0),
                            total_calendar_days: (item.calendar_days || 0) * (item.patient_count || 0),
                            patient_count: item.patient_count || 0
                        });
                    });
                    afterTrend.forEach(item => {
                        if (mergedMap.has(item.month)) {
                            const existing = mergedMap.get(item.month);
                            mergedMap.set(item.month, {
                                month: item.month,
                                total_working_days: existing.total_working_days + (item.average_days || 0) * (item.patient_count || 0),
                                total_calendar_days: existing.total_calendar_days + (item.calendar_days || 0) * (item.patient_count || 0),
                                patient_count: existing.patient_count + (item.patient_count || 0)
                            });
                        } else {
                            mergedMap.set(item.month, {
                                month: item.month,
                                total_working_days: (item.average_days || 0) * (item.patient_count || 0),
                                total_calendar_days: (item.calendar_days || 0) * (item.patient_count || 0),
                                patient_count: item.patient_count || 0
                            });
                        }
                    });

                    const mergedTrend = Array.from(mergedMap.values()).map(item => {
                        const cnt = item.patient_count;
                        return {
                            month: item.month,
                            average_days: cnt > 0 ? parseFloat((item.total_working_days / cnt).toFixed(1)) : 0,
                            calendar_days: cnt > 0 ? parseFloat((item.total_calendar_days / cnt).toFixed(1)) : 0,
                            patient_count: cnt
                        };
                    }).sort((a, b) => a.month.localeCompare(b.month));

                    setCombinedTrendData(mergedTrend);
                }
            } catch (err) {
                console.error('Error fetching trend data:', err);
            } finally {
                if (!cancelled) setTrendLoading(false);
            }
        };

        fetchTrendData();
        return () => { cancelled = true; };
    }, [trendStatus, trendAge, trendDateRange, trendRange]);

    return (
        <div className="grid gap-6 lg:grid-cols-2">
            {/* Home Visits */}
            <ChartCard
                title="Home Visits"
                description="Completed home visits grouped by timeline"
                isLoading={homeVisitsLoading}
                id="home-visits-chart"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
                    <ViewToggle view={homeVisitsView} onChange={setHomeVisitsView} />
                    <ChartFilters
                        status={homeVisitsStatus}
                        onStatusChange={setHomeVisitsStatus}
                        age={homeVisitsAge}
                        onAgeChange={setHomeVisitsAge}
                        range={homeVisitsRange}
                        onRangeChange={(val, range) => {
                            setHomeVisitsRange(val);
                            setHomeVisitsDateRange(range);
                        }}
                    />
                </div>
                {homeVisitsView === 'chart' ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={homeVisitsData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Bar
                                dataKey="count"
                                fill={CHART_COLORS.primary}
                                radius={[8, 8, 0, 0]}
                                name="Home Visits"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <HomeVisitsTable data={homeVisitsData} />
                )}
            </ChartCard>

            {/* Initial vs Follow-up */}
            <ChartCard
                title="Initial vs Follow-up Visits"
                description="Distribution of completed visit types"
                isLoading={visitTypeLoading}
                id="visit-type-chart"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
                    <ViewToggle view={visitTypeView} onChange={setVisitTypeView} />
                    <ChartFilters
                        status={visitTypeStatus}
                        onStatusChange={setVisitTypeStatus}
                        age={visitTypeAge}
                        onAgeChange={setVisitTypeAge}
                        range={visitTypeRange}
                        onRangeChange={(val, range) => {
                            setVisitTypeRange(val);
                            setVisitTypeDateRange(range);
                        }}
                    />
                </div>
                {visitTypeView === 'chart' ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={visitTypeData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <YAxis
                                allowDecimals={false}
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Bar
                                dataKey="initial"
                                stackId="visits"
                                fill={CHART_COLORS.success}
                                name="Initial"
                            />
                            <Bar
                                dataKey="follow_up"
                                stackId="visits"
                                fill={CHART_COLORS.primary}
                                name="Follow-up"
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <VisitTypeTable data={visitTypeData} />
                )}
            </ChartCard>

            {/* Average Visits */}
            <ChartCard
                title="Average Visits per Patient"
                description="Mean completed visit frequency. Formula: Total Completed Visits / Distinct Patients Visited"
                isLoading={avgVisitsLoading}
                id="average-visits-chart"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
                    <ViewToggle view={avgVisitsView} onChange={setAvgVisitsView} />
                    <ChartFilters
                        status={avgVisitsStatus}
                        onStatusChange={setAvgVisitsStatus}
                        age={avgVisitsAge}
                        onAgeChange={setAvgVisitsAge}
                        range={avgVisitsRange}
                        onRangeChange={(val, range) => {
                            setAvgVisitsRange(val);
                            setAvgVisitsDateRange(range);
                        }}
                    />
                </div>
                {avgVisitsView === 'chart' ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={averageVisitsData}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="month"
                                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                            />
                            <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend />
                            <Line
                                type="monotone"
                                dataKey="average_visits"
                                stroke="#3b82f6"
                                strokeWidth={3}
                                name="Average Visits"
                                dot={{ r: 4, fill: '#3b82f6' }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <AverageVisitsTable data={averageVisitsData} />
                )}
            </ChartCard>

            {/* Visit Frequency */}
            <ChartCard
                title="Patient by Visit Count"
                description="Distribution of total visits per patient"
                isLoading={visitFreqLoading}
                id="visit-frequency-chart"
            >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
                    <ViewToggle view={visitFreqView} onChange={setVisitFreqView} />
                    <ChartFilters
                        status={visitFreqStatus}
                        onStatusChange={setVisitFreqStatus}
                        age={visitFreqAge}
                        onAgeChange={setVisitFreqAge}
                        range={visitFreqRange}
                        onRangeChange={(val, range) => {
                            setVisitFreqRange(val);
                            setVisitFreqDateRange(range);
                        }}
                    />
                </div>
                {visitFreqView === 'chart' ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <PieChart>
                            <Pie
                                data={visitFrequencyData}
                                dataKey="value"
                                nameKey="name"
                                innerRadius={70}
                                outerRadius={100}
                                paddingAngle={3}
                            >
                                {visitFrequencyData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={COLORS[index % COLORS.length]}
                                    />
                                ))}
                            </Pie>
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'hsl(var(--card))',
                                    border: '1px solid hsl(var(--border))',
                                    borderRadius: '8px',
                                }}
                            />
                            <Legend verticalAlign="bottom" align="center" />
                        </PieChart>
                    </ResponsiveContainer>
                ) : (
                    <VisitFrequencyTable data={visitFrequencyData} />
                )}
            </ChartCard>

            {/* Time to First Visit (Before Aug 1, 2026) */}
            <Card className="overflow-hidden transition-all hover:shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        <span>Avg. Time to First Visit (Historical)</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold">Before Aug 1, 2026</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Formula: (Sum of Working Visit Days from Registration to First Initial Visit for all patients) ÷ (Total Number of Patients with an Initial Visit)
                    </p>
                </CardHeader>
                <CardContent>
                    {avgTimeLoadingBefore ? (
                        <Skeleton className="h-10 w-24 mt-2" />
                    ) : (
                        <div className="text-4xl font-extrabold text-foreground tracking-tight mt-2">
                            {averageTimeToFirstVisitBefore} <span className="text-lg font-medium text-muted-foreground">Days</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Time to First Visit (After Jul 31, 2026) */}
            <Card className="overflow-hidden transition-all hover:shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        <span>Avg. Time to First Visit (Recent)</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold">On/After Aug 1, 2026</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Formula: (Sum of Operational Scheduled Days from Registration to First Completed Visit for all patients) ÷ (Total Patients with a Completed Visit)
                    </p>
                </CardHeader>
                <CardContent>
                    {avgTimeLoadingAfter ? (
                        <Skeleton className="h-10 w-24 mt-2" />
                    ) : (
                        <div className="text-4xl font-extrabold text-foreground tracking-tight mt-2">
                            {averageTimeToFirstVisitAfter} <span className="text-lg font-medium text-muted-foreground">Days</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Time to First Visit (Historical) - Calendar Days */}
            <Card className="overflow-hidden transition-all hover:shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        <span>Avg. Time to First Visit (Historical) - Calendar Days</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold">Before Aug 1, 2026</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Formula: (Sum of Calendar Days from Registration to First Initial Visit for all patients) ÷ (Total Number of Patients with an Initial Visit)
                    </p>
                </CardHeader>
                <CardContent>
                    {avgTimeLoadingBefore ? (
                        <Skeleton className="h-10 w-24 mt-2" />
                    ) : (
                        <div className="text-4xl font-extrabold text-foreground tracking-tight mt-2">
                            {calendarTimeToFirstVisitBefore} <span className="text-lg font-medium text-muted-foreground">Days</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Time to First Visit (Recent) - Calendar Days */}
            <Card className="overflow-hidden transition-all hover:shadow-lg">
                <CardHeader>
                    <CardTitle className="text-sm font-medium text-muted-foreground flex items-center justify-between">
                        <span>Avg. Time to First Visit (Recent) - Calendar Days</span>
                        <span className="text-[10px] bg-muted px-2 py-0.5 rounded-full font-semibold">On/After Aug 1, 2026</span>
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                        Formula: (Sum of Calendar Days from Registration to First Completed Visit for all patients) ÷ (Total Patients with a Completed Visit)
                    </p>
                </CardHeader>
                <CardContent>
                    {avgTimeLoadingAfter ? (
                        <Skeleton className="h-10 w-24 mt-2" />
                    ) : (
                        <div className="text-4xl font-extrabold text-foreground tracking-tight mt-2">
                            {calendarTimeToFirstVisitAfter} <span className="text-lg font-medium text-muted-foreground">Days</span>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Time to First Visit Trend Chart Card (Full Width span-2) */}
            <div className="lg:col-span-2">
                <ChartCard
                    title="Average Time to First Visit Trend (Calendar Days)"
                    description="Cohort averages of registration to first completed visit in calendar days over time. Formula: (Sum of Calendar Days from Registration to First Completed Visit for patients in the cohort) ÷ (Total Patients with a Completed Visit in the cohort)"
                    isLoading={trendLoading}
                    id="first-visit-trend-chart"
                >
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 pb-3 mb-4 -mt-2">
                        <ViewToggle view={trendView} onChange={setTrendView} />
                        <ChartFilters
                            status={trendStatus}
                            onStatusChange={setTrendStatus}
                            age={trendAge}
                            onAgeChange={setTrendAge}
                            range={trendRange}
                            onRangeChange={(val, range) => {
                                setTrendRange(val);
                                setTrendDateRange(range);
                            }}
                        />
                    </div>
                    {trendView === 'chart' ? (
                        <ResponsiveContainer width="100%" height={300}>
                            <LineChart data={combinedTrendData}>
                                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                                <XAxis
                                    dataKey="month"
                                    tick={{ fill: 'hsl(var(--muted-foreground))' }}
                                />
                                <YAxis tick={{ fill: 'hsl(var(--muted-foreground))' }} />
                                <Tooltip
                                    contentStyle={{
                                        backgroundColor: 'hsl(var(--card))',
                                        border: '1px solid hsl(var(--border))',
                                        borderRadius: '8px',
                                    }}
                                />
                                <Legend />
                                <Line
                                    type="monotone"
                                    dataKey="calendar_days"
                                    stroke="#3b82f6"
                                    strokeWidth={3}
                                    name="Average Calendar Days"
                                    dot={{ r: 4, fill: '#3b82f6' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    ) : (
                        <CalendarTimeToFirstVisitTable data={combinedTrendData} />
                    )}
                </ChartCard>
            </div>
        </div>
    );
};