// Main application component with theme support
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider as MuiThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { createMuiTheme } from './theme/muiTheme';
import { AuthProvider } from './context/AuthContext';
import { PatientProvider } from './context/PatientContext';
import { ServiceProvider } from './context/ServiceContext';
import ProtectedRoute from './components/auth/ProtectedRoute';
import Login from './components/auth/Login';
import ForgotPassword from './components/auth/ForgotPassword';
import ResetPassword from './components/auth/ResetPassword';
import AcceptInvite from './components/auth/AcceptInvite';
import Register from './components/auth/Register';
import DashboardLayout from './components/layout/DashboardLayout';
import Dashboard from './pages/Dashboard';
import FormsList from './pages/forms/FormsList';
import FormBuilder from './pages/forms/FormBuilder';
import FormSubmit from './pages/forms/FormSubmit';
import SubmissionsList from './pages/submissions/SubmissionsList';
import SubmissionDetail from './pages/submissions/SubmissionDetail';
import SubmissionEdit from './pages/submissions/SubmissionEdit';
import PatientsList from './pages/patients/PatientsList';
import PatientDetail from './pages/patients/PatientDetail';
import PatientEdit from './pages/patients/PatientEdit';
import ProvidersList from './pages/providers/ProvidersList';
import ProviderDetail from './pages/providers/ProviderDetail';
import ProviderForm from './pages/providers/ProviderForm';
import ProviderScheduleManager from './pages/providers/ProviderScheduleManager';
import CohortsList from './pages/cohorts/CohortsList';
import CohortBuilder from './pages/cohorts/CohortBuilder';
import CohortDetail from './pages/cohorts/CohortDetail';
import Analytics from './pages/Analytics';
import FormAnalyticsHub from './components/analytics/forms/FormAnalyticsHub';
import FormDeepDiveView from './components/analytics/forms/FormDeepDiveView';
import AnalyticsDashboard from './pages/analytics/AnalyticsDashboard';
import AppointmentsPage from './pages/appointments/AppointmentsPage';
import BulkAppointmentImport from './pages/appointments/BulkAppointmentImport';
import ServiceDashboard from './pages/services/ServiceDashboard';
import ServiceBookingWizard from './pages/services/ServiceBookingWizard';
import ServiceLanding from './pages/services/ServiceLanding';
import NewServiceBookingWizard from './pages/services/new-booking/NewServiceBookingWizard';
import MyServiceBookings from './pages/services/MyServiceBookings';
import UsersList from './pages/users/UsersList';
import Settings from './pages/Settings';
import PublicFormView from './pages/PublicFormView';
import NotFound from './pages/NotFound';

// IPD routes
import IPDDashboard from './pages/ipd/IPDDashboard';
import BedManagement from './pages/ipd/BedManagement';
import AdmissionsList from './pages/ipd/AdmissionsList';
import AdmissionDetail from './pages/ipd/AdmissionDetail';
import AdmissionWizard from './components/ipd/AdmissionWizard';
import WaitingList from './pages/ipd/WaitingList';
import IPDFormConfiguration from './pages/admin/IPDFormConfiguration';
import IPDFormsManager from './pages/ipd/IPDFormsManager';

// Manage Hospitals (§2 — platform admin)
import OrganizationsList from './pages/admin/OrganizationsList';
import OrganizationDetail from './pages/admin/OrganizationDetail';

// OPD routes
import OPDDashboard from './pages/opd/OPDDashboard';
import OPDQueue from './pages/opd/OPDQueue';
import OPDAppointments from './pages/opd/OPDAppointments';
import OPDVisitDetail from './pages/opd/OPDVisitDetail';

// Physiotherapy routes
import PhysioDashboard from './pages/physiotherapy/PhysioDashboard';
import PhysioQueue from './pages/physiotherapy/PhysioQueue';
import PhysioAppointments from './pages/physiotherapy/PhysioAppointments';
import PhysioVisitDetail from './pages/physiotherapy/PhysioVisitDetail';

// Home Care routes
import HomeCareDashboard from './pages/homecare/HomeCareDashboard';
import HomeCareQueue from './pages/homecare/HomeCareQueue';
import HomeCareAppointments from './pages/homecare/HomeCareAppointments';
import HomeCareVisitDetail from './pages/homecare/HomeCareVisitDetail';
import ShareLocation from './pages/homecare/ShareLocation';

// Homecare Dispatch routes
import PatientsDirectoryPage from './pages/homecare-dispatch/PatientsDirectoryPage';
import SchedulingOverviewPage from './pages/homecare-dispatch/SchedulingOverviewPage';
import ScheduleDatePage from './pages/homecare-dispatch/ScheduleDatePage';
import VehiclesPage from './pages/homecare-dispatch/VehiclesPage';
import CompletionReportPage from './pages/homecare-dispatch/CompletionReportPage';
import SystemSettingsPage from './pages/homecare-dispatch/SystemSettingsPage';

import CallLogsPage from './pages/call_log/CallLogsPage';
import VideoCallRoom from './pages/teleconsult/components/VideoCallRoom';
import TeleconsultPage from './pages/teleconsult/TeleconsultPage';

// Inventory routes
import InventoryDashboardPage from './pages/inventory/InventoryDashboardPage';
import MedicineCatalogPage from './pages/inventory/MedicineCatalogPage';
import StockManagementPage from './pages/inventory/StockManagementPage';
import DispensePage from './pages/inventory/DispensePage';
import ReturnsRecallsPage from './pages/inventory/ReturnsRecallsPage';
import ErrorReportingPage from './pages/inventory/ErrorReportingPage';
import InventoryReportsPage from './pages/inventory/InventoryReportsPage';
import InventoryAdminPage from './pages/inventory/InventoryAdminPage';
import PatientJoinPage from './pages/teleconsult/PatientJoinPage';

// Inner component that uses the theme
function AppContent() {
  const { isDark } = useTheme();
  const muiTheme = createMuiTheme(isDark);

  return (
    <MuiThemeProvider theme={muiTheme}>
      <CssBaseline />
      <AuthProvider>
        <PatientProvider>
          <ServiceProvider>
            <Routes>
              {/* Public routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/accept-invite" element={<AcceptInvite />} />
              <Route path="/register" element={<Register />} />
              <Route path="/public/forms/:shareToken" element={<PublicFormView />} />
              <Route path="/public/share-location/:token" element={<ShareLocation />} />
              <Route path="/teleconsult/join" element={<PatientJoinPage />} />

              {/* Protected routes */}
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <DashboardLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="/dashboard" replace />} />
                <Route path="dashboard" element={<Dashboard />} />

                {/* Forms routes */}
                <Route path="forms" element={<FormsList />} />
                <Route
                  path="forms/new"
                  element={
                    <ProtectedRoute requiredPermission="create_form">
                      <FormBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="forms/:id/edit"
                  element={
                    <ProtectedRoute requiredPermission="edit_form">
                      <FormBuilder />
                    </ProtectedRoute>
                  }
                />
                <Route path="forms/:id/submit" element={<FormSubmit />} />

                {/* Submissions routes */}
                <Route path="submissions" element={<SubmissionsList />} />
                <Route
                  path="submissions/:id/edit"
                  element={
                    <ProtectedRoute requiredPermission="submit_form">
                      <SubmissionEdit />
                    </ProtectedRoute>
                  }
                />
                <Route path="submissions/:id" element={<SubmissionDetail />} />

                {/* Patients routes */}
                <Route path="patients" element={<PatientsList />} />
                <Route path="patients/:id" element={<PatientDetail />} />
                <Route path="patients/:id/edit" element={<PatientEdit />} />

                {/* Appointments routes */}
                <Route path="appointments" element={<AppointmentsPage />} />
                <Route path="appointments/bulk-import" element={<BulkAppointmentImport />} />

                {/* Services routes */}
                <Route path="services" element={<ServiceLanding />} />
                <Route path="services/book" element={<NewServiceBookingWizard />} />
                <Route path="services/my-bookings" element={<MyServiceBookings />} />
                <Route path="services/:type" element={<ServiceDashboard />} />
                <Route path="services/:type/book" element={<ServiceBookingWizard />} />

                {/* IPD routes */}
                <Route path="ipd" element={<IPDDashboard />} />
                <Route path="ipd/dashboard" element={<IPDDashboard />} />
                <Route path="ipd/beds" element={<BedManagement />} />
                <Route path="ipd/admissions" element={<AdmissionsList />} />
                <Route path="ipd/admissions/new" element={<AdmissionWizard />} />
                <Route path="ipd/admissions/:admissionId" element={<AdmissionDetail />} />
                <Route path="ipd/waiting-list" element={<WaitingList />} />
                <Route
                  path="ipd/form-configuration"
                  element={
                    <ProtectedRoute requiredPermission="manage_users">
                      <IPDFormConfiguration />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="ipd/forms"
                  element={
                    <ProtectedRoute requiredPermission="manage_users">
                      <IPDFormsManager />
                    </ProtectedRoute>
                  }
                />

                {/* OPD routes */}
                <Route path="opd" element={<OPDDashboard />} />
                <Route path="opd/dashboard" element={<OPDDashboard />} />
                <Route path="opd/queue" element={<OPDQueue />} />
                <Route path="opd/appointments" element={<OPDAppointments />} />
                <Route path="opd/appointments/new" element={<OPDAppointments />} />
                <Route path="opd/visits/:visitId" element={<OPDVisitDetail />} />

                {/* Physiotherapy routes */}
                <Route path="physiotherapy" element={<PhysioDashboard />} />
                <Route path="physiotherapy/dashboard" element={<PhysioDashboard />} />
                <Route path="physiotherapy/queue" element={<PhysioQueue />} />
                <Route path="physiotherapy/appointments" element={<PhysioAppointments />} />
                <Route path="physiotherapy/appointments/new" element={<PhysioAppointments />} />
                <Route path="physiotherapy/visits/:visitId" element={<PhysioVisitDetail />} />

                {/* Home Care routes */}
                <Route path="homecare" element={<HomeCareDashboard />} />
                <Route path="homecare/dashboard" element={<HomeCareDashboard />} />
                <Route path="homecare/queue" element={<HomeCareQueue />} />
                <Route path="homecare/appointments" element={<HomeCareAppointments />} />
                <Route path="homecare/appointments/new" element={<HomeCareAppointments />} />
                <Route path="homecare/visits/:visitId" element={<HomeCareVisitDetail />} />

                {/* Inventory routes */}
                {/* Homecare Dispatch routes */}
                <Route path="homecare-dispatch" element={<Navigate to="/homecare-dispatch/schedules" replace />} />
                <Route path="homecare-dispatch/patients" element={<ProtectedRoute requiredPermission="manage_scheduling"><PatientsDirectoryPage /></ProtectedRoute>} />
                <Route path="homecare-dispatch/schedules" element={<ProtectedRoute requiredPermission="manage_scheduling"><SchedulingOverviewPage /></ProtectedRoute>} />
                <Route path="homecare-dispatch/schedules/:date" element={<ProtectedRoute requiredPermission="manage_scheduling"><ScheduleDatePage /></ProtectedRoute>} />
                <Route path="homecare-dispatch/vehicles" element={<ProtectedRoute requiredPermission="manage_scheduling"><VehiclesPage /></ProtectedRoute>} />
                <Route path="homecare-dispatch/report" element={<ProtectedRoute requiredPermission="manage_scheduling"><CompletionReportPage /></ProtectedRoute>} />
                <Route path="homecare-dispatch/settings" element={<ProtectedRoute requiredPermission="manage_scheduling"><SystemSettingsPage /></ProtectedRoute>} />

                {/* Inventory routes */}
                <Route path="inventory" element={<InventoryDashboardPage />} />
                <Route path="inventory/catalog" element={<MedicineCatalogPage />} />
                <Route path="inventory/stock" element={<StockManagementPage />} />
                <Route path="inventory/dispense" element={<DispensePage />} />
                <Route path="inventory/returns" element={<ReturnsRecallsPage />} />
                <Route path="inventory/errors" element={<ErrorReportingPage />} />
                <Route path="inventory/reports" element={<InventoryReportsPage />} />
                <Route path="inventory/admin" element={<InventoryAdminPage />} />

                {/* Providers routes */}
                <Route path="providers" element={<ProvidersList />} />
                <Route path="providers/new" element={<ProviderForm />} />
                <Route path="providers/:id" element={<ProviderDetail />} />
                <Route path="providers/:id/edit" element={<ProviderForm />} />
                <Route path="providers/:id/schedule" element={<ProviderScheduleManager />} />

                {/* Cohorts routes */}
                <Route path="cohorts" element={<CohortsList />} />
                <Route path="cohorts/new" element={<CohortBuilder />} />
                <Route path="cohorts/:cohortId" element={<CohortDetail />} />
                <Route path="cohorts/:cohortId/edit" element={<CohortBuilder />} />

                {/* Analytics routes */}
                <Route
                  path="analytics"
                  element={
                    <ProtectedRoute requiredPermission="view_analytics">
                      <AnalyticsDashboard />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="analytics/forms"
                  element={
                    <ProtectedRoute requiredPermission="view_analytics">
                      <FormAnalyticsHub />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="analytics/forms/:formId"
                  element={
                    <ProtectedRoute requiredPermission="view_analytics">
                      <FormDeepDiveView />
                    </ProtectedRoute>
                  }
                />

                {/* Settings */}
                <Route path="settings" element={<Settings />} />

                {/* Users management (admin only) */}
                <Route
                  path="users"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <UsersList />
                    </ProtectedRoute>
                  }
                />
                <Route path='call-logs' element={<ProtectedRoute requiredRole='admin'><CallLogsPage /></ProtectedRoute>} />

                {/* Manage Hospitals (§2 — platform admin only) */}
                <Route
                  path="manage-hospitals"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <OrganizationsList />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="manage-hospitals/:id"
                  element={
                    <ProtectedRoute requiredRole="admin">
                      <OrganizationDetail />
                    </ProtectedRoute>
                  }
                />

                {/* Teleconsult */}
                <Route path='teleconsult' element={<TeleconsultPage />} />
                <Route path='teleconsult/sessions/:id' element={<VideoCallRoom />} />

              </Route>

              {/* 404 route */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </ServiceProvider>
        </PatientProvider>
      </AuthProvider>
    </MuiThemeProvider>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </BrowserRouter>
  );
}

export default App;
