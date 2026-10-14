import React, { useState, useEffect } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Download } from 'lucide-react';
import { exportChartAsSvg } from '@/utils/chartExport';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8', '#82ca9d', '#ffc658'];

export const SymptomAnalysisView = () => {
  const [loading, setLoading] = useState(true);
  const [prevalenceData, setPrevalenceData] = useState([]);
  const [trendsData, setTrendsData] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchSymptomData = async () => {
      try {
        setLoading(true);
        const token = localStorage.getItem('access_token');
        const headers = { Authorization: `Bearer ${token}` };

        const [prevalenceRes, trendsRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/analytics/symptoms/prevalence`, { headers }),
          axios.get(`${API_BASE_URL}/api/analytics/symptoms/trends?days=30`, { headers })
        ]);

        // Transform prevalence data for Recharts
        const formattedPrevalence = prevalenceRes.data.data.map(item => ({
          name: item.symptom_type,
          value: item.total_count,
          percentage: item.percentage
        }));

        setPrevalenceData(formattedPrevalence);

        // Transform trends data
        const formattedTrends = trendsRes.data.data.reduce((acc, curr) => {
          const existingDate = acc.find(item => item.date === curr.date.split('T')[0]);
          if (existingDate) {
            existingDate[curr.symptom_type] = curr.count;
          } else {
            acc.push({
              date: curr.date.split('T')[0],
              [curr.symptom_type]: curr.count
            });
          }
          return acc;
        }, []);

        setTrendsData(formattedTrends);
      } catch (err) {
        console.error('Error fetching symptom data:', err);
        setError('Failed to load symptom analytics.');
      } finally {
        setLoading(false);
      }
    };

    fetchSymptomData();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
        <Skeleton className="h-[400px] w-full rounded-xl" />
        <Skeleton className="h-[400px] w-full rounded-xl" />
      </div>
    );
  }

  if (error) {
    return <div className="text-danger-500 font-medium">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-sm border-border bg-card" id="symptom-prevalence-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Symptom Prevalence</CardTitle>
              <CardDescription>Overall distribution of reported symptoms</CardDescription>
            </div>
            {prevalenceData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('symptom-prevalence-chart', 'symptom-prevalence.svg')}
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
                    data={prevalenceData}
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  >
                    {prevalenceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(value) => [`${value} patients`, 'Count']} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm border-border bg-card" id="symptom-trends-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Symptom Trends (30 Days)</CardTitle>
              <CardDescription>Daily report counts for symptoms</CardDescription>
            </div>
            {trendsData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('symptom-trends-chart', 'symptom-trends.svg')}
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
                  <XAxis dataKey="date" tick={{fontSize: 12}} />
                  <YAxis />
                  <RechartsTooltip />
                  <Legend />
                  {/* Dynamically create bars for top symptoms */}
                  {prevalenceData.slice(0, 5).map((symptom, idx) => (
                    <Bar key={symptom.name} dataKey={symptom.name} stackId="a" fill={COLORS[idx % COLORS.length]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
