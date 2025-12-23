import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { ThemeProvider } from "./contexts/ThemeContext";
import Navigation from "./components/Navigation";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Home from "./pages/Home";
import Groups from "./pages/Groups";
import Votings from "./pages/Votings";
import Profile from "./pages/Profile";
import Settings from "./pages/Settings";
import CreateGroupPage from "./pages/CreateGroupPage";
import GroupDetailPage from "./pages/GroupDetailPage";
import NotFoundPage from "./pages/NotFoundPage";
import VotingCreate from "./pages/VotingCreate"; // <-- ADDED IMPORT
import "./styles/Global.css";
import VotingPage from "./pages/VotingPage";
import SurveyPage from "./pages/SurveyPage";

const isAuthenticated = () => {
  return !!localStorage.getItem("accessToken");
};

interface ProtectedRouteProps {
  children: React.ReactNode;
}

const ProtectedRoute = ({ children }: ProtectedRouteProps) => {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  return (
    <div className="app-layout">
      <Navigation />
      <main className="main-content">{children}</main>
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups"
            element={
              <ProtectedRoute>
                <Groups />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/create"
            element={
              <ProtectedRoute>
                <CreateGroupPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/groups/:id"
            element={
              <ProtectedRoute>
                <GroupDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/votings"
            element={
              <ProtectedRoute>
                <Votings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/votings/create"
            element={
              <ProtectedRoute>
                <VotingCreate />
              </ProtectedRoute>
            }
          />
          <Route
            path="/votings/:id"
            element={
              <ProtectedRoute>
                <VotingPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/votings/:id/survey"
            element={
              <ProtectedRoute>
                <SurveyPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <Profile />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
