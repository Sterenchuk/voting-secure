import { useEffect, useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import VotingSettingsModal from "../components/VotingSettingsModal";
import "../styles/Home.css";
import "../styles/Votings.css";

interface GroupMember {
  userId: string;
  role: "OWNER" | "ADMIN" | "MEMBER";
}

interface Voting {
  id: string;
  title: string;
  description?: string;
  groupId: string;
  // NEW: Nested group object from Prisma
  group: {
    name: string;
    users: GroupMember[];
  };
  startAt?: string;
  endAt?: string;
  optionCount?: number;
  voteCount?: number;
  isSurvey?: boolean;
}

interface ModalVotingState {
  id: string;
  title: string;
  startAt?: string;
  endAt?: string;
}

export default function Votings() {
  const [allVotings, setAllVotings] = useState<Voting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const userRole = localStorage.getItem("userRole");
  const isAppAdmin = userRole === "ADMIN" || userRole === "OWNER";

  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [modalVoting, setModalVoting] = useState<ModalVotingState | null>(null);

  const fetchVotings = async () => {
    try {
      setLoading(true);
      setError(null);
      const data: Voting[] = await protectedFetch(`/votings`);
      const safeData: Voting[] = data.map((v) => ({
        ...v,
        groupName: v.group.name || "Unknown Group",
        optionCount: v.optionCount ?? 0,
        voteCount: v.voteCount ?? 0,
      }));
      setAllVotings(safeData);
    } catch (err: any) {
      console.error("Failed to fetch votings:", err);
      setError(err.message || "Failed to load votings from the server.");
      setAllVotings([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVotings();
  }, []);

  const handleDelete = async (
    e: React.MouseEvent,
    id: string,
    title: string
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (
      !window.confirm(`Are you sure you want to delete the voting: "${title}"?`)
    ) {
      return;
    }

    try {
      await protectedFetch(`/votings/${id}`, {
        method: "DELETE",
      });

      setAllVotings((prev) => prev.filter((v) => v.id !== id));
    } catch (err: any) {
      console.error("Failed to delete voting:", err);
      alert(err.message || "An error occurred while deleting the voting.");
    }
  };

  const isVotingActive = (voting: Voting): boolean => {
    const now = new Date().getTime();
    const startTime = voting.startAt ? new Date(voting.startAt).getTime() : 0;
    const endTime = voting.endAt ? new Date(voting.endAt).getTime() : Infinity;
    return now >= startTime && now < endTime;
  };

  const isVotingCompleted = (voting: Voting): boolean => {
    if (!voting.endAt) return false;
    return new Date(voting.endAt).getTime() <= new Date().getTime();
  };

  const filteredVotings = useMemo(() => {
    let list = allVotings.filter((voting) => {
      const matchesSearch = voting.title
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      if (!matchesSearch) return false;

      const active = isVotingActive(voting);
      const completed = isVotingCompleted(voting);
      const isRecent =
        voting.startAt &&
        new Date().getTime() - new Date(voting.startAt).getTime() <
          7 * 24 * 60 * 60 * 1000;

      if (filter === "active") return active;
      if (filter === "completed") return completed;
      if (filter === "recent") return isRecent;
      return true;
    });

    list = list.sort((a, b) => {
      const aActive = isVotingActive(a);
      const bActive = isVotingActive(b);
      if (aActive && !bActive) return -1;
      if (!aActive && bActive) return 1;
      const dateA = a.endAt ? new Date(a.endAt).getTime() : Infinity;
      const dateB = b.endAt ? new Date(b.endAt).getTime() : Infinity;
      if (aActive) return dateA - dateB;
      return dateB - dateA;
    });

    return list;
  }, [allVotings, searchTerm, filter]);

  const getBadgeClass = (voting: Voting) => {
    return isVotingActive(voting) ? "active" : "completed";
  };

  const getTimeRemaining = (voting: Voting) => {
    if (isVotingCompleted(voting)) return "Completed";
    if (
      voting.startAt &&
      new Date(voting.startAt).getTime() > new Date().getTime()
    )
      return "Pending";
    if (!voting.endAt) return "Indefinite";
    const diff = new Date(voting.endAt).getTime() - new Date().getTime();
    if (diff <= 0) return "Completed";
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    if (days > 0) return `${days}d ${hours}h left`;
    return `${hours}h left`;
  };

  const handleOpenSettings = (voting: Voting) => {
    setModalVoting({
      id: voting.id,
      title: voting.title,
      startAt: voting.startAt,
      endAt: voting.endAt,
    });
    setShowSettingsModal(true);
  };

  return (
    <div className="home-container">
      {showSettingsModal && modalVoting && (
        <VotingSettingsModal
          voting={modalVoting}
          onClose={() => setShowSettingsModal(false)}
          onUpdate={fetchVotings}
        />
      )}

      <div className="home-header">
        <h1 className="home-title">Votings</h1>
        <p className="home-subtitle">
          Participate in active votings and view past results.
        </p>
      </div>

      <div className="votings-page-actions">
        <div className="filters-container">
          <input
            type="text"
            placeholder="Search votings..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="filter-select"
          >
            <option value="all">All Votings</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="recent">Recent</option>
          </select>
        </div>

        <Link to="/votings/create" className="create-voting-button">
          + Create New Voting
        </Link>
      </div>

      <div className="home-grid">
        <section className="home-section">
          <div className="section-header">
            <h2 className="section-title">
              Voting List ({filteredVotings.length})
            </h2>
          </div>

          {loading ? (
            <div className="loading">Loading votings...</div>
          ) : error ? (
            <div className="error-message">{error}</div>
          ) : (
            <div className="votings-list-full">
              {filteredVotings.length > 0 ? (
                filteredVotings.map((voting) => (
                  <Link
                    key={voting.id}
                    to={
                      voting.isSurvey
                        ? `/votings/${voting.id}/survey`
                        : `/votings/${voting.id}`
                    }
                    className="voting-card-list"
                    style={{
                      textDecoration: "none",
                      color: "inherit",
                      display: "block",
                    }}
                  >
                    <div className="voting-card-header">
                      <h3 className="voting-title">{voting.title}</h3>
                      <div className="voting-actions-container">
                        {isAppAdmin && (
                          <>
                            <button
                              className="settings-button"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleOpenSettings(voting);
                              }}
                              title="Manage Voting Dates"
                            >
                              ⚙️
                            </button>
                            <button
                              className="settings-button delete-action"
                              onClick={(e) =>
                                handleDelete(e, voting.id, voting.title)
                              }
                              title="Delete Voting"
                            >
                              🗑️
                            </button>
                          </>
                        )}
                        <span
                          className={`voting-badge ${getBadgeClass(voting)}`}
                        >
                          {isVotingActive(voting) ? "Active" : "Completed"}
                        </span>
                      </div>
                    </div>

                    {voting.description && (
                      <p className="voting-description">{voting.description}</p>
                    )}

                    <div className="voting-card-meta">
                      <span className="voting-group">
                        Group: <strong>{voting.group.name}</strong>
                      </span>
                      <div className="voting-card-stats">
                        <span className="stat-item">
                          {voting.optionCount} options
                        </span>
                        <span className="stat-item">
                          {voting.voteCount} votes
                        </span>
                        <span
                          className={`stat-item time-remaining ${getBadgeClass(
                            voting
                          )}`}
                        >
                          {getTimeRemaining(voting)}
                        </span>
                      </div>
                    </div>
                  </Link>
                ))
              ) : (
                <div className="no-results">
                  No votings found matching the current search and filter
                  criteria.
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
