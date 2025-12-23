import { useState, useEffect, useCallback } from "react";
import { useTheme } from "../contexts/ThemeContext";
import { protectedFetch } from "../utils/api";
import "../styles/Settings.css";

interface UserResponseDto {
  id: string;
  email: string;
  name: string;
}

interface UpdateResponse {
  user: UserResponseDto;
  access_token: string;
}

export default function Settings() {
  const { theme, toggleTheme } = useTheme();

  const [user, setUser] = useState<UserResponseDto | null>(null);

  const [name, setName] = useState("");
  const [notifications, setNotifications] = useState(true);

  const [isSaving, setIsSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const fetchUserData = useCallback(async () => {
    try {
      const userData: UserResponseDto = await protectedFetch("/users/me");
      setUser(userData);
      setName(userData.name);
    } catch (e) {
      console.error("Failed to fetch user data:", e);
      setStatusMessage({
        type: "error",
        message: "Failed to load settings. Please try again.",
      });
    }
  }, []);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!user || isSaving) return;

    const updatePayload = { name };

    setIsSaving(true);
    setStatusMessage(null);

    try {
      const response: UpdateResponse = await protectedFetch("/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      });

      setUser(response.user);
      localStorage.setItem("accessToken", response.access_token);
      setName(response.user.name);

      setStatusMessage({
        type: "success",
        message: "Profile updated successfully!",
      });
    } catch (e: any) {
      console.error("Failed to save settings:", e);
      setStatusMessage({
        type: "error",
        message: `Failed to save changes: ${e.message || "Server error."}`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (
      !window.confirm(
        "Are you absolutely sure you want to delete your account? This action cannot be undone."
      )
    ) {
      return;
    }

    try {
      await protectedFetch("/users/me", {
        method: "DELETE",
      });

      localStorage.removeItem("accessToken");
      window.location.href = "/login";
    } catch (e: any) {
      console.error("Account deletion failed:", e);
      setStatusMessage({
        type: "error",
        message: `Account deletion failed: ${e.message || "Server error."}`,
      });
    }
  };

  if (!user) {
    return (
      <div className="settings-container loading-state">
        <h1 className="settings-title">Loading Settings...</h1>
      </div>
    );
  }

  return (
    <div className="settings-container">
      <div className="settings-header">
        <h1 className="settings-title">Settings</h1>
        <p className="settings-subtitle">
          Manage your account settings and preferences
        </p>
      </div>

      <div className="settings-content">
        {statusMessage && (
          <div className={`status-message ${statusMessage.type}`}>
            {statusMessage.message}
          </div>
        )}

        <section className="settings-section">
          <h2 className="section-title">Profile</h2>
          <form onSubmit={handleProfileSubmit} className="settings-form">
            <div className="form-group">
              <label htmlFor="name">Name</label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="settings-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                type="email"
                id="email"
                value={user.email}
                className="settings-input"
                disabled
              />
              <small className="form-help">Email cannot be changed</small>
            </div>
            <button
              type="submit"
              className="settings-button primary"
              disabled={isSaving || name === user.name}
            >
              {isSaving ? "Saving..." : "Save Changes"}
            </button>
          </form>
        </section>

        <section className="settings-section">
          <h2 className="section-title">Preferences</h2>
          <div className="settings-list">
            <div className="settings-item">
              <div className="settings-item-content">
                <h3 className="settings-item-title">Theme</h3>
                <p className="settings-item-description">
                  Switch between light and dark mode
                </p>
              </div>
              <button onClick={toggleTheme} className="settings-toggle">
                {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
              </button>
            </div>

            <div className="settings-item">
              <div className="settings-item-content">
                <h3 className="settings-item-title">Email Notifications</h3>
                <p className="settings-item-description">
                  Receive email updates about votings and groups
                </p>
              </div>
              <label className="toggle-switch">
                <input
                  type="checkbox"
                  checked={notifications}
                  onChange={(e) => setNotifications(e.target.checked)}
                />
                <span className="toggle-slider"></span>
              </label>
            </div>
          </div>
        </section>

        <section className="settings-section danger">
          <h2 className="section-title">Danger Zone</h2>
          <div className="danger-actions">
            <button
              onClick={handleDeleteAccount}
              className="settings-button danger"
            >
              Delete Account
            </button>
            <small className="danger-warning">
              This action cannot be undone. All your data will be permanently
              deleted.
            </small>
          </div>
        </section>
      </div>
    </div>
  );
}
