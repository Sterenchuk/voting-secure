import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import type { GroupResponseDto } from "../types/group";
import "../styles/Groups.css"; // We'll assume a dedicated CSS file

export default function Groups() {
  const [groups, setGroups] = useState<GroupResponseDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchName, setSearchName] = useState("");

  const fetchGroups = async (nameFilter?: string) => {
    setLoading(true);
    setError(null);
    try {
      // Endpoint: GET /groups?name={searchName}
      const query = nameFilter ? `?name=${encodeURIComponent(nameFilter)}` : "";

      const data: GroupResponseDto[] = await protectedFetch(`/groups${query}`);
      setGroups(data);
    } catch (err: any) {
      console.error("Failed to fetch groups:", err);
      setError(err.message || "Could not load groups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGroups();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGroups(searchName);
  };

  if (error) {
    return <div className="error-container">{error}</div>;
  }

  return (
    <div className="groups-container">
      <div className="groups-header">
        <h1 className="page-title">My Groups</h1>
        {/* Link to the new creation page */}
        <Link to="/groups/create" className="create-button">
          + Create New Group
        </Link>
      </div>

      <form className="search-form" onSubmit={handleSearchSubmit}>
        <input
          type="text"
          placeholder="Search groups by name..."
          value={searchName}
          onChange={(e) => setSearchName(e.target.value)}
        />
        <button type="submit">Search</button>
      </form>

      {loading ? (
        <div className="loading">Loading groups...</div>
      ) : (
        <div className="groups-list">
          {groups.length > 0 ? (
            groups.map((group) => (
              <div key={group.id} className="group-card">
                <h2 className="group-name">{group.name}</h2>
                <p className="group-meta">
                  Created: {new Date(group.createdAt).toLocaleDateString()}
                </p>
                {/* Member count display is already correct */}
                <p className="group-meta">
                  Members: {group.users?.length ?? "..."}
                </p>
                <div className="group-actions">
                  <Link to={`/groups/${group.id}`} className="view-link">
                    View Details
                  </Link>
                </div>
              </div>
            ))
          ) : (
            <div className="no-groups">No groups found.</div>
          )}
        </div>
      )}
    </div>
  );
}
