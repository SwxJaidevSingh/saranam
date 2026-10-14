import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Heart, Activity, Repeat, Timer, Download } from 'lucide-react';
import axios from 'axios';
import { exportChartAsSvg } from '@/utils/chartExport';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';

const ClinicalOutcomesView = () => {
  const [losData, setLosData] = useState(null);
  const [readmissionData, setReadmissionData] = useState(null);
  const [recoveryData, setRecoveryData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchClinicalData = async () => {
      try {
        const [losRes, readmRes, recovRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/analytics/clinical/los`),
          axios.get(`${API_BASE_URL}/api/analytics/clinical/readmissions`),
          axios.get(`${API_BASE_URL}/api/analytics/clinical/recovery`)
        ]);
        
        setLosData(losRes.data.data);
        setReadmissionData(readmRes.data.data);
        setRecoveryData(recovRes.data.data);
      } catch (error) {
        console.error("Error fetching clinical analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchClinicalData();
  }, []);

  const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading clinical outcome metrics...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-emerald-500/10 to-teal-500/10 border-emerald-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Length of Stay</CardTitle>
            <Timer className="h-4 w-4 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{losData?.average_los_days || 0} Days</div>
            <p className="text-xs text-muted-foreground mt-1">Hospital-wide average</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Readmission Rate</CardTitle>
            <Repeat className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readmissionData?.readmission_rate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">30-day readmission window</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Admissions</CardTitle>
            <Heart className="h-4 w-4 text-rose-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{readmissionData?.total_admissions || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">Analyzed IPD patients</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-amber-500/10 to-orange-500/10 border-amber-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Health Status</CardTitle>
            <Activity className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Excellent</div>
            <p className="text-xs text-muted-foreground mt-1">Overall clinical performance</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-md" id="clinical-recovery-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Clinical Recovery Status</CardTitle>
              <CardDescription>Patient outcomes upon discharge</CardDescription>
            </div>
            <button
              onClick={() => exportChartAsSvg('clinical-recovery-chart', 'clinical-recovery-status.svg')}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
              title="Download Chart SVG"
            >
              <Download className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={recoveryData?.distribution || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="count"
                    nameKey="type"
                  >
                    {(recoveryData?.distribution || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                  />
                  <Legend verticalAlign="bottom" height={36}/>
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-md" id="length-of-stay-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Length of Stay by Admission Type</CardTitle>
              <CardDescription>Average days hospitalized per category</CardDescription>
            </div>
            <button
              onClick={() => exportChartAsSvg('length-of-stay-chart', 'length-of-stay-by-admission-type.svg')}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
              title="Download Chart SVG"
            >
              <Download className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={losData?.by_admission_type || []}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                  <XAxis dataKey="type" />
                  <YAxis unit="d" />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                  />
                  <Legend />
                  <Bar dataKey="avg_days" name="Avg Days" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ClinicalOutcomesView;
