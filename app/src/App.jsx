import { Routes, Route, Navigate } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useLocationWatch } from './hooks/useLocationWatch';
import { useStore } from './store';
import { BottomNav } from './components/BottomNav';
import { Toast } from './components/Toast';

import Onboarding from './screens/Onboarding';
import Home from './screens/Home';
import StopsScreen from './screens/StopsScreen';
import MapScreen from './screens/MapScreen';
import DetailScreen from './screens/DetailScreen';
import ReviewScreen from './screens/ReviewScreen';
import AddScreen from './screens/AddScreen';
import FiltersScreen from './screens/FiltersScreen';
import SavedScreen from './screens/SavedScreen';
import ProfileScreen from './screens/ProfileScreen';
import SettingsScreen from './screens/SettingsScreen';
import AppearanceScreen from './screens/AppearanceScreen';
import RouteScreen from './screens/RouteScreen';
import DriveScreen from './screens/DriveScreen';
import TripHistoryScreen from './screens/TripHistoryScreen';

const WithNav = ({ t, children }) => (
  <>
    {children}
    <BottomNav t={t} />
  </>
);

const RequireOnboarding = ({ children }) => {
  const onboarded = useStore((s) => s.onboarded);
  return onboarded ? children : <Navigate to="/onboarding" replace />;
};

function App() {
  const { t } = useTheme();

  // One subscription for the whole app: every screen reads the same position,
  // and it keeps up with the user instead of being captured once at onboarding.
  useLocationWatch();

  return (
    <div className="phone">
      <Routes>
        <Route path="/onboarding" element={<Onboarding t={t} />} />

        {/* The design's four tabs */}
        <Route path="/" element={<RequireOnboarding><WithNav t={t}><Home t={t} /></WithNav></RequireOnboarding>} />
        <Route path="/stops" element={<RequireOnboarding><WithNav t={t}><StopsScreen t={t} /></WithNav></RequireOnboarding>} />
        <Route path="/saved" element={<RequireOnboarding><WithNav t={t}><SavedScreen t={t} /></WithNav></RequireOnboarding>} />
        <Route path="/settings" element={<RequireOnboarding><WithNav t={t}><SettingsScreen t={t} /></WithNav></RequireOnboarding>} />

        {/* Screens that live under a tab */}
        <Route path="/plan" element={<RequireOnboarding><WithNav t={t}><RouteScreen t={t} /></WithNav></RequireOnboarding>} />
        <Route path="/history" element={<RequireOnboarding><WithNav t={t}><TripHistoryScreen t={t} /></WithNav></RequireOnboarding>} />
        <Route path="/appearance" element={<RequireOnboarding><WithNav t={t}><AppearanceScreen t={t} /></WithNav></RequireOnboarding>} />
        <Route path="/profile" element={<RequireOnboarding><WithNav t={t}><ProfileScreen t={t} /></WithNav></RequireOnboarding>} />

        {/* Full-screen flows */}
        <Route path="/drive" element={<RequireOnboarding><DriveScreen t={t} /></RequireOnboarding>} />
        <Route path="/map" element={<RequireOnboarding><MapScreen t={t} /></RequireOnboarding>} />
        <Route path="/washroom/:id" element={<RequireOnboarding><DetailScreen t={t} /></RequireOnboarding>} />
        <Route path="/washroom/:id/review" element={<RequireOnboarding><ReviewScreen t={t} /></RequireOnboarding>} />
        <Route path="/add" element={<RequireOnboarding><AddScreen t={t} /></RequireOnboarding>} />
        <Route path="/filters" element={<RequireOnboarding><FiltersScreen t={t} /></RequireOnboarding>} />

        {/* The list and the map used to be separate tabs; both now live on Stops. */}
        <Route path="/list" element={<Navigate to="/stops" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toast t={t} />
    </div>
  );
}

export default App;
