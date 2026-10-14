import React, { useEffect, useState } from 'react';
import { subMonths } from 'date-fns';

import pptChartsApi from '@/api/pptCharts';
import StatCard from './ppt_charts/shared/cards/StatCard';
import DateRangeFilter from './ppt_charts/shared/filters/DateRangeFilter';
import MonthlyRegistrationTrend from './ppt_charts/MonthlyRegistrationTrend';
import AgeCategoryChart from './ppt_charts/AgeCategoryChart';
import GenderProfileChart from './ppt_charts/GenderProfileChart';
import ZoneCategorizationChart from './ppt_charts/ZoneCategorizationChart';
import ZoneSeenChart from './ppt_charts/ZoneSeenChart';
import DistanceDistributionChart from './ppt_charts/DistanceDistributionChart';
import DistanceSeenChart from './ppt_charts/DistanceSeenChart';
import VisitsCategorizationChart from './ppt_charts/VisitsCategorizationChart';
import VisitTypeAnalysisChart from './ppt_charts/VisitTypeAnalysisChart';
import ResponsivenessAnalysisChart from './ppt_charts/ResponsivenessAnalysisChart';
import HomecareDeclineChart from './ppt_charts/HomecareDeclineChart';
import PhoneCallDistributionChart from './ppt_charts/PhoneCallDistributionChart';
import PhoneCallTrendChart from './ppt_charts/PhoneCallTrendChart';
import ConsultationBreakupChart from './ppt_charts/ConsultationBreakupChart';
import MonthlyConsultationTrendChart from './ppt_charts/MonthlyConsultationTrendChart';
import ConsultationSplitChart from './ppt_charts/ConsultationSplitChart';
import ClinicalProceduresTrendChart from './ppt_charts/ClinicalProceduresTrendChart';
import PpsAnalysisChart from './ppt_charts/PpsAnalysisChart';
import PatientCategoryChart from './ppt_charts/PatientCategoryChart';
import CancerCategoryChart from './ppt_charts/CancerCategoryChart';
import PlaceOfDeathChart from './ppt_charts/PlaceOfDeathChart';
import MonthlyDeathsChart from './ppt_charts/MonthlyDeathsChart';
import VehicleDistanceChart from './ppt_charts/VehicleDistanceChart';
import HomecareVisitsChart from './ppt_charts/HomecareVisitsChart';
import HomecareDaysChart from './ppt_charts/HomecareDaysChart';
import ResponsivenessHomecareChart from './ppt_charts/ResponsivenessHomecareChart';




export function PptAnalyticsView() {
  const [globalDateRange, setGlobalDateRange] = useState(() => ({
    from: subMonths(new Date(), 1),
    to: new Date(),
  }));
  const [totalPatients, setTotalPatients] = useState(null);
  const [overviewStats, setOverviewStats] = useState({
    total_patients: null,
    total_vehicles: null,
    total_distance: null,
    total_homecare_days: null,
    total_homecare_visits: null,
    patients_seen: null,
    avg_homecare_visits: null,
    age_breakdown: null,
    home_consultations: null,
    phone_consultations: null,
    clinical_procedures_home: null,
    number_of_deaths: null,
    deaths_before_first_visit: null,
    avg_days_regn_to_death: null,
    deaths_at_home_pct: null,
  });
  const [loadingPatients, setLoadingPatients] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchTotal = async () => {
      try {
        setLoadingPatients(true);
        const params = {
          start_date: globalDateRange?.from ? globalDateRange.from.toISOString().split('T')[0] : undefined,
          end_date: globalDateRange?.to ? globalDateRange.to.toISOString().split('T')[0] : undefined,
        };

        const res = await pptChartsApi.getOverviewStats(params);
        if (isMounted) {
          const total = res?.total_patients ?? 0;
          setTotalPatients(total);
          setOverviewStats({
            total_patients: total,
            total_vehicles: res?.total_vehicles ?? 0,
            total_distance: res?.total_distance ?? 0,
            total_homecare_days: res?.total_homecare_days ?? 0,
            total_homecare_visits: res?.total_homecare_visits ?? 0,
            patients_seen: res?.patients_seen ?? 0,
            avg_homecare_visits: res?.avg_homecare_visits ?? 0,
            age_breakdown: res?.age_breakdown ?? null,
            home_consultations: res?.home_consultations ?? 0,
            phone_consultations: res?.phone_consultations ?? 0,
            clinical_procedures_home: res?.clinical_procedures_home ?? 0,
            number_of_deaths: res?.number_of_deaths ?? 0,
            deaths_before_first_visit: res?.deaths_before_first_visit ?? 0,
            avg_days_regn_to_death: res?.avg_days_regn_to_death ?? 0,
            deaths_at_home_pct: res?.deaths_at_home_pct ?? 0,
          });
        }
      } catch (err) {
        console.error('Failed to fetch total patients count:', err);
      } finally {
        if (isMounted) setLoadingPatients(false);
      }
    };

    fetchTotal();
    return () => {
      isMounted = false;
    };
  }, [globalDateRange]);

  const milestoneCards = [
    {
      value: '01.02.26',
      label: 'Start of Kidwai-Saranam Program',
    },
    {
      value: '09.03.26',
      label: 'First Home-Care Visit',
    },
    {
      value: '15.05.26',
      label: '2ⁿᵈ Home-Care Vehicle Added',
    },
  ];

  const operationalCards = [
    {
      value: loadingPatients ? '—' : String(overviewStats.total_vehicles ?? 0).padStart(2, '0'),
      label: 'Number of Home-care Vehicles',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.total_distance ?? 0).toLocaleString(),
      label: 'Total Distance Covered',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.total_homecare_days ?? 0).toLocaleString(),
      label: 'Total Home-Care Days',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.total_homecare_visits ?? 0).toLocaleString(),
      label: 'Total Home-Care Visits',
      isLoading: loadingPatients,
    },
  ];

  const patientReachCards = [
    {
      value: loadingPatients ? '—' : (overviewStats.total_patients ?? 0).toLocaleString(),
      label: 'Total Registered Patients',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.patients_seen ?? 0).toLocaleString(),
      label: 'Patients seen at least once',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.avg_homecare_visits ?? 0).toFixed(2),
      label: 'Average Home-Care Visits',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.age_breakdown?.display ?? '—'),
      label: 'Children | Adults | Older Adults',
      isLoading: loadingPatients,
    },
  ];

  const consultationCards = [
    {
      value: loadingPatients ? '—' : (overviewStats.home_consultations ?? 0).toLocaleString(),
      label: 'Number of Home-based Consultations',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.phone_consultations ?? 0).toLocaleString(),
      label: 'Number of Phone - Consultations',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.clinical_procedures_home ?? 0).toLocaleString(),
      label: 'Number of Clinical Procedures at-home',
      isLoading: loadingPatients,
    },
  ];

  const mortalityCards = [
    {
      value: loadingPatients ? '—' : (overviewStats.number_of_deaths ?? 0).toLocaleString(),
      label: 'Number of Deaths',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.deaths_before_first_visit ?? 0).toLocaleString(),
      label: 'Deaths Before First Visit',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : (overviewStats.avg_days_regn_to_death ?? 0).toLocaleString(),
      label: 'Ave. Days Between Regn. and Death',
      isLoading: loadingPatients,
    },
    {
      value: loadingPatients ? '—' : `${overviewStats.deaths_at_home_pct ?? 0}%`,
      label: 'Deaths At Home',
      isLoading: loadingPatients,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Global Header & Date Range Control Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-border/60 pb-4">
        <div>
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-foreground">Program Overview & Timeline</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Key program milestones, operational fleet stats, patient reach, and clinical activity
          </p>
        </div>

        {/* Global Date Range Filter */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Period:</span>
          <DateRangeFilter
            dateRange={globalDateRange}
            onChange={setGlobalDateRange}
          />
        </div>
      </div>

      {/* Program Milestone Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {milestoneCards.map((card, idx) => (
          <StatCard
            key={idx}
            value={card.value}
            label={card.label}
            variant="indigo"
            isLoading={card.isLoading}
          />
        ))}
        {/* Blank space to preserve 4-column alignment with other card rows */}
        <div className="hidden lg:block" aria-hidden="true" />
      </div>

      {/* Operational Home-care Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {operationalCards.map((card, idx) => (
          <StatCard
            key={idx}
            value={card.value}
            label={card.label}
            variant="emerald"
            isLoading={card.isLoading}
          />
        ))}
      </div>

      {/* Patient Reach & Demographics Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {patientReachCards.map((card, idx) => (
          <StatCard
            key={idx}
            value={card.value}
            label={card.label}
            variant="blue"
            isLoading={card.isLoading}
          />
        ))}
      </div>

      {/* Consultations & Clinical Procedures Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {consultationCards.map((card, idx) => (
          <StatCard
            key={idx}
            value={card.value}
            label={card.label}
            variant="amber"
            isLoading={card.isLoading}
          />
        ))}
        {/* Blank space to preserve consistent card sizing across 4-column rows */}
        <div className="hidden lg:block" aria-hidden="true" />
      </div>

      {/* Mortality & End-of-Life Performance Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {mortalityCards.map((card, idx) => (
          <StatCard
            key={idx}
            value={card.value}
            label={card.label}
            variant="rose"
            isLoading={card.isLoading}
          />
        ))}
      </div>

      {/* Monthly Registration Trend Chart */}
      <MonthlyRegistrationTrend dateRange={globalDateRange} />

      {/* Demographics Row: Age Category & Gender Profile Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AgeCategoryChart dateRange={globalDateRange} />
        <GenderProfileChart dateRange={globalDateRange} />
      </div>

      {/* Geographic Breakdown: Zone Wise Registered vs Seen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ZoneCategorizationChart dateRange={globalDateRange} />
        <ZoneSeenChart dateRange={globalDateRange} />
      </div>

      {/* Distance Distribution: Registered vs Seen */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DistanceDistributionChart dateRange={globalDateRange} />
        <DistanceSeenChart dateRange={globalDateRange} />
      </div>

      {/* Responsiveness Analysis (in Calendar Days) */}
      <ResponsivenessAnalysisChart dateRange={globalDateRange} />

      {/* Responsiveness Analysis (in Homecare Days) */}
      <ResponsivenessHomecareChart dateRange={globalDateRange} />

      {/* Distance Travelled per Vehicle */}
      <VehicleDistanceChart dateRange={globalDateRange} />

      {/* Homecare Visits Trend */}
      <HomecareVisitsChart dateRange={globalDateRange} />

      {/* Homecare Days */}
      <HomecareDaysChart dateRange={globalDateRange} />

      {/* Patient Visits Categorization (Alive & Deceased) */}
      <VisitsCategorizationChart dateRange={globalDateRange} />

      {/* Type of Home-Visit Analysis (First, Follow-up, Bereavement) */}
      <VisitTypeAnalysisChart dateRange={globalDateRange} />

      {/* Homecare Decline % */}
      <HomecareDeclineChart dateRange={globalDateRange} />

      {/* Consultation & Call Distribution (Pie / Donut Charts Grouped) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ConsultationBreakupChart dateRange={globalDateRange} />
        <PhoneCallDistributionChart dateRange={globalDateRange} />
      </div>

      {/* Monthwise Trend of Consultations (Individual Full-Width) */}
      <MonthlyConsultationTrendChart dateRange={globalDateRange} />

      {/* Monthwise Trend of Phone Call Consultations (Individual Full-Width) */}
      <PhoneCallTrendChart dateRange={globalDateRange} />

      {/* Split of Consultations by Provider Role (Individual Full-Width) */}
      <ConsultationSplitChart dateRange={globalDateRange} />

      {/* At-Home Clinical Procedures: Nursing | Physio | Psycho-Social */}
      <ClinicalProceduresTrendChart dateRange={globalDateRange} />

      {/* Patient Assessment & Categorization: PPS Analysis & BSC vs N-BSC (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PpsAnalysisChart dateRange={globalDateRange} />
        <PatientCategoryChart dateRange={globalDateRange} />
      </div>

      {/* Cancer Category Bifurcation & Place of Death (Side-by-Side) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CancerCategoryChart dateRange={globalDateRange} />
        <PlaceOfDeathChart dateRange={globalDateRange} />
      </div>

      {/* Month Wise Deaths Trend */}
      <MonthlyDeathsChart dateRange={globalDateRange} />
    </div>



  );
}

// Named alias for backward compatibility
export const ResponsiveAnalysisView = PptAnalyticsView;

export default PptAnalyticsView;
