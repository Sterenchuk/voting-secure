import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import "../styles/Login.css";

const API_BASE_URL = import.meta.env.VITE_API_URL;

export default function Register() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const { theme, toggleTheme } = useTheme();

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    if (!API_BASE_URL) {
      setError("Configuration Error: VITE_API_URL is not defined.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorMessage =
          data.message ||
          "Registration failed. This email may already be in use.";
        setError(errorMessage);
        return;
      }

      // --- LOGIN LOGIC ADDED HERE ---
      // 1. Store tokens and user info just like in the login page
      localStorage.setItem("accessToken", data.accessToken);
      localStorage.setItem("refreshToken", data.refreshToken);
      localStorage.setItem("userRole", data.user.role);
      localStorage.setItem("userName", data.user.name);
      localStorage.setItem("userId", data.user.id);

      // 2. Redirect directly to the main/home page
      navigate("/");
    } catch (err) {
      console.error("Registration request failed:", err);
      setError("Network error or server unavailable.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <button
          className="theme-toggle-standalone"
          onClick={toggleTheme}
          aria-label="Toggle theme"
        >
          {theme === "dark" ? "☀️" : "🌙"}
        </button>

        <h1 className="login-title">Sign Up</h1>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <label>Name</label>
          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
          />

          <label>Email</label>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
          />

          <label>Password</label>
          <input
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            disabled={loading}
          />

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Sign Up"}
          </button>
        </form>

        <p className="signup-link">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
