import { Link, useLocation, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import "../styles/Navigation.css";

export default function Navigation() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const isActive = (path: string) => location.pathname === path;

  const handleLogout = () => {
    navigate("/login");

    console.log("Logging out...");
    localStorage.removeItem("accessToken");
    localStorage.removeItem("userId");
  };

  return (
    <nav className="navigation">
      <div className="nav-header">
        <h1 className="nav-logo">Voting</h1>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>
      </div>

      {/* Primary App Navigation Links */}
      <div className="nav-links primary-links">
        <Link to="/" className={`nav-link ${isActive("/") ? "active" : ""}`}>
          <span className="nav-icon">🏠</span>
          Home
        </Link>
        <Link
          to="/groups"
          className={`nav-link ${
            location.pathname.startsWith("/groups") ? "active" : ""
          }`}
        >
          <span className="nav-icon">👥</span>
          Groups
        </Link>
        <Link
          to="/votings"
          className={`nav-link ${
            location.pathname.startsWith("/votings") ? "active" : ""
          }`}
        >
          <span className="nav-icon">📊</span>
          Votings
        </Link>
      </div>

      <div className="nav-links user-actions">
        {/* Added a subtle line for visual separation if needed */}
        <hr className="nav-divider" />

        <Link
          to="/profile"
          className={`nav-link ${isActive("/profile") ? "active" : ""}`}
        >
          <span className="nav-icon">👤</span>
          Profile
        </Link>
        <Link
          to="/settings"
          className={`nav-link ${isActive("/settings") ? "active" : ""}`}
        >
          <span className="nav-icon">⚙️</span>
          Settings
        </Link>

        <div onClick={handleLogout} className="nav-link">
          <span className="nav-icon">🚪</span>
          Logout
        </div>
      </div>
    </nav>
  );
}
