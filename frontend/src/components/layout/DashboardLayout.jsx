/**
 * Dashboard Layout Component
 */
import React, { useState } from 'react';
import { Link, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import {
  Home,
  FileText,
  Send,
  BarChart,
  Users,
  UserCircle,
  LogOut,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  UsersRound,
  Calendar,
  Stethoscope,
  Briefcase,
  Building,
  Building2,
  Activity,
  House,
  Upload,
  BedDouble,
  UserPlus,
  Bed,
  Clock,
  Settings,
  FilePlus,
  ClipboardList,
  Phone,
  CalendarDays,
  Package,
  Pill,
  Warehouse,
  Syringe,
  RotateCcw,
  Truck,
  MapPin,
  Bell,
  Shield,
  Video,
  Compass
} from 'lucide-react';

const DashboardLayout = () => {
  const { user, logout, hasPermission } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [servicesExpanded, setServicesExpanded] = useState(false);
  const [ipdExpanded, setIpdExpanded] = useState(false);
  const [opdExpanded, setOpdExpanded] = useState(false);
  const [physioExpanded, setPhysioExpanded] = useState(false);
  const [homecareExpanded, setHomecareExpanded] = useState(false);
  const [inventoryExpanded, setInventoryExpanded] = useState(false);
  const [dispatchExpanded, setDispatchExpanded] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: Home, permission: null },
    { name: 'Forms', href: '/forms', icon: FileText, permission: 'view_form' },
    { name: 'Submissions', href: '/submissions', icon: Send, permission: 'view_submission' },
    { name: 'Patients', href: '/patients', icon: UserCircle, permission: 'view_patients' },
    // {
    //   name: 'Services',
    //   icon: Briefcase,
    //   permission: 'view_all_assessments',
    //   expandable: true,
    //   children: [
    //     { name: 'IPD', href: '/services/ipd', icon: Building, description: 'In-Patient Department' },
    //     { name: 'OPD', href: '/services/opd', icon: Activity, description: 'Out-Patient Department' },
    //     { name: 'Physiotherapy', href: '/services/physiotherapy', icon: Activity, description: 'Rehabilitation Services' },
    //     { name: 'Home Care', href: '/services/home-care', icon: House, description: 'Home Healthcare' },
    //   ]
    // },
    // {
    //   name: 'IPD',
    //   icon: BedDouble,
    //   permission: 'view_all_assessments',
    //   expandable: true,
    //   children: [
    //     { name: 'Dashboard', href: '/ipd/dashboard', icon: Activity, description: 'IPD Overview & Stats' },
    //     { name: 'Admissions', href: '/ipd/admissions', icon: UserPlus, description: 'Manage Patient Admissions' },
    //     { name: 'Beds', href: '/ipd/beds', icon: Bed, description: 'Bed Management' },
    //     { name: 'Waiting List', href: '/ipd/waiting-list', icon: Clock, description: 'Bed Assignment Queue' },
    //     { name: 'IPD Forms', href: '/ipd/forms', icon: FilePlus, description: 'Manage IPD Form Templates', permission: 'manage_users' },
    //     { name: 'Form Configuration', href: '/ipd/form-configuration', icon: Settings, description: 'Configure IPD Forms', permission: 'manage_users' },
    //   ]
    // },
    // {
    //   name: 'OPD',
    //   icon: Stethoscope,
    //   permission: 'view_all_assessments',
    //   expandable: true,
    //   children: [
    //     { name: 'Dashboard', href: '/opd/dashboard', icon: Activity, description: 'OPD Overview & Stats' },
    //     { name: 'Queue', href: '/opd/queue', icon: Clock, description: 'Today\'s Patient Queue' },
    //     { name: 'Appointments', href: '/opd/appointments', icon: ClipboardList, description: 'All OPD Appointments' },
    //   ]
    // },
    // {
    //   name: 'Physiotherapy',
    //   icon: Activity,
    //   permission: 'view_physio_assessment',
    //   expandable: true,
    //   children: [
    //     { name: 'Dashboard', href: '/physiotherapy/dashboard', icon: Activity, description: 'Physiotherapy Overview & Stats' },
    //     { name: 'Queue', href: '/physiotherapy/queue', icon: Clock, description: 'Today\'s Patient Queue' },
    //     { name: 'Appointments', href: '/physiotherapy/appointments', icon: ClipboardList, description: 'All Physiotherapy Appointments' },
    //   ]
    // },
    // {
    //   name: 'Home Care',
    //   icon: House,
    //   permission: 'view_all_assessments',
    //   expandable: true,
    //   children: [
    //     { name: 'Dashboard', href: '/homecare/dashboard', icon: Activity, description: 'Home Care Overview & Stats' },
    //     { name: 'Queue', href: '/homecare/queue', icon: Clock, description: 'Today\'s Home Visits' },
    //     { name: 'Appointments', href: '/homecare/appointments', icon: ClipboardList, description: 'All Home Care Appointments' },
    //   ]
    // },
    // { name: 'Appointments', href: '/appointments', icon: Calendar, permission: null },
    // { name: 'Bulk Import', href: '/appointments/bulk-import', icon: Upload, permission: null },
    {
      name: 'Homecare Dispatch',
      icon: Truck,
      permission: 'manage_scheduling',
      expandable: true,
      children: [
        { name: 'Patients Directory', href: '/homecare-dispatch/patients', icon: Users, description: 'Patients & SLA status' },
        { name: 'Scheduling Board', href: '/homecare-dispatch/schedules', icon: CalendarDays, description: 'Plan, lock & dispatch' },
        { name: 'Vehicles', href: '/homecare-dispatch/vehicles', icon: Truck, description: 'Fleet & service zones' },
        { name: 'Completion Report', href: '/homecare-dispatch/report', icon: BarChart, description: 'Daily execution report' },
        { name: 'System Settings', href: '/homecare-dispatch/settings', icon: Settings, description: 'SLAs, weights & expiry' },
      ]
    },
    { name: 'Providers', href: '/providers', icon: Stethoscope, permission: null },
    // { name: 'Cohorts', href: '/cohorts', icon: UsersRound, permission: null },
    {
      name: 'Inventory',
      icon: Package,
      permission: null,
      expandable: true,
      children: [
        { name: 'Dashboard', href: '/inventory', icon: Home, description: 'Inventory overview' },
        { name: 'Medicine Catalog', href: '/inventory/catalog', icon: Pill, description: 'Medicines, categories & formulary' },
        { name: 'Stock Management', href: '/inventory/stock', icon: Warehouse, description: 'Stock by source, receive, movements' },
        { name: 'Dispense', href: '/inventory/dispense', icon: Syringe, description: 'Dispense to patients' },
        { name: 'Returns & Recalls', href: '/inventory/returns', icon: RotateCcw, description: 'Returns and recalls log' },
        { name: 'Reports', href: '/inventory/reports', icon: BarChart, description: 'Inventory reports & CSV' },
        { name: 'Admin', href: '/inventory/admin', icon: Settings, description: 'Users, allergies, emergency meds' },
      ]
    },
    { name: 'Analytics', href: '/analytics', icon: BarChart, permission: 'view_analytics' },
    { name: 'Call Logs', href: '/call-logs', icon: Phone, permission: null },
    // { name: 'Teleconsult', href: '/teleconsult', icon: Video, permission: null },
    { name: 'Manage Organisations', href: '/manage-hospitals', icon: Building2, permission: 'manage_users' },
    { name: 'Users', href: '/users', icon: Users, permission: 'manage_users' },
    { name: 'Settings', href: '/settings', icon: Settings, permission: null },
  ].filter(item => !item.permission || hasPermission(item.permission));

  const isActive = (path) => location.pathname === path || location.pathname.startsWith(`${path}/`);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border shadow-lg transform ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          } transition-transform duration-200 ease-in-out`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="flex items-center justify-between h-16 px-4 border-b border-border">
            <h1 className="text-xl font-bold text-foreground">Saranam India Health</h1>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="h-6 w-6 text-muted-foreground" />
            </button>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-4 space-y-1 overflow-y-auto">
            {navigation.map((item) => {
              const Icon = item.icon;

              // Handle expandable items (Services, IPD)
              if (item.expandable) {
                const expandMap = {
                  Services: [servicesExpanded, setServicesExpanded, '/services'],
                  IPD: [ipdExpanded, setIpdExpanded, '/ipd'],
                  OPD: [opdExpanded, setOpdExpanded, '/opd'],
                  Physiotherapy: [physioExpanded, setPhysioExpanded, '/physiotherapy'],
                  Inventory: [inventoryExpanded, setInventoryExpanded, '/inventory'],
                  'Home Care': [homecareExpanded, setHomecareExpanded, '/homecare'],
                  'Homecare Dispatch': [dispatchExpanded, setDispatchExpanded, '/homecare-dispatch'],
                };
                const [isExpanded, setExpanded, mainHref] = expandMap[item.name] || [false, () => { }, '/'];

                return (
                  <div key={item.name}>
                    <div
                      className={`w-full flex items-center justify-between rounded-md transition-colors ${item.children?.some(child => isActive(child.href))
                        ? 'bg-primary/10 text-primary'
                        : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                        }`}
                    >
                      <Link
                        to={mainHref}
                        className="flex items-center flex-1 px-4 py-2 text-sm font-medium"
                      >
                        <Icon className="h-5 w-5 mr-3" />
                        {item.name}
                      </Link>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded(!isExpanded);
                        }}
                        className="px-3 py-2 hover:bg-accent/50 rounded-r-md"
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </button>
                    </div>

                    {/* Sub-items */}
                    {isExpanded && (
                      <div className="mt-1 space-y-1">
                        {item.children
                          .filter(child => !child.permission || hasPermission(child.permission))
                          .map((child) => {
                            const ChildIcon = child.icon;
                            return (
                              <Link
                                key={child.name}
                                to={child.href}
                                className={`flex items-center pl-11 pr-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive(child.href)
                                  ? 'bg-primary/10 text-primary'
                                  : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                                  }`}
                                title={child.description}
                              >
                                <ChildIcon className="h-4 w-4 mr-3" />
                                {child.name}
                              </Link>
                            );
                          })}
                      </div>
                    )}
                  </div>
                );
              }

              // Regular navigation items
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors ${isActive(item.href)
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground'
                    }`}
                >
                  <Icon className="h-5 w-5 mr-3" />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-border px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{user?.full_name}</p>
                <p className="text-xs text-muted-foreground">{user?.role}</p>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 text-muted-foreground hover:text-foreground"
                title="Logout"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className={`transition-all duration-200 ease-in-out ${sidebarOpen ? 'lg:pl-64' : 'lg:pl-0'}`}>
        {/* Header with sidebar toggle */}
        <div className="sticky top-0 z-10 bg-card border-b border-border shadow-sm">
          <div className="flex items-center justify-between h-16 px-4">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="text-muted-foreground hover:text-foreground"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-lg font-semibold text-foreground">Saranam India Health Care</h1>
            <div className="w-6" aria-hidden="true" />
          </div>
        </div>

        {/* Page content */}
        <main className="flex-1">
          <div className="p-4 md:p-6 lg:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
