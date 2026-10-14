import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { IndianRupee, Bed, RefreshCw, Layers } from 'lucide-react';
import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5002';

const OperationalFinancialView = () => {
  const [occupancyData, setOccupancyData] = useState(null);
  const [financialData, setFinancialData] = useState(null);
  const [turnoverRate, setTurnoverRate] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchOperationalData = async () => {
      try {
        const [occRes, finRes, turnRes] = await Promise.all([
          axios.get(`${API_BASE_URL}/api/analytics/operational/occupancy`),
          axios.get(`${API_BASE_URL}/api/analytics/operational/financial-summary`),
          axios.get(`${API_BASE_URL}/api/analytics/operational/turnover`)
        ]);
        
        setOccupancyData(occRes.data.data);
        setFinancialData(finRes.data.data);
        setTurnoverRate(turnRes.data.data);
      } catch (error) {
        console.error("Error fetching operational analytics:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchOperationalData();
  }, []);

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading financial and operational metrics...</div>;
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <IndianRupee className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(financialData?.total_revenue || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">From {financialData?.total_billed_patients || 0} patients</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border-blue-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bed Occupancy</CardTitle>
            <Bed className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{occupancyData?.overall_occupancy_rate || 0}%</div>
            <p className="text-xs text-muted-foreground mt-1">{occupancyData?.occupied_beds || 0} / {occupancyData?.total_beds || 0} beds</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/10 border-purple-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rev/Patient</CardTitle>
            <Layers className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">₹{(financialData?.average_revenue_per_patient || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Case mix index factored</p>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-500/10 to-amber-500/10 border-orange-500/20">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Bed Turnover</CardTitle>
            <RefreshCw className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{turnoverRate}</div>
            <p className="text-xs text-muted-foreground mt-1">Discharges per bed (30d)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle>Ward-wise Occupancy</CardTitle>
            <CardDescription>Current utilization across medical wards</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ward</TableHead>
                  <TableHead>Capacity</TableHead>
                  <TableHead>Occupied</TableHead>
                  <TableHead>%</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {occupancyData?.by_ward?.map((ward, index) => (
                  <TableRow key={index}>
                    <TableCell className="font-medium">{ward.ward}</TableCell>
                    <TableCell>{ward.total}</TableCell>
                    <TableCell>{ward.occupied}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden">
                          <div 
                            className={`h-full ${ward.occupancy_rate > 90 ? 'bg-red-500' : 'bg-blue-500'}`} 
                            style={{ width: `${ward.occupancy_rate}%` }}
                          />
                        </div>
                        <span className="text-xs">{ward.occupancy_rate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card className="border-border shadow-md">
          <CardHeader>
            <CardTitle>Revenue Insights</CardTitle>
            <CardDescription>Financial summary and projections</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col justify-center items-center h-64 text-center">
            <div className="p-6 rounded-full bg-indigo-500/10 mb-4">
              <IndianRupee className="h-12 w-12 text-indigo-500" />
            </div>
            <h3 className="text-lg font-semibold">Financial Summary Active</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              Total revenue from billed IPD admissions has reached ₹{(financialData?.total_revenue || 0).toLocaleString()} across all insurance and cash payers.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default OperationalFinancialView;
