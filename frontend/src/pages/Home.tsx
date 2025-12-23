import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import "../styles/Home.css"; // Assuming you have added the corresponding CSS
import { protectedFetch } from "../utils/api"; // Utility for authenticated API calls

// Use environment variable for the API base URL (though it's used inside protectedFetch)
const API_BASE_URL = import.meta.env.VITE_API_URL;

// --- INTERFACES ---

interface PreviewUser {
  id: string;
  name?: string | null;
}

interface Group {
  id: string;
  name: string;
  memberCount: number;
  createdAt: string;

  previewUsers?: PreviewUser[];
}

interface Voting {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  groupName?: string;
  startAt?: string;
  endAt?: string;
  optionCount?: number;
  voteCount?: number;
  isSurvey?: boolean;
}

// --- COMPONENT ---

export default function Home() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [activeVotings, setActiveVotings] = useState<Voting[]>([]);
  const [recentVotings, setRecentVotings] = useState<Voting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isVotingActive = (voting: Voting): boolean => {
    // If endAt is not provided, we assume it's ongoing/active
    if (!voting.endAt) return true;
    return new Date(voting.endAt).getTime() > new Date().getTime();
  };

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  // --- DATA FETCHING ---
  const fetchDashboardData = async () => {
    setLoading(true);
    setError(null);

    if (!API_BASE_URL) {
      setError("Configuration Error: VITE_API_URL is not defined.");
      setLoading(false);
      return;
    }

    try {
      // Fetch groups and update state
      const groupsPromise = protectedFetch("/groups").then((data: Group[]) => {
        setGroups(data);
      });

      // Fetch all votings and filter/sort them
      const allVotingsPromise = protectedFetch("/votings").then(
        (data: Voting[]) => {
          // Filter active votings (max 3 for dashboard view)
          const active = data.filter(isVotingActive).slice(0, 3);

          // Filter completed/recent votings, sort by end date (newest first), and slice (max 3)
          const recent = data
            .filter((v) => !isVotingActive(v))
            .sort(
              (a, b) =>
                new Date(b.endAt!).getTime() - new Date(a.endAt!).getTime()
            )
            .slice(0, 3);

          setActiveVotings(active);
          setRecentVotings(recent);
        }
      );

      // Wait for all fetches to complete
      await Promise.all([groupsPromise, allVotingsPromise]);
    } catch (err: any) {
      console.error("Dashboard data fetching failed:", err);
      // The protectedFetch utility should handle 401/expired token redirects
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // --- RENDER ---

  if (error) {
    return (
      <div className="home-container">
        {/* Assumes 'auth-error' style class exists */}
        <div className="auth-error">Error loading dashboard: {error}</div>
      </div>
    );
  }

  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">Dashboard</h1>
        <p className="home-subtitle">
          Welcome back! Here's what's happening in your groups.
        </p>
      </div>

      <div className="home-grid">
        {/* Groups Section */}
        <section className="home-section">
          {loading ? (
            <div className="loading">Loading groups...</div>
          ) : (
            <div className="cards-grid">
              {groups.length > 0 ? (
                groups.map((group) => (
                  <Link
                    key={group.id}
                    to={`/groups/${group.id}`}
                    className="card group-card-link"
                  >
                    <div className="card-header">
                      <h3 className="card-title">{group.name}</h3>
                    </div>
                    <div className="card-content">
                      {/* 🔥 NEW: Member Preview Section */}
                      <div className="card-members-preview">
                        <div className="member-icons">
                          {/* Display the first two preview users */}
                          {group.previewUsers &&
                            group.previewUsers.slice(0, 2).map((user) => (
                              <span
                                key={user.id}
                                className="member-initials"
                                title={user.name || user.id}
                              >
                                {
                                  user.name
                                    ? user.name.charAt(0)
                                    : "?" /* Use first initial or '?' */
                                }
                              </span>
                            ))}

                          {/* If there are more members than shown, display the count */}
                          {group.memberCount > 2 && (
                            <span className="member-count-extra">
                              +
                              {group.memberCount -
                                (group.previewUsers?.length || 0)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="card-stat">
                        <span className="stat-label">Total Members</span>
                        <span className="stat-value">{group.memberCount}</span>
                      </div>
                      <div className="card-footer">
                        <span className="card-date">
                          Created {formatDate(group.createdAt)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="loading">No groups found.</div>
              )}
            </div>
          )}
        </section>

        {/* Active Votings Section */}
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">Active Votings</h2>
            <Link to="/votings" className="section-link">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="loading">Loading votings...</div>
          ) : (
            <div className="votings-list">
              {activeVotings.length > 0 ? (
                activeVotings.map((voting) => (
                  <Link
                    key={voting.id}
                    to={
                      voting.isSurvey
                        ? `/votings/${voting.id}/survey`
                        : `/votings/${voting.id}`
                    }
                    className="voting-card"
                  >
                    <div className="voting-header">
                      <h3 className="voting-title">{voting.title}</h3>
                      <span className="voting-badge active">Active</span>
                    </div>
                    {voting.description && (
                      <p className="voting-description">{voting.description}</p>
                    )}
                    <div className="voting-meta">
                      <span className="voting-group">
                        Group: {voting.groupName || voting.groupId}
                      </span>
                      <div className="voting-stats">
                        <span>{voting.optionCount ?? "..."} options</span>
                        <span>{voting.voteCount ?? "..."} votes</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="loading">No active votings.</div>
              )}
            </div>
          )}
        </section>

        {/* Recent Votings Section */}
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">Recent Votings</h2>
            <Link to="/votings" className="section-link">
              View all
            </Link>
          </div>
          {loading ? (
            <div className="loading">Loading recent votings...</div>
          ) : (
            <div className="votings-list">
              {recentVotings.length > 0 ? (
                recentVotings.map((voting) => (
                  <Link
                    key={voting.id}
                    to={
                      voting.isSurvey
                        ? `/votings/${voting.id}/survey`
                        : `/votings/${voting.id}`
                    }
                    className="voting-card"
                  >
                    <div className="voting-header">
                      <h3 className="voting-title">{voting.title}</h3>
                      <span className="voting-badge completed">Completed</span>
                    </div>
                    {voting.description && (
                      <p className="voting-description">{voting.description}</p>
                    )}
                    <div className="voting-meta">
                      <span className="voting-group">
                        Group: {voting.groupName || voting.groupId}
                      </span>
                      <div className="voting-stats">
                        <span>{voting.optionCount ?? "..."} options</span>
                        <span>{voting.voteCount ?? "..."} votes</span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="loading">No recent votings.</div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
