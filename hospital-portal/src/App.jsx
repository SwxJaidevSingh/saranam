/**
 * Hospital Portal — app root.
 *
 * Providers: AuthProvider (token/user) wraps OrgProvider (org context depends
 * on a valid token).
 *
 * NAVIGATION FLOW (Wave 3): login -> Organization window -> org-scoped list.
 *   /login         public — sign in, then -> /select-org.
 *   /accept-invite public — accept an org invite (Agent D).
 *   /select-org    authed (no active-org required) — the Organization window
 *                  where the user picks the org to act in. Picking one persists
 *                  active_org_id (drives the X-Org-Id header) and routes to the
 *                  org's patient list.
 *   everything else runs inside Layout and REQUIRES an active org; if none is
 *   selected (and not god view) Layout bounces to /select-org.
 *
 * Live routes: /patients, /patients/:id, /dashboard, /org-users,
 * /org-settings, /referral-feedback.
 */
import { BrowserRouter, Navigate, Route, Routes, useNavigate } from 'react-router-dom'
import { ToastContainer } from 'react-toastify'
import 'react-toastify/dist/ReactToastify.css'

import { AuthProvider } from './context/AuthContext'
import { OrgProvider } from './context/OrgContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import OrgSelect from './pages/OrgSelect'
import PatientsList from './pages/PatientsList'
import AddPatient from './pages/AddPatient'
import PatientDetail from './pages/PatientDetail'
import Dashboard from './pages/Dashboard'
import OrgUsers from './pages/OrgUsers'
import OrgSettings from './pages/OrgSettings'
import ReferralFeedback from './pages/ReferralFeedback'
import AcceptInvite from './pages/AcceptInvite'
import NotFound from './pages/NotFound'

function AddPatientRouteWrapper() {
  const navigate = useNavigate()
  return (
    <AddPatient
      open={true}
      onClose={() => navigate('/patients')}
      onCreated={() => navigate('/patients')}
    />
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <OrgProvider>
          <Routes>
            {/* Public */}
            <Route path="/login" element={<Login />} />
            <Route path="/accept-invite" element={<AcceptInvite />} />

            {/* The Organization window — authed, but no active org required. */}
            <Route
              path="/select-org"
              element={
                <ProtectedRoute>
                  <OrgSelect />
                </ProtectedRoute>
              }
            />

            {/* App shell — every route below requires an active org (Layout
                redirects to /select-org when none is chosen). */}
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/patients" replace />} />

              {/* Patients — strictly org-scoped */}
              <Route path="patients" element={<PatientsList />} />
              <Route path="patients/new" element={<AddPatientRouteWrapper />} />
              <Route path="patients/:id" element={<PatientDetail />} />

              {/* Analytics */}
              <Route path="dashboard" element={<Dashboard />} />

              {/* Org administration */}
              <Route path="org-users" element={<OrgUsers />} />
              <Route path="org-settings" element={<OrgSettings />} />
              <Route path="referral-feedback" element={<ReferralFeedback />} />
            </Route>

            <Route path="*" element={<NotFound />} />
          </Routes>

          <ToastContainer position="top-right" autoClose={4000} newestOnTop theme="light" />
        </OrgProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
