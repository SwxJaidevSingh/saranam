/**
 * ProvidersList Page
 * Displays list of healthcare providers with search and filters
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Alert } from '../../components/ui/alert';
import {
  Search,
  Plus,
  Stethoscope,
  Building2,
  MapPin,
  Phone,
  Mail,
  Calendar,
  ChevronRight,
  RefreshCw
} from 'lucide-react';
import providersApi from '../../api/providers';

const ProvidersList = () => {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [specializationFilter, setSpecializationFilter] = useState('all');
  // const [departmentFilter, setDepartmentFilter] = useState('all'); // Commented out - not needed
  const [statusFilter, setStatusFilter] = useState('active');

  // Available options
  const [specializations, setSpecializations] = useState([]);
  // const [departments, setDepartments] = useState([]); // Commented out - not needed

  // Fetch specializations (departments commented out)
  useEffect(() => {
    const fetchOptions = async () => {
      try {
        const specsResponse = await providersApi.getSpecializations();
        // const deptsResponse = await providersApi.getDepartments();
        setSpecializations(specsResponse.specializations || []);
        // setDepartments(deptsResponse.departments || []);
      } catch (err) {
        console.error('Error fetching options:', err);
      }
    };
    fetchOptions();
  }, []);

  // Fetch providers
  const fetchProviders = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        limit: 100,
        search: searchQuery || undefined,
        specialization: specializationFilter !== 'all' ? specializationFilter : undefined,
        // department: departmentFilter !== 'all' ? departmentFilter : undefined, // Commented out
        is_active: statusFilter === 'active' ? true : statusFilter === 'inactive' ? false : undefined,
      };

      const response = await providersApi.list(params);
      setProviders(response.providers || []);
    } catch (err) {
      console.error('Error fetching providers:', err);
      setError('Failed to load providers. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchProviders();
  }, [searchQuery, specializationFilter, /* departmentFilter, */ statusFilter]);

  const handleViewProvider = (providerId) => {
    navigate(`/providers/${providerId}`);
  };

  const handleCreateProvider = () => {
    navigate('/providers/new');
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Healthcare Providers</h1>
          <p className="text-muted-foreground mt-1">Manage doctors, nurses, and healthcare staff</p>
        </div>
        <Button onClick={handleCreateProvider} className="flex items-center gap-2">
          <Plus className="h-4 w-4" />
          Add Provider
        </Button>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Search */}
          <div className="md:col-span-2 space-y-2">
            <Label htmlFor="search">
              <Search className="h-4 w-4 inline mr-2" />
              Search
            </Label>
            <Input
              id="search"
              type="text"
              placeholder="Search by name, license number, or HPR ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Specialization Filter */}
          <div className="space-y-2">
            <Label htmlFor="specialization">
              <Stethoscope className="h-4 w-4 inline mr-2" />
              Specialization
            </Label>
            <Select value={specializationFilter} onValueChange={setSpecializationFilter}>
              <SelectTrigger id="specialization">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Specializations</SelectItem>
                {specializations.map((spec) => (
                  <SelectItem key={spec} value={spec}>
                    {spec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter + Refresh */}
          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <div className="flex gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger id="status" className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" onClick={fetchProviders} disabled={loading} className="px-3">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>

          {/* Department Filter - Commented out for now */}
          {/* <div className="space-y-2">
            <Label htmlFor="department">
              <Building2 className="h-4 w-4 inline mr-2" />
              Department
            </Label>
            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
              <SelectTrigger id="department">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Departments</SelectItem>
                {departments.map((dept) => (
                  <SelectItem key={dept} value={dept}>
                    {dept}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div> */}
        </div>
      </Card>

      {/* Error Alert */}
      {error && <Alert variant="destructive">{error}</Alert>}

      {/* Loading State */}
      {loading && providers.length === 0 && (
        <Card className="p-12">
          <div className="flex flex-col items-center justify-center text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
            <p className="text-muted-foreground">Loading providers...</p>
          </div>
        </Card>
      )}

      {/* Empty State */}
      {!loading && providers.length === 0 && (
        <Card className="p-12">
          <div className="text-center">
            <Stethoscope className="h-12 w-12 text-muted-foreground/70 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-foreground mb-2">No providers found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery
                ? 'No providers match your search criteria.'
                : 'Get started by adding your first healthcare provider.'}
            </p>
            <Button onClick={handleCreateProvider}>
              <Plus className="h-4 w-4 mr-2" />
              Add Provider
            </Button>
          </div>
        </Card>
      )}

      {/* Providers List */}
      {!loading && providers.length > 0 && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Showing {providers.length} provider{providers.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((provider) => (
              <Card
                key={provider.id}
                className="p-4 hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => handleViewProvider(provider.id)}
              >
                <div className="space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg text-foreground">
                        {provider.full_name}
                      </h3>
                      <p className="text-sm text-muted-foreground">{provider.specialization}</p>
                    </div>
                    {provider.is_active ? (
                      <Badge className="bg-green-100 text-green-800">Active</Badge>
                    ) : (
                      <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 text-sm text-muted-foreground">
                    {/* Department - Commented out for now */}
                    {/* {provider.department && (
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4" />
                        <span>{provider.department}</span>
                      </div>
                    )} */}

                    {provider.license_number && (
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4" />
                        <span>License: {provider.license_number}</span>
                      </div>
                    )}

                    {provider.email && (
                      <div className="flex items-center gap-2">
                        <Mail className="h-4 w-4" />
                        <span className="truncate">{provider.email}</span>
                      </div>
                    )}

                    {provider.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4" />
                        <span>{provider.phone}</span>
                      </div>
                    )}
                  </div>

                  {/* Stats */}
                  {provider.stats && (
                    <div className="pt-3 border-t grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-muted-foreground text-xs">Total Appointments</p>
                        <p className="font-semibold text-foreground">
                          {provider.stats.total_appointments || 0}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground text-xs">Upcoming</p>
                        <p className="font-semibold text-foreground">
                          {provider.stats.upcoming_appointments || 0}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* View Details Button */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewProvider(provider.id);
                    }}
                  >
                    View Details
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default ProvidersList;
