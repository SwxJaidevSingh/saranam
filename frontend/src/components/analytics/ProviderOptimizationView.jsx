import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Users, Clock, AlertTriangle, TrendingUp, Download } from 'lucide-react';
import axios from 'axios';
import { exportChartAsSvg } from '@/utils/chartExport';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';

const ProviderOptimizationView = () => {
  const [utilizationData, setUtilizationData] = useState([]);
  const [noShowData, setNoShowData] = useState(null);
  const [waitTimes, setWaitTimes] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviderData = async () => {
      try {
        const [utilRes, noShowRes, waitRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/analytics/optimization/utilization`),
          axios.get(`${API_BASE_URL}/api/analytics/optimization/no-shows`),
          axios.get(`${API_BASE_URL}/api/analytics/optimization/wait-times`)
        ]);
        
        setUtilizationData(utilRes.data.data);
        setNoShowData(noShowRes.data.data);
        setWaitTimes(waitRes.data.data);
      } catch (error) {
        console.error("Error fetching provider analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviderData();
  }, []);

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088FE', '#00C49F'];

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading provider optimization metrics...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500/10 to-purple-500/10 border-indigo-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg utilization</CardTitle>
            <TrendingUp className="h-4 w-4 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {utilizationData.length > 0 
                ? (utilizationData.reduce((acc, curr) => acc + curr.utilization_rate, 0) / utilizationData.length).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">Across all active providers</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-red-500/10 to-orange-500/10 border-red-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">No-Show Rate</CardTitle>
            <AlertTriangle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{noShowData?.no_show_rate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">{noShowData?.total_no_shows || 0} total no-shows</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Wait Time</CardTitle>
            <Clock className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {waitTimes.length > 0 
                ? (waitTimes.reduce((acc, curr) => acc + curr.avg_wait_minutes, 0) / waitTimes.length).toFixed(1)
                : 0}m
            </div>
            <p className="text-xs text-muted-foreground mt-1">Check-in to start</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
            <Users className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{utilizationData.length}</div>
            <p className="text-xs text-muted-foreground mt-1">Providing care this week</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-md" id="provider-utilization-chart">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Provider Utilization Rates</CardTitle>
              <CardDescription>Booked vs Available hours per provider</CardDescription>
            </div>
            {utilizationData.length > 0 && (
              <button
                onClick={() => exportChartAsSvg('provider-utilization-chart', 'provider-utilization-rates.svg')}
                className="inline-flex items-center justify-center rounded-md border border-input bg-background p-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none h-8 w-8"
                title="Download Chart SVG"
              >
                <Download className="h-4 w-4" />
              </button>
            )}
          </CardHeader>
          <CardContent>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={utilizationData} layout="vertical" margin={{ left: 40, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} opacity={0.3} />
                  <XAxis type="number" unit="%" domain={[0, 100]} />
                  <YAxis dataKey="provider_name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: 'none', borderRadius: '8px', color: '#f8fafc' }}
                  />
                  <Legend />
                  <Bar dataKey="utilization_rate" name="Utilization %" fill="#818cf8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle>Provider Performance Metrics</CardTitle>
            <CardDescription>Detailed breakdown of utilization and wait times</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Provider</TableHead>
                  <TableHead>Utilization</TableHead>
                  <TableHead>Wait Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {utilizationData.slice(0, 5).map((provider) => {
                  const wait = waitTimes.find(w => w.provider_name === provider.provider_name);
                  return (
                    <TableRow key={provider.provider_id}>
                      <TableCell className="font-medium">
                        {provider.provider_name}
                        <div className="text-xs text-muted-foreground">{provider.specialization}</div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`${provider.utilization_rate > 85 ? 'text-red-500' : provider.utilization_rate < 30 ? 'text-yellow-500' : 'text-green-500'}`}>
                            {provider.utilization_rate}%
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{wait ? `${wait.avg_wait_minutes}m` : 'N/A'}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProviderOptimizationView;
