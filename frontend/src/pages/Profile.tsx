import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import "../styles/Home.css";

// This matches your GroupResponseDto structure
interface GroupResponseDto {
  id: string;
  name: string;
  creatorId: string;
  createdAt: string;
  memberCount: number;
}

interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: string;
}

export default function Profile() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [groups, setGroups] = useState<GroupResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoading(true);
        // Parallel fetch for speed
        const [profile, userGroups] = await Promise.all([
          protectedFetch("/users/me"),
          protectedFetch("/groups"), // This hits your new findAll
        ]);

        setUser(profile);
        setGroups(userGroups);
      } catch (error) {
        console.error("Error loading profile data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProfileData();
  }, []);

  if (loading)
    return (
      <div className="voting-loading-screen">
        <div className="spinner" />
      </div>
    );

  return (
    <div className="home-container">
      <header className="voting-nav">
        <button onClick={() => navigate(-1)} className="glass-back-button">
          ← Back
        </button>
      </header>

      <main className="voting-container">
        {/* User Info Header */}
        <div className="voting-card-hero">
          <div className="hero-content">
            <div className="group-tag">{user?.role}</div>
            <h1 className="hero-title">{user?.name}</h1>
            <p className="hero-desc">{user?.email}</p>
          </div>
        </div>

        {/* Groups Section */}
        <section className="voting-section" style={{ marginTop: "40px" }}>
          <div className="section-header">
            <h2>Your Groups</h2>
          </div>

          <div className="options-grid">
            {groups.length > 0 ? (
              groups.map((group) => (
                <div
                  key={group.id}
                  className="option-card vote-mode"
                  style={{ cursor: "pointer" }}
                  onClick={() => navigate(`/groups/${group.id}`)}
                >
                  <div className="option-main">
                    <span className="option-text">👥 {group.name}</span>
                  </div>
                  <div className="option-meta-results">
                    <span>{group.memberCount} Members</span>
                  </div>
                </div>
              ))
            ) : (
              <p
                className="hero-desc"
                style={{ textAlign: "center", width: "100%" }}
              >
                You haven't joined any groups yet.
              </p>
            )}
          </div>
        </section>

        {/* Logout Action */}
        <div className="action-footer" style={{ marginTop: "40px" }}>
          <button
            className="primary-vote-button"
            style={{ background: "#ef4444" }}
            onClick={() => {
              localStorage.clear();
              navigate("/login");
            }}
          >
            Log Out
          </button>
        </div>
      </main>
    </div>
  );
}
