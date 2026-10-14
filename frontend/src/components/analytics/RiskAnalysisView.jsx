import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { exportChartAsSvg } from '@/utils/chartExport';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';
const RISK_COLORS = {
  'Low': '#00C49F',
  'Moderate': '#FFBB28',
  'High': '#FF8042',
  'Critical': '#EF4444'
};

export const RiskAnalysisView = () => {
  const [loading, setLoading] = useState(true);
  const [distributionData, setDistributionData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [highRiskPatients, setHighRiskPatients] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchRiskData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const headers = { Authorization: `Bearer ${token}` };

        const [distRes, trendsRes, patientsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/analytics/risk/distribution`, { headers }),
          axios.get(`${API_BASE_URL}/api/analytics/risk/trends?months=6`, { headers }),
          axios.get(`${API_BASE_URL}/api/analytics/risk/high-risk-patients?limit=10`, { headers })
        ]);

        // Transform distribution for pie chart
        const distArray = Object.entries(distRes.data.data).map(([level, data]) => ({
          name: level,
          value: data.count,
          percentage: data.percentage
        })).filter(item => item.value > 0);
        
        setDistributionData(distArray);

        // Transform trends
        const formattedTrends = trendsRes.data.data.reduce((acc, curr) => {
          const existingMonth = acc.find(item => item.month === curr.month);
          if (existingMonth) {
            existingMonth[curr.risk_level] = curr.count;
          } else {
            acc.push({
              month: curr.month,
              [curr.risk_level]: curr.count
            });
          }
          return acc;
        }, []);
        setTrendsData(formattedTrends);

        // Set high risk
        setHighRiskPatients(patientsRes.data.data);

      } catch (err) {
        console.error('Error fetching risk data:', err);
        setError('Failed to load risk analytics.');
      } finally {
        setLoading(false);
      }
    };

    fetchRiskData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="col-span-1 md:col-span-2 h-[300px] w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger-500 font-medium">{error}</div>;
  }

  const getRiskBadge = (level) => {
    const variants = {
      'Low': 'bg-success-100 text-success-800 hover:bg-success-100',
      'Moderate': 'bg-warning-100 text-warning-800 hover:bg-warning-100',
      'High': 'bg-orange-100 text-orange-800 hover:bg-orange-100',
      'Critical': 'bg-danger-100 text-danger-800 hover:bg-danger-100'
    };
    return <Badge className={variants[level] || 'bg-gray-100 text-gray-800'}>{level}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border bg-card" id="risk-distribution-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Risk Distribution</CardTitle>
              <CardDescription>Current patient population by risk stratification</CardDescription>
            </div>
            {distributionData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('risk-distribution-chart', 'risk-distribution.svg')}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={distributionData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={5}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {distributionData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={RISK_COLORS[entry.name] || '#8884d8'} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} patients`, 'Count']} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card" id="risk-trends-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Risk Trends</CardTitle>
              <CardDescription>Risk level distribution over the last 6 months</CardDescription>
            </div>
            {trendsData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('risk-trends-chart', 'risk-trends.svg')}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendsData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                  <XAxis dataKey="month" tick={{fontSize: 12}} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  <Bar dataKey="Critical" stackId="a" fill={RISK_COLORS['Critical']} />
                  <Bar dataKey="High" stackId="a" fill={RISK_COLORS['High']} />
                  <Bar dataKey="Moderate" stackId="a" fill={RISK_COLORS['Moderate']} />
                  <Bar dataKey="Low" stackId="a" fill={RISK_COLORS['Low']} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="col-span-1 md:col-span-2 shadow-sm border-border bg-card">
          <CardHeader>
            <CardTitle>High & Critical Risk Patients</CardTitle>
            <CardDescription>Patients requiring immediate attention</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Patient Name</TableHead>
                    <TableHead>Risk Score</TableHead>
                    <TableHead>Level</TableHead>
                    <TableHead>Assessment Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {highRiskPatients.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                        No high risk patients found.
                      </TableCell>
                    </TableRow>
                  ) : (
                    highRiskPatients.map((patient) => (
                      <TableRow key={patient.patient_id}>
                        <TableCell className="font-medium">{patient.patient_name}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{Math.round(patient.risk_score)}</span>
                            <div className="w-24 h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div 
                                className={`h-full ${patient.risk_level === 'Critical' ? 'bg-danger-500' : 'bg-orange-500'}`} 
                                style={{ width: `${Math.min(100, patient.risk_score)}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{getRiskBadge(patient.risk_level)}</TableCell>
                        <TableCell>
                          {patient.assessment_date ? new Date(patient.assessment_date).toLocaleDateString() : 'N/A'}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
