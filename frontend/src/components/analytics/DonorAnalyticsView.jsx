import { useState, useEffect, useMemo } from 'react';
import { format, subMonths } from 'date-fns';
import analyticsApi from '@/api/analytics';
import {
  RefreshCw, Users, Home, Activity, HeartPulse, Stethoscope, Printer,
  TrendingUp, TrendingDown, Pill, MapPin, Video, UsersRound,
  AlertCircle, Target, Repeat, UserCheck, Download, UserPlus,
  LayoutGrid, Table,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { exportChartAsSvg } from '@/utils/chartExport';
import { TimelineSwitch, getPeriodForTimelineRange } from '@/components/analytics/TimelineSwitch';

const PERIODS = [
  { value: 'daily', label: 'Daily' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'yearly', label: 'Yearly' },
];

const VISIT_LOCATION_COLORS = {
  home: '#10b981',
  opd: '#3b82f6',
  ipd: '#8b5cf6',
  phone: '#f59e0b',
  unknown: '#94a3b8',
};

const ROLE_LABEL = {
  physician: 'Physician',
  doctor: 'Physician',
  nurse: 'Nurse',
  physiotherapist: 'Physiotherapist',
  psycho_social: 'Psycho-social',
  'psycho-social': 'Psycho-social',
  social_worker: 'Social Worker',
  counsellor: 'Counsellor',
};

const fmtNumber = (n) => (n == null ? '—' : new Intl.NumberFormat('en-IN').format(n));

const Delta = ({ deltaPct }) => {
  if (deltaPct == null) {
    return (
      <Badge variant="outline" className="text-[10px] text-muted-foreground">
        No prior data
      </Badge>
    );
  }
  if (deltaPct === 0) {
    return <Badge variant="outline" className="text-[10px]">No change</Badge>;
  }
  const up = deltaPct > 0;
  return (
    <Badge
      variant="outline"
      className={`text-[10px] ${up
        ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
        : 'border-rose-300 bg-rose-50 text-rose-700'}`}
    >
      {up ? <TrendingUp className="h-3 w-3 mr-1" /> : <TrendingDown className="h-3 w-3 mr-1" />}
      {Math.abs(deltaPct)}%
    </Badge>
  );
};
const GraphTableSwitcher = ({ activeView, onViewChange, className }) => {
  return (
    <div className={`inline-flex items-center p-1 bg-muted/60 backdrop-blur-sm rounded-lg border border-border/60 shadow-sm ${className || ''}`}>
      <button
        onClick={() => onViewChange('graph')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          activeView === 'graph'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        <LayoutGrid className="h-3.5 w-3.5" />
        <span>Graph</span>
      </button>
      <button
        onClick={() => onViewChange('table')}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ${
          activeView === 'table'
            ? "bg-background text-foreground shadow-sm scale-100"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        }`}
      >
        <Table className="h-3.5 w-3.5" />
        <span>Table</span>
      </button>
    </div>
  );
};

const TimeInCareTable = ({ data, total }) => {
  return (
    <div className="overflow-x-auto border border-border rounded-lg bg-background">
      <table className="w-full text-xs text-left text-foreground">
        <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
          <tr>
            <th className="px-4 py-2.5">Duration Bucket</th>
            <th className="px-4 py-2.5">Clinical Indication</th>
            <th className="px-4 py-2.5 text-right">Patient Count</th>
            <th className="px-4 py-2.5 text-right">Percentage</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, idx) => {
            const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
            return (
              <tr key={idx} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3.5 font-medium">{row.label}</td>
                <td className="px-4 py-3.5 text-muted-foreground">{row.desc}</td>
                <td className="px-4 py-3.5 text-right font-medium">{row.count}</td>
                <td className="px-4 py-3.5 text-right text-muted-foreground">{pct}%</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const VehicleUtilizationTable = ({ data }) => {
  return (
    <div className="overflow-x-auto border border-border rounded-lg bg-background">
      <table className="w-full text-xs text-left text-foreground">
        <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
          <tr>
            <th className="px-4 py-2.5">Vehicle</th>
            <th className="px-4 py-2.5 text-right">Total Visits</th>
            <th className="px-4 py-2.5 text-right">Avg Visits / Active Wk</th>
            <th className="px-4 py-2.5 text-right">Utilization</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.map((row, idx) => {
            return (
              <tr key={idx} className="hover:bg-muted/40 transition-colors">
                <td className="px-4 py-3.5 font-medium">{row.name}</td>
                <td className="px-4 py-3.5 text-right font-medium">{row.total}</td>
                <td className="px-4 py-3.5 text-right text-muted-foreground">{row.avg}</td>
                <td className="px-4 py-3.5 text-right text-muted-foreground font-semibold">
                  <span className={row.utilization >= 70 ? 'text-emerald-600' : row.utilization >= 40 ? 'text-amber-600' : 'text-rose-600'}>
                    {row.utilization}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const TimeToFirstVisitTable = ({ data, total }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Duration Cohort</th>
          <th className="px-4 py-2.5">Target Status</th>
          <th className="px-4 py-2.5 text-right">Patient Count</th>
          <th className="px-4 py-2.5 text-right">Percentage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => {
          const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
          return (
            <tr key={idx} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3.5 font-medium">{row.label}</td>
              <td className="px-4 py-3.5">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                  row.within ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                }`}>
                  {row.within ? 'Within target' : 'Outside target'}
                </span>
              </td>
              <td className="px-4 py-3.5 text-right font-medium">{row.count}</td>
              <td className="px-4 py-3.5 text-right text-muted-foreground">{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const DeathsByLocationTable = ({ data, total }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Place of Death</th>
          <th className="px-4 py-2.5 text-right">Death Count</th>
          <th className="px-4 py-2.5 text-right">Percentage</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => {
          const pct = total > 0 ? ((row.count / total) * 100).toFixed(1) : '0.0';
          return (
            <tr key={idx} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3.5 font-medium">{row.location}</td>
              <td className="px-4 py-3.5 text-right font-medium">{row.count}</td>
              <td className="px-4 py-3.5 text-right text-muted-foreground">{pct}%</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const VisitsByLocationTable = ({ data }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Period</th>
          <th className="px-4 py-2.5 text-right">Home</th>
          <th className="px-4 py-2.5 text-right">OPD</th>
          <th className="px-4 py-2.5 text-right">IPD</th>
          <th className="px-4 py-2.5 text-right">Phone</th>
          <th className="px-4 py-2.5 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => {
          const total = (row.home || 0) + (row.opd || 0) + (row.ipd || 0) + (row.phone || 0) + (row.unknown || 0);
          return (
            <tr key={idx} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3.5 font-medium">{row.label}</td>
              <td className="px-4 py-3.5 text-right">{row.home || 0}</td>
              <td className="px-4 py-3.5 text-right">{row.opd || 0}</td>
              <td className="px-4 py-3.5 text-right">{row.ipd || 0}</td>
              <td className="px-4 py-3.5 text-right">{row.phone || 0}</td>
              <td className="px-4 py-3.5 text-right font-semibold">{total}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const DistanceCoveredTable = ({ data }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Week Start</th>
          <th className="px-4 py-2.5 text-right">Kilometres Covered</th>
          <th className="px-4 py-2.5 text-right">Completed Visits</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => (
          <tr key={idx} className="hover:bg-muted/40 transition-colors">
            <td className="px-4 py-3.5 font-medium">{row.label}</td>
            <td className="px-4 py-3.5 text-right font-medium text-teal-600">{row.km} km</td>
            <td className="px-4 py-3.5 text-right text-muted-foreground">{row.slots}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TelemedicineConsultationsTable = ({ data }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Period</th>
          <th className="px-4 py-2.5 text-right">Sessions Count</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => (
          <tr key={idx} className="hover:bg-muted/40 transition-colors">
            <td className="px-4 py-3.5 font-medium">{row.label}</td>
            <td className="px-4 py-3.5 text-right font-semibold text-cyan-600">{row.sessions}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const FollowupsTable = ({ data }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Period</th>
          <th className="px-4 py-2.5 text-right">Follow-ups Volume</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => (
          <tr key={idx} className="hover:bg-muted/40 transition-colors">
            <td className="px-4 py-3.5 font-medium">{row.label}</td>
            <td className="px-4 py-3.5 text-right font-semibold text-sky-600">{row.count}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const DeathsByZoneTable = ({ data, places }) => (
  <div className="overflow-x-auto border border-border rounded-lg bg-background">
    <table className="w-full text-xs text-left text-foreground">
      <thead className="bg-muted text-muted-foreground uppercase text-[10px] tracking-wider font-semibold border-b border-border">
        <tr>
          <th className="px-4 py-2.5">Zone</th>
          {places.map(p => (
            <th key={p} className="px-4 py-2.5 text-right">
              {p.charAt(0).toUpperCase() + p.slice(1).replace('_', ' ')}
            </th>
          ))}
          <th className="px-4 py-2.5 text-right">Total</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-border">
        {data.map((row, idx) => {
          let sumVal = 0;
          places.forEach(p => { sumVal += row[p] || 0; });
          return (
            <tr key={idx} className="hover:bg-muted/40 transition-colors">
              <td className="px-4 py-3.5 font-medium">{row.zone}</td>
              {places.map(p => (
                <td key={p} className="px-4 py-3.5 text-right">{row[p] || 0}</td>
              ))}
              <td className="px-4 py-3.5 text-right font-semibold">{sumVal}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

const StatTile = ({ title, value, deltaPct, prevValue, allTimeValue, footer, Icon, iconClass, isLoading }) => (
  <Card className="overflow-hidden transition-all hover:shadow-md">
    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      {Icon && (
        <div className={`p-2 rounded-full ${iconClass}`}>
          <Icon className="h-4 w-4 text-white" />
        </div>
      )}
    </CardHeader>
    <CardContent>
      {isLoading ? (
        <>
          <Skeleton className="h-8 w-20 mb-2" />
          <Skeleton className="h-4 w-32" />
        </>
      ) : (
        <>
          <div className="text-3xl font-bold flex items-baseline flex-wrap">
            <span>{typeof value === 'number' ? fmtNumber(value) : value}</span>
            {allTimeValue !== undefined && allTimeValue !== null && (
              <span className="text-xs font-normal text-muted-foreground ml-1.5 whitespace-nowrap">
                / {typeof allTimeValue === 'number' ? fmtNumber(allTimeValue) : allTimeValue} total
              </span>
            )}
          </div>
          {(deltaPct !== undefined || footer) && (
            <div className="flex items-center gap-2 mt-2">
              {deltaPct !== undefined && (
                <>
                  <Delta deltaPct={deltaPct} />
                  <span className="text-xs text-muted-foreground">
                    vs {fmtNumber(prevValue)} prev
                  </span>
                </>
              )}
              {footer && (
                <span className="text-xs text-muted-foreground">{footer}</span>
              )}
            </div>
          )}
        </>
      )}
    </CardContent>
  </Card>
);

export const DonorAnalyticsView = ({ dateRange }) => {
  const [period, setPeriod] = useState('monthly');
  const [error, setError] = useState(null);

  // 1. Overview / Headline states
  const [overviewRange, setOverviewRange] = useState('1M');
  const [overviewDateRange, setOverviewDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [overview, setOverview] = useState(null);
  const [multidisc, setMultidisc] = useState(null);
  const [lossToFollowup, setLossToFollowup] = useState(null);
  const [overviewLoading, setOverviewLoading] = useState(true);

  // 2. Time to first visit (cohort analysis)
  const [rfvRange, setRfvRange] = useState('1M');
  const [rfvDateRange, setRfvDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [firstVisit, setFirstVisit] = useState(null);
  const [rfvView, setRfvView] = useState('graph');
  const [rfvLoading, setRfvLoading] = useState(true);

  // 3. Deaths by location
  const [podLocationRange, setPodLocationRange] = useState('1M');
  const [podLocationDateRange, setPodLocationDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [placeOfDeathLocation, setPlaceOfDeathLocation] = useState(null);
  const [podLocationView, setPodLocationView] = useState('graph');
  const [podLocationLoading, setPodLocationLoading] = useState(true);

  // 4. Visits over time, by location
  const [visitsTimelineRange, setVisitsTimelineRange] = useState('1M');
  const [visitsDateRange, setVisitsDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [localVisitsTimeline, setLocalVisitsTimeline] = useState(null);
  const [visitsTimelineView, setVisitsTimelineView] = useState('graph');
  const [visitsLoading, setVisitsLoading] = useState(true);

  // 5. Kilometres covered
  const [distRange, setDistRange] = useState('1M');
  const [distDateRange, setDistDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [distanceTimeline, setDistanceTimeline] = useState(null);
  const [distView, setDistView] = useState('graph');
  const [distLoading, setDistLoading] = useState(true);

  // 6. Deaths over time
  const [deathsRange, setDeathsRange] = useState('1M');
  const [deathsDateRange, setDeathsDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [deathsTimeline, setDeathsTimeline] = useState(null);
  const [deathsLoading, setDeathsLoading] = useState(true);

  // 7. Consultation mix (by team role)
  const [cmRange, setCmRange] = useState('1M');
  const [cmDateRange, setCmDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [consultationsMix, setConsultationsMix] = useState(null);
  const [cmLoading, setCmLoading] = useState(true);

  // 8. WHO Pain Analgesic Ladder vs. Pain Score
  const [painRange, setPainRange] = useState('1M');
  const [painDateRange, setPainDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [painLadder, setPainLadder] = useState([]);
  const [painLoading, setPainLoading] = useState(true);

  // 9. Telemedicine consultations
  const [teleRange, setTeleRange] = useState('1M');
  const [teleDateRange, setTeleDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [teleTimeline, setTeleTimeline] = useState(null);
  const [teleView, setTeleView] = useState('graph');
  const [teleLoading, setTeleLoading] = useState(true);

  // 10. Follow-up visits over time
  const [fuRange, setFuRange] = useState('1M');
  const [fuDateRange, setFuDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [followups, setFollowups] = useState(null);
  const [fuView, setFuView] = useState('graph');
  const [fuLoading, setFuLoading] = useState(true);

  // 11. Place of death, by zone
  const [podZoneRange, setPodZoneRange] = useState('1M');
  const [podZoneDateRange, setPodZoneDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [placeOfDeathZone, setPlaceOfDeathZone] = useState(null);
  const [podZoneView, setPodZoneView] = useState('graph');
  const [podZoneLoading, setPodZoneLoading] = useState(true);

  // 12. Time in care (enrolment -> death)
  const [etdRange, setEtdRange] = useState('1M');
  const [etdDateRange, setEtdDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [enrollmentDeath, setEnrollmentDeath] = useState(null);
  const [etdStartEvent, setEtdStartEvent] = useState('registration');
  const [etdView, setEtdView] = useState('graph');
  const [etdAgeGroup, setEtdAgeGroup] = useState('all');
  const [etdLoading, setEtdLoading] = useState(true);

  // 13. Vehicle utilization
  const [vehRange, setVehRange] = useState('1M');
  const [vehDateRange, setVehDateRange] = useState({
    from: subMonths(new Date(), 1),
    to: new Date()
  });
  const [vehicleUtil, setVehicleUtil] = useState(null);
  const [vehView, setVehView] = useState('graph');
  const [vehLoading, setVehLoading] = useState(true);

  const getPeriodForTimelineRange = (r) => {
    if (['1D', '5D', '1M'].includes(r)) return 'daily';
    if (['6M', '1Y', 'YTD'].includes(r)) return 'monthly';
    if (['5Y', 'Max'].includes(r)) return 'yearly';
    return 'monthly';
  };

  // Helper function to build params
  const getParams = (dateRange, range = null) => {
    let activePeriod = period;
    if (range) {
      activePeriod = getPeriodForTimelineRange(range);
    }
    return {
      start_date: format(dateRange.from, 'yyyy-MM-dd'),
      end_date: format(dateRange.to, 'yyyy-MM-dd'),
      period: activePeriod,
    };
  };

  // Fetch 1: Overview
  const loadOverview = async () => {
    try {
      setOverviewLoading(true);
      const params = getParams(overviewDateRange);
      const [ov, md, ltf] = await Promise.all([
        analyticsApi.getDonorOverview(params),
        analyticsApi.getDonorDonorMultidisciplinary ? analyticsApi.getDonorDonorMultidisciplinary(params) : analyticsApi.getDonorMultidisciplinary(params),
        analyticsApi.getDonorLossToFollowup(params)
      ]);
      setOverview(ov);
      setMultidisc(md);
      setLossToFollowup(ltf);
    } catch (e) {
      console.error(e);
      setError('Failed to load overview metrics.');
    } finally {
      setOverviewLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, [overviewDateRange, period]);

  // Fetch 2: Time to first visit
  useEffect(() => {
    let active = true;
    const fetchFirstVisit = async () => {
      try {
        setRfvLoading(true);
        const res = await analyticsApi.getDonorRegistrationToFirstVisit(getParams(rfvDateRange));
        if (active) setFirstVisit(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setRfvLoading(false);
      }
    };
    fetchFirstVisit();
    return () => { active = false; };
  }, [rfvDateRange]);

  // Fetch 3: Deaths by location
  useEffect(() => {
    let active = true;
    const fetchPlaceOfDeathLoc = async () => {
      try {
        setPodLocationLoading(true);
        const res = await analyticsApi.getDonorPlaceOfDeathByZone(getParams(podLocationDateRange));
        if (active) setPlaceOfDeathLocation(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setPodLocationLoading(false);
      }
    };
    fetchPlaceOfDeathLoc();
    return () => { active = false; };
  }, [podLocationDateRange]);

  // Fetch 4: Visits timeline
  useEffect(() => {
    let active = true;
    const fetchLocalVisits = async () => {
      try {
        setVisitsLoading(true);
        const reqPeriod = getPeriodForTimelineRange(visitsTimelineRange);

        const res = await analyticsApi.getDonorVisitsTimeline({
          start_date: format(visitsDateRange.from, 'yyyy-MM-dd'),
          end_date: format(visitsDateRange.to, 'yyyy-MM-dd'),
          period: reqPeriod,
        });
        if (active) setLocalVisitsTimeline(res);
      } catch (e) {
        console.error(e);
      } finally {
        if (active) setVisitsLoading(false);
      }
    };
    fetchLocalVisits();
    return () => { active = false; };
  }, [visitsDateRange, visitsTimelineRange]);

  // Fetch 5: Kilometres covered
  useEffect(() => {
    let active = true;
    const fetchDistance = async () => {
      try {
        setDistLoading(true);
        const res = await analyticsApi.getDonorDistanceTimeline(getParams(distDateRange, distRange));
        if (active) setDistanceTimeline(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setDistLoading(false);
      }
    };
    fetchDistance();
    return () => { active = false; };
  }, [distDateRange, distRange]);

  // Fetch 6: Deaths timeline
  useEffect(() => {
    let active = true;
    const fetchDeaths = async () => {
      try {
        setDeathsLoading(true);
        const res = await analyticsApi.getDonorDeathsTimeline(getParams(deathsDateRange, deathsRange));
        if (active) setDeathsTimeline(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setDeathsLoading(false);
      }
    };
    fetchDeaths();
    return () => { active = false; };
  }, [deathsDateRange, deathsRange]);

  // Fetch 7: Consultation mix
  useEffect(() => {
    let active = true;
    const fetchConsultations = async () => {
      try {
        setCmLoading(true);
        const res = await analyticsApi.getDonorConsultationsMix(getParams(cmDateRange, cmRange));
        if (active) setConsultationsMix(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setCmLoading(false);
      }
    };
    fetchConsultations();
    return () => { active = false; };
  }, [cmDateRange, cmRange]);

  // Fetch 8: Pain Ladder
  useEffect(() => {
    let active = true;
    const fetchPain = async () => {
      try {
        setPainLoading(true);
        const res = await analyticsApi.getDonorPainLadder(getParams(painDateRange, painRange));
        if (active) setPainLadder(res?.data || res || []);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setPainLoading(false);
      }
    };
    fetchPain();
    return () => { active = false; };
  }, [painDateRange, painRange]);

  // Fetch 9: Telemedicine
  useEffect(() => {
    let active = true;
    const fetchTele = async () => {
      try {
        setTeleLoading(true);
        const res = await analyticsApi.getDonorTelemedicineTimeline(getParams(teleDateRange, teleRange));
        if (active) setTeleTimeline(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setTeleLoading(false);
      }
    };
    fetchTele();
    return () => { active = false; };
  }, [teleDateRange, teleRange]);

  // Fetch 10: Followups
  useEffect(() => {
    let active = true;
    const fetchFollowups = async () => {
      try {
        setFuLoading(true);
        const res = await analyticsApi.getDonorFollowups(getParams(fuDateRange, fuRange));
        if (active) setFollowups(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setFuLoading(false);
      }
    };
    fetchFollowups();
    return () => { active = false; };
  }, [fuDateRange, fuRange]);

  // Fetch 11: Place of death, by zone
  useEffect(() => {
    let active = true;
    const fetchPlaceOfDeathZone = async () => {
      try {
        setPodZoneLoading(true);
        const res = await analyticsApi.getDonorPlaceOfDeathByZone(getParams(podZoneDateRange));
        if (active) setPlaceOfDeathZone(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setPodZoneLoading(false);
      }
    };
    fetchPlaceOfDeathZone();
    return () => { active = false; };
  }, [podZoneDateRange]);

  // Fetch 12: Time in care
  useEffect(() => {
    let active = true;
    const fetchEnrollmentDeath = async () => {
      try {
        setEtdLoading(true);
        const params = {
          ...getParams(etdDateRange),
          start_event: etdStartEvent,
          age_group: etdAgeGroup,
        };
        const res = await analyticsApi.getDonorEnrollmentToDeath(params);
        if (active) setEnrollmentDeath(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setEtdLoading(false);
      }
    };
    fetchEnrollmentDeath();
    return () => { active = false; };
  }, [etdDateRange, etdStartEvent, etdAgeGroup]);

  // Fetch 13: Vehicle utilization
  useEffect(() => {
    let active = true;
    const fetchVehicleUtil = async () => {
      try {
        setVehLoading(true);
        const res = await analyticsApi.getDonorVehicleUtilization(getParams(vehDateRange));
        if (active) setVehicleUtil(res);
      } catch (err) {
        console.error(err);
      } finally {
        if (active) setVehLoading(false);
      }
    };
    fetchVehicleUtil();
    return () => { active = false; };
  }, [vehDateRange]);

  // Memoized Chart Preparations
  const firstVisitDistData = useMemo(() => {
    if (!firstVisit?.distribution) return [];
    const { labels = [], data = [] } = firstVisit.distribution;
    const target = firstVisit.target_homecare_days ?? 8;
    return labels.map((label, idx) => {
      const hiNum = (() => {
        if (label.endsWith('+')) return Infinity;
        const m = label.match(/(\d+)\s*(?:HC-days|–\s*(\d+))?/);
        if (!m) return null;
        return parseInt(m[2] || m[1], 10);
      })();
      const within = hiNum !== null && hiNum !== Infinity && hiNum <= target;
      return { label, count: data[idx] || 0, within };
    });
  }, [firstVisit]);

  const deathsByLocationData = useMemo(() => {
    if (!placeOfDeathLocation?.places || !placeOfDeathLocation?.totals_by_place) return [];
    return placeOfDeathLocation.places.map((p, i) => ({
      location: p.charAt(0).toUpperCase() + p.slice(1).replace('_', ' '),
      count: placeOfDeathLocation.totals_by_place[i] || 0,
      key: p,
    }));
  }, [placeOfDeathLocation]);

  const visitsChartData = useMemo(() => {
    if (!localVisitsTimeline) return [];
    return (localVisitsTimeline.labels || []).map((label, idx) => {
      const row = { label };
      (localVisitsTimeline.series || []).forEach(s => { row[s.name] = s.data[idx] || 0; });
      return row;
    });
  }, [localVisitsTimeline]);

  const distanceChartData = useMemo(() => {
    if (!distanceTimeline) return [];
    return (distanceTimeline.labels || []).map((label, idx) => {
      let displayLabel = label;
      try {
        displayLabel = format(new Date(label), 'MMM d');
      } catch (err) {}
      return {
        label: displayLabel,
        km: distanceTimeline.km_per_week[idx] || 0,
        slots: distanceTimeline.slots_per_week[idx] || 0,
      };
    });
  }, [distanceTimeline]);

  const deathsChartData = useMemo(() => {
    if (!deathsTimeline) return [];
    return (deathsTimeline.labels || []).map((label, idx) => ({
      label, deaths: deathsTimeline.data[idx] || 0,
    }));
  }, [deathsTimeline]);

  const consultationsChartData = useMemo(() => {
    if (!consultationsMix) return [];
    return (consultationsMix.labels || []).map((role, idx) => ({
      role: ROLE_LABEL[role] || role.replace(/_/g, ' '),
      count: consultationsMix.data[idx] || 0,
    }));
  }, [consultationsMix]);

  const painLadderStats = useMemo(() => {
    let totalAssessed = 0;
    let step3Count = 0;
    let step2Count = 0;
    let step1Count = 0;
    let noAnalgesicCount = 0;

    painLadder.forEach(item => {
      noAnalgesicCount += item['No Analgesic'] || 0;
      step1Count += item['Step 1 (Non-Opioid)'] || 0;
      step2Count += item['Step 2 (Weak Opioid)'] || 0;
      step3Count += item['Step 3 (Strong Opioid)'] || 0;
    });

    totalAssessed = noAnalgesicCount + step1Count + step2Count + step3Count;
    const totalOnAnalgesics = step1Count + step2Count + step3Count;
    return {
      totalAssessed,
      totalOnAnalgesics,
      step1Count,
      step2Count,
      step3Count,
      noAnalgesicCount
    };
  }, [painLadder]);

  const teleChartData = useMemo(() => {
    if (!teleTimeline) return [];
    return (teleTimeline.labels || []).map((label, idx) => ({
      label, sessions: teleTimeline.data[idx] || 0,
    }));
  }, [teleTimeline]);

  const followupChartData = useMemo(() => {
    if (!followups) return [];
    return (followups.labels || []).map((label, idx) => ({
      label, count: followups.data[idx] || 0,
    }));
  }, [followups]);

  const placeOfDeathChartData = useMemo(() => {
    if (!placeOfDeathZone) return [];
    const { zones = [], places = [], matrix = [] } = placeOfDeathZone;
    return zones.map((zone, i) => {
      const row = { zone };
      places.forEach((p, j) => { row[p] = matrix[i]?.[j] || 0; });
      return row;
    });
  }, [placeOfDeathZone]);

  const enrollmentDeathChartData = useMemo(() => {
    if (!enrollmentDeath) return [];
    return (enrollmentDeath.labels || []).map((label, idx) => ({
      label,
      count: enrollmentDeath.data[idx] || 0,
      desc: enrollmentDeath.descriptions?.[idx] || '',
    }));
  }, [enrollmentDeath]);

  const vehicleChartData = useMemo(() => {
    if (!vehicleUtil) return [];
    return (vehicleUtil.vehicles || []).map(v => ({
      name: v.name + (v.registration ? ` (${v.registration})` : ''),
      total: v.total_slots,
      avg: v.avg_slots_per_active_week,
      utilization: v.utilization_pct,
    }));
  }, [vehicleUtil]);

  const PLACE_COLORS = {
    home: '#10b981', hospital: '#ef4444', in_transit: '#f59e0b', unknown: '#94a3b8', others: '#a78bfa',
  };

  const m = overview?.metrics || {};

  return (
    <div className="space-y-6">
      {/* Overview Sub-controls */}
      <div className="flex items-center justify-between flex-wrap gap-4 bg-card border border-border rounded-xl p-4 shadow-sm">
        <div className="space-y-0.5">
          <h3 className="text-sm font-semibold text-foreground">Overview Timeline & Grouping</h3>
          <p className="text-xs text-muted-foreground">Select date range and bucket intervals for top-line stewardship metrics</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <TimelineSwitch
            value={overviewRange}
            onChange={(val, range) => {
              setOverviewRange(val);
              setOverviewDateRange(range);
            }}
          />
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Period" />
            </SelectTrigger>
            <SelectContent>
              {PERIODS.map(p => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={loadOverview} disabled={overviewLoading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${overviewLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-4 w-4 mr-1" /> PDF
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="py-3 text-sm text-red-700">{error}</CardContent>
        </Card>
      )}

      {/* Row 1 — Volume */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          title="New registrations"
          value={m.new_registrations?.value} prevValue={m.new_registrations?.previous}
          deltaPct={m.new_registrations?.delta_pct} Icon={UserPlus}
          iconClass="bg-blue-600" isLoading={overviewLoading}
          allTimeValue={m.new_registrations?.all_time}
        />
        <StatTile
          title="Unique patients seen"
          value={m.patients_seen?.value} prevValue={m.patients_seen?.previous}
          deltaPct={m.patients_seen?.delta_pct} Icon={Users}
          iconClass="bg-blue-500" isLoading={overviewLoading}
          footer="Counted once per period"
          allTimeValue={m.patients_seen?.all_time}
        />
        <StatTile
          title="Total visits" value={m.total_visits?.value} prevValue={m.total_visits?.previous}
          deltaPct={m.total_visits?.delta_pct} Icon={Activity}
          iconClass="bg-indigo-500" isLoading={overviewLoading}
          allTimeValue={m.total_visits?.all_time}
        />
        <StatTile
          title="Home-care: first visit"
          value={m.home_first_visits?.value} prevValue={m.home_first_visits?.previous}
          deltaPct={m.home_first_visits?.delta_pct} Icon={UserCheck}
          iconClass="bg-emerald-600" isLoading={overviewLoading}
          footer="visit_type = initial (home / opd)"
          allTimeValue={m.home_first_visits?.all_time}
        />
        <StatTile
          title="Home-care: follow-up"
          value={m.home_follow_up_visits?.value} prevValue={m.home_follow_up_visits?.previous}
          deltaPct={m.home_follow_up_visits?.delta_pct} Icon={Repeat}
          iconClass="bg-emerald-500" isLoading={overviewLoading}
          footer="visit_type = follow_up"
          allTimeValue={m.home_follow_up_visits?.all_time}
        />
      </div>

      {/* Row 2 — Quality / ToC-aligned StatCards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile
          title="Consultations" value={m.consultations?.value} prevValue={m.consultations?.previous}
          deltaPct={m.consultations?.delta_pct} Icon={Stethoscope}
          iconClass="bg-violet-500" isLoading={overviewLoading}
          allTimeValue={m.consultations?.all_time}
        />
        <StatTile
          title="KMs covered (est.)"
          value={distanceTimeline?.total_km ?? 0}
          footer={distanceTimeline ? `${distanceTimeline.avg_km_per_visit} km/visit avg` : '—'}
          Icon={MapPin} iconClass="bg-teal-500" isLoading={overviewLoading || distLoading}
          allTimeValue={distanceTimeline?.all_time_km}
        />
        <StatTile
          title="Lost to follow-up"
          value={lossToFollowup?.total_count ?? 0}
          footer={lossToFollowup ? `${lossToFollowup.threshold_days}+ days no visit` : '—'}
          Icon={AlertCircle} iconClass="bg-orange-500" isLoading={overviewLoading}
          allTimeValue={lossToFollowup?.all_time_total}
        />
        <StatTile
          title="Telemedicine" value={teleTimeline?.total ?? 0}
          footer={teleTimeline ? `${teleTimeline.video_count} video / ${teleTimeline.voice_count} voice` : '—'}
          Icon={Video} iconClass="bg-cyan-500" isLoading={overviewLoading || teleLoading}
          allTimeValue={teleTimeline?.all_time_total}
        />
        <StatTile
          title="Deaths" value={m.deaths?.value} prevValue={m.deaths?.previous}
          deltaPct={m.deaths?.delta_pct} Icon={HeartPulse}
          iconClass="bg-rose-500" isLoading={overviewLoading}
          allTimeValue={m.deaths?.all_time}
        />
      </div>

      {/* Row 3 — Time to First Visit + Deaths by Location */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Time to First Visit */}
        <Card id="donor-first-visit-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Target className="h-4 w-4 text-emerald-600" />
              Time to first visit
              {firstVisit && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  Target ≤ {firstVisit.target_homecare_days} home-care days
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              <GraphTableSwitcher
                activeView={rfvView}
                onViewChange={setRfvView}
              />
              <TimelineSwitch
                value={rfvRange}
                onChange={(val, range) => {
                  setRfvRange(val);
                  setRfvDateRange(range);
                }}
              />
              {!rfvLoading && firstVisit && firstVisit.cohort_size > 0 && (
                <button
                  onClick={() => exportChartAsSvg('donor-first-visit-chart', 'donor-time-to-first-visit.svg')}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                  title="Download Chart SVG"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {rfvLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : !firstVisit || firstVisit.cohort_size === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No patients with a first completed visit in this window.
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="rounded-md border bg-emerald-50 border-emerald-200 p-2">
                    <div className="text-[11px] text-emerald-800 font-medium">Within target</div>
                    <div className="text-xl font-bold text-emerald-900">
                      {firstVisit.within_target} <span className="text-xs font-normal">/ {firstVisit.cohort_size}</span>
                    </div>
                    <div className="text-[10px] text-emerald-700">{firstVisit.within_target_pct}%</div>
                  </div>
                  <div className="rounded-md border bg-amber-50 border-amber-200 p-2">
                    <div className="text-[11px] text-amber-800 font-medium">Outside target</div>
                    <div className="text-xl font-bold text-amber-900">{firstVisit.outside_target}</div>
                    <div className="text-[10px] text-amber-700">
                      &gt; {firstVisit.target_homecare_days} HC-days
                    </div>
                  </div>
                  <div className="rounded-md border bg-slate-50 border-slate-200 p-2">
                    <div className="text-[11px] text-slate-700 font-medium">Median · p90</div>
                    <div className="text-xl font-bold text-slate-900">
                      {firstVisit.median_homecare_days} <span className="text-xs font-normal">· {firstVisit.p90_homecare_days}</span>
                    </div>
                    <div className="text-[10px] text-slate-600">HC-days</div>
                  </div>
                </div>
                {rfvView === 'graph' ? (
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={firstVisitDistData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" name="Patients">
                        {firstVisitDistData.map((d, i) => (
                          <Cell key={i} fill={d.within ? '#10b981' : '#f59e0b'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <TimeToFirstVisitTable data={firstVisitDistData} total={firstVisit.cohort_size} />
                )}
                <p className="text-[11px] text-muted-foreground mt-2 italic">
                  {firstVisit.note}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        {/* Deaths by location */}
        <Card id="donor-deaths-location-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-rose-500" />
              Deaths by location
              {placeOfDeathLocation?.grand_total !== undefined && (
                <Badge variant="outline" className="ml-auto text-[10px]">
                  {placeOfDeathLocation.grand_total} total
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-3">
              <GraphTableSwitcher
                activeView={podLocationView}
                onViewChange={setPodLocationView}
              />
              <TimelineSwitch
                value={podLocationRange}
                onChange={(val, range) => {
                  setPodLocationRange(val);
                  setPodLocationDateRange(range);
                }}
              />
              {!podLocationLoading && placeOfDeathLocation && placeOfDeathLocation.grand_total > 0 && (
                <button
                  onClick={() => exportChartAsSvg('donor-deaths-location-chart', 'donor-deaths-by-location.svg')}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                  title="Download Chart SVG"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {podLocationLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : deathsByLocationData.length === 0 || placeOfDeathLocation?.grand_total === 0 ? (
              <div className="h-[200px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No place-of-death records yet. Once the zone-wise line-list is ingested, this card lights up automatically.
              </div>
            ) : (
              <>
                {podLocationView === 'graph' ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={deathsByLocationData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                      <YAxis type="category" dataKey="location" tick={{ fontSize: 12 }} width={100} />
                      <Tooltip />
                      <Bar dataKey="count" name="Deaths">
                        {deathsByLocationData.map((d, i) => (
                          <Cell key={i} fill={PLACE_COLORS[d.key] || '#94a3b8'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <DeathsByLocationTable data={deathsByLocationData} total={placeOfDeathLocation?.grand_total} />
                )}
                <p className="text-[11px] text-muted-foreground mt-2 italic">
                  Higher share at home is a sign of effective palliation. See zone breakdown below for geographic detail.
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Visits over time */}
      <Card id="donor-visits-time-chart" className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 flex-wrap gap-2">
          <CardTitle className="text-base">Visits over time, by location</CardTitle>
          <div className="flex items-center gap-3">
            <GraphTableSwitcher
              activeView={visitsTimelineView}
              onViewChange={setVisitsTimelineView}
            />
            <TimelineSwitch
              value={visitsTimelineRange}
              onChange={(val, range) => {
                setVisitsTimelineRange(val);
                setVisitsDateRange(range);
              }}
            />
            {!visitsLoading && visitsChartData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('donor-visits-time-chart', 'donor-visits-over-time.svg')}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {visitsLoading ? (
            <Skeleton className="h-[280px] w-full" />
          ) : visitsChartData.length === 0 ? (
            <div className="h-[280px] flex items-center justify-center text-sm text-muted-foreground">
              No visits recorded for this period.
            </div>
          ) : (
            <>
              {visitsTimelineView === 'graph' ? (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={visitsChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    {localVisitsTimeline?.series?.map(s => (
                      <Bar
                        key={s.name} dataKey={s.name} stackId="loc"
                        fill={VISIT_LOCATION_COLORS[s.name] || '#94a3b8'}
                        name={s.name.charAt(0).toUpperCase() + s.name.slice(1)}
                      />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <VisitsByLocationTable data={visitsChartData} />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* KMs per week */}
      <Card id="donor-km-covered-chart" className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Kilometres covered, week over week</CardTitle>
          <div className="flex items-center gap-3">
            <GraphTableSwitcher
              activeView={distView}
              onViewChange={setDistView}
            />
            <TimelineSwitch
              value={distRange}
              onChange={(val, range) => {
                setDistRange(val);
                setDistDateRange(range);
              }}
            />
            {!distLoading && distanceChartData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('donor-km-covered-chart', 'donor-distance-covered.svg')}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {distLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : distanceChartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              No approved weekly schedules in this range.
            </div>
          ) : (
            <>
              {distView === 'graph' ? (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={distanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(value, name) =>
                        name === 'km'
                          ? [`${value} km`, 'Distance']
                          : [`${value} slots`, 'Scheduled visits']
                      }
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="km" fill="#0d9488" name="km" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <DistanceCoveredTable data={distanceChartData} />
              )}
            </>
          )}
          <p className="text-[11px] text-muted-foreground mt-2 italic">
            {distanceTimeline?.note}
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Telemedicine */}
        <Card id="donor-telemedicine-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Telemedicine consultations</CardTitle>
            <div className="flex items-center gap-3">
              <GraphTableSwitcher
                activeView={teleView}
                onViewChange={setTeleView}
              />
              <TimelineSwitch
                value={teleRange}
                onChange={(val, range) => {
                  setTeleRange(val);
                  setTeleDateRange(range);
                }}
              />
              {!teleLoading && teleChartData.length > 0 && teleTimeline?.total > 0 && (
                <button
                  onClick={() => exportChartAsSvg('donor-telemedicine-chart', 'donor-telemedicine-consultations.svg')}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                  title="Download Chart SVG"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {teleLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : teleChartData.length === 0 || teleTimeline?.total === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
                No teleconsult sessions in this period.
              </div>
            ) : (
              <>
                {teleView === 'graph' ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <LineChart data={teleChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Line type="monotone" dataKey="sessions" stroke="#06b6d4"
                            strokeWidth={2} dot={{ r: 3 }} name="Sessions" />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <TelemedicineConsultationsTable data={teleChartData} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Follow-ups */}
        <Card id="donor-followups-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Follow-up visits over time</CardTitle>
            <div className="flex items-center gap-3">
              <GraphTableSwitcher
                activeView={fuView}
                onViewChange={setFuView}
              />
              <TimelineSwitch
                value={fuRange}
                onChange={(val, range) => {
                  setFuRange(val);
                  setFuDateRange(range);
                }}
              />
              {!fuLoading && followupChartData.length > 0 && followups?.total_followup_visits > 0 && (
                <button
                  onClick={() => exportChartAsSvg('donor-followups-chart', 'donor-followups-over-time.svg')}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                  title="Download Chart SVG"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {fuLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : followupChartData.length === 0 || followups?.total_followup_visits === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No follow-up visits recorded for this period.
              </div>
            ) : (
              <>
                {fuView === 'graph' ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={followupChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#0ea5e9" name="Follow-ups" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <FollowupsTable data={followupChartData} />
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Place of death, by zone */}
        <Card id="donor-place-of-death-zone-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base">Place of death, by zone</CardTitle>
            <div className="flex items-center gap-3">
              <GraphTableSwitcher
                activeView={podZoneView}
                onViewChange={setPodZoneView}
              />
              <TimelineSwitch
                value={podZoneRange}
                onChange={(val, range) => {
                  setPodZoneRange(val);
                  setPodZoneDateRange(range);
                }}
              />
              {!podZoneLoading && placeOfDeathChartData.length > 0 && placeOfDeathZone?.grand_total > 0 && (
                <button
                  onClick={() => exportChartAsSvg('donor-place-of-death-zone-chart', 'donor-place-of-death-by-zone.svg')}
                  className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                  title="Download Chart SVG"
                >
                  <Download className="h-4 w-4" />
                </button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {podZoneLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : placeOfDeathChartData.length === 0 || placeOfDeathZone?.grand_total === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No deceased patients with zone + place data in this period.
              </div>
            ) : (
              <>
                {podZoneView === 'graph' ? (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={placeOfDeathChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="zone" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      {placeOfDeathZone?.places?.map(p => (
                        <Bar
                          key={p} dataKey={p} stackId="place"
                          fill={PLACE_COLORS[p] || '#94a3b8'}
                          name={p.charAt(0).toUpperCase() + p.slice(1).replace('_', ' ')}
                        />
                      ))}
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <DeathsByZoneTable data={placeOfDeathChartData} places={placeOfDeathZone?.places || []} />
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Time in care */}
        <Card id="donor-time-in-care-chart" className="transition-all hover:shadow-lg">
          <CardHeader className="flex flex-col space-y-3 pb-2">
            <div className="flex items-center justify-between w-full">
              <CardTitle className="text-base">Time in care</CardTitle>
              <div className="flex items-center gap-3">
                <GraphTableSwitcher
                  activeView={etdView}
                  onViewChange={setEtdView}
                />
                <TimelineSwitch
                  value={etdRange}
                  onChange={(val, range) => {
                    setEtdRange(val);
                    setEtdDateRange(range);
                  }}
                />
                {!etdLoading && enrollmentDeath && enrollmentDeath.total_deceased_with_enrollment > 0 && (
                  <button
                    onClick={() => exportChartAsSvg('donor-time-in-care-chart', 'donor-time-in-care.svg')}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                    title="Download Chart SVG"
                  >
                    <Download className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={etdStartEvent} onValueChange={setEtdStartEvent}>
                <SelectTrigger className="w-[180px] h-8 text-xs font-semibold bg-background border-border">
                  <SelectValue placeholder="Perspective" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registration" className="text-xs">Registration to Death</SelectItem>
                  <SelectItem value="initial_visit" className="text-xs">Initial Visit to Death</SelectItem>
                </SelectContent>
              </Select>
              <Select value={etdAgeGroup} onValueChange={setEtdAgeGroup}>
                <SelectTrigger className="w-[140px] h-8 text-xs font-semibold bg-background border-border">
                  <SelectValue placeholder="Age Group" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Ages</SelectItem>
                  <SelectItem value="child_adolescent" className="text-xs">Child & Adolescent (&lt;19)</SelectItem>
                  <SelectItem value="adults" className="text-xs">Adults (19-59)</SelectItem>
                  <SelectItem value="older_adults" className="text-xs">Older Adults (&ge;60)</SelectItem>
                  <SelectItem value="unknown" className="text-xs">Unknown Age</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            {etdLoading ? (
              <Skeleton className="h-[240px] w-full" />
            ) : !enrollmentDeath || enrollmentDeath.total_deceased_with_enrollment === 0 ? (
              <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground text-center px-4">
                No deceased patients matching the selected filters in this period.
              </div>
            ) : (
              <>
                {etdView === 'graph' ? (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={enrollmentDeathChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value, _name, ctx) =>
                          [`${value} patients · ${ctx.payload.desc}`, 'Count']
                        }
                      />
                      <Bar dataKey="count" fill="#dc2626" name="Patients" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <TimeInCareTable
                    data={enrollmentDeathChartData}
                    total={enrollmentDeath.total_deceased_with_enrollment}
                  />
                )}
                <div className="text-[11px] text-muted-foreground mt-2 grid grid-cols-3 gap-2">
                  <div>
                    <div className="font-semibold">Median</div>
                    <div>{enrollmentDeath.median_days_in_care} days</div>
                  </div>
                  <div>
                    <div className="font-semibold">IQR</div>
                    <div>{enrollmentDeath.q1_days_in_care}–{enrollmentDeath.q3_days_in_care} days</div>
                  </div>
                  <div>
                    <div className="font-semibold">Late referrals</div>
                    <div>{enrollmentDeath.late_referral_count} ({enrollmentDeath.late_referral_pct}%)</div>
                  </div>
                </div>
                <p className="text-[11px] text-muted-foreground mt-2 italic">
                  {etdStartEvent === 'registration'
                    ? 'Heavy left tail (0–7 days) flags a referral-pipeline problem — patients arriving too late to benefit from palliation.'
                    : 'Time elapsed between the patient\'s first clinical interaction (completed initial visit) and death.'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Vehicle utilization */}
      <Card id="donor-vehicle-utilization-chart" className="transition-all hover:shadow-lg">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-base">Vehicle utilization</CardTitle>
          <div className="flex items-center gap-3">
            <GraphTableSwitcher
              activeView={vehView}
              onViewChange={setVehView}
            />
            <TimelineSwitch
              value={vehRange}
              onChange={(val, range) => {
                setVehRange(val);
                setVehDateRange(range);
              }}
            />
            {!vehLoading && vehicleChartData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('donor-vehicle-utilization-chart', 'donor-vehicle-utilization.svg')}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {vehLoading ? (
            <Skeleton className="h-[240px] w-full" />
          ) : vehicleChartData.length === 0 ? (
            <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground">
              No scheduled visits in this period.
            </div>
          ) : (
            <>
              {vehView === 'graph' ? (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={vehicleChartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={140} />
                    <Tooltip
                      formatter={(value, name) => {
                        if (name === 'utilization') return [`${value}%`, 'Utilization'];
                        if (name === 'avg') return [`${value} slots/wk`, 'Avg/active wk'];
                        return [`${value}`, 'Total slots'];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total" fill="#0d9488" name="total" />
                    <Bar dataKey="utilization" fill="#f59e0b" name="utilization" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <VehicleUtilizationTable data={vehicleChartData} />
              )}
              <p className="text-[11px] text-muted-foreground mt-2 italic">
                Utilization = avg slots / active week ÷ target {vehicleUtil?.target_slots_per_week} (configurable via ANALYTICS_TARGET_SLOTS_PER_WEEK env).
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {/* Footnote */}
      <div className="text-xs text-muted-foreground text-center pt-2">
        Saranam Palliative Care · Donor / ToC view
        {overview && (
          <>
            {' '}· compared with {overview.previous_range?.start} → {overview.previous_range?.end}
          </>
        )}
      </div>
    </div>
  );
};

export default DonorAnalyticsView;
