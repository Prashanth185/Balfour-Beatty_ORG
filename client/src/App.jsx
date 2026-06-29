import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Employees from './pages/Employees';
import EmployeeMaster from './pages/EmployeeMaster';
import AddEmployee from './pages/AddEmployee';
import EmployeeProfile from './pages/EmployeeProfile';
import Relationships from './pages/Relationships';
import OrgChart from './pages/OrgChart';
import Search from './pages/Search';
import Reports from './pages/Reports';
import Success from './pages/Success';
import TraditionalOrgChart from './pages/TraditionalOrgChart';
import SharedOrgChart from './pages/SharedOrgChart';
import ProjectsDashboard from './pages/ProjectsDashboard';
import ProjectTraditionalOrgChart from './pages/ProjectTraditionalOrgChart';
import ProjectManualOrgChart from './pages/ProjectManualOrgChart';
import TradEmployeeProfile from './pages/TradEmployeeProfile';
// ── EVMS ─────────────────────────────────────────────────────────────────────
import EVMSDashboard  from './pages/evms/EVMSDashboard';
import EVMSVisits     from './pages/evms/EVMSVisits';
import EVMSCreateVisit from './pages/evms/EVMSCreateVisit';
import EVMSCreateHost  from './pages/evms/EVMSCreateHost';
// import EVMSCreateMeeting from './pages/evms/EVMSCreateMeeting'; // REMOVED: Use Visit Timeline instead
import EVMSCreateActivity from './pages/evms/EVMSCreateActivity';
import EVMSVisitTimeline from './pages/evms/EVMSVisitTimeline';
import EVMSVisitDetail from './pages/evms/EVMSVisitDetail';
import EVMSCalendar   from './pages/evms/EVMSCalendar';
import EVMSVisitors   from './pages/evms/EVMSVisitors';
import EVMSHosts      from './pages/evms/EVMSHosts';
import EVMSMeetings   from './pages/evms/EVMSMeetings';
import EVMSActivities from './pages/evms/EVMSActivities';
import EVMSTasks      from './pages/evms/EVMSTasks';
import EVMSDocuments  from './pages/evms/EVMSDocuments';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Public shared chart viewer — no login required */}
      <Route path="/shared-chart/:id" element={<SharedOrgChart />} />
      <Route path="/success" element={
        <ProtectedRoute><Success /></ProtectedRoute>
      } />
      <Route path="/" element={
        <ProtectedRoute><Layout /></ProtectedRoute>
      }>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<Dashboard />} />
        <Route path="employees" element={<Employees />} />
        <Route path="employees/master" element={<EmployeeMaster />} />
        <Route path="employees/add" element={<AddEmployee />} />
        <Route path="employees/:id" element={<EmployeeProfile />} />
        <Route path="employees/:id/edit" element={<AddEmployee />} />
        <Route path="relationships" element={<Relationships />} />
        <Route path="org-chart" element={<OrgChart />} />
        <Route path="traditional-org-chart" element={<TraditionalOrgChart />} />
        <Route path="search" element={<Search />} />
        <Route path="reports" element={<Reports />} />
        <Route path="projects" element={<ProjectsDashboard />} />
        <Route path="projects/:pid/org-chart" element={<ProjectManualOrgChart />} />
        <Route path="projects/:pid/traditional-org-chart" element={<ProjectTraditionalOrgChart />} />
        <Route path="trad-employee/:id" element={<TradEmployeeProfile />} />
        {/* ── EVMS Routes ─────────────────────────────────────────────── */}
        <Route path="evms"                  element={<EVMSDashboard />} />
        <Route path="evms/visits"           element={<EVMSVisits />} />
        <Route path="evms/visits/new"       element={<EVMSCreateVisit />} />
        <Route path="evms/visits/timeline"  element={<Navigate to="/evms/timeline/new" replace />} />
        <Route path="evms/visits/:id"       element={<EVMSVisitDetail />} />
        <Route path="evms/hosts/new"        element={<EVMSCreateHost />} />
        <Route path="evms/activities/new"   element={<EVMSCreateActivity />} />
        <Route path="evms/timeline/new"     element={<EVMSVisitTimeline />} />
        <Route path="evms/calendar"         element={<EVMSCalendar />} />
        <Route path="evms/visitors"         element={<EVMSVisitors />} />
        <Route path="evms/hosts"            element={<EVMSHosts />} />
        <Route path="evms/meetings"         element={<EVMSMeetings />} />
        <Route path="evms/activities"       element={<EVMSActivities />} />
        <Route path="evms/tasks"            element={<EVMSTasks />} />
        <Route path="evms/documents"        element={<EVMSDocuments />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
