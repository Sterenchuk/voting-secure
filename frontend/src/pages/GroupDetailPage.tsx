import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { protectedFetch } from "../utils/api";
import type { GroupResponseDto, UserData } from "../types/group.d";
import "../styles/GroupDetailPage.css";

// Assuming RoleSelectorModal is saved in the same pages/components directory
import RoleSelectorModal from "../components/RoleSelectorModal";

// Interface for Delete Modal
interface MemberToDelete {
  id: string;
  email: string;
  nameOrEmail: string;
}

// Interface for Change Role Modal
interface MemberToChangeRole {
  id: string;
  email: string;
  name: string;
  currentRole: string;
}

// --- CONFIRMATION MODAL INTERFACE ---
interface ConfirmationModalProps {
  user: MemberToDelete;
  onClose: () => void;
  onConfirm: (userEmail: string) => void;
}

// FIX: Replaced <...> with ConfirmationModalProps
const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  user,
  onClose,
  onConfirm,
}) => (
  <div
    className="modal-backdrop"
    style={{
      backgroundColor: "rgba(0, 0, 0, 0.75)",
      position: "fixed",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 1000,
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
    }}
  >
    <div className="modal-content">
      <h3>Confirm Deletion</h3>
      <p>
        Are you sure you want to remove <strong>{user.nameOrEmail}</strong> from
        this group?
      </p>
      <div className="modal-actions">
        <button className="action-button secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          className="action-button delete-confirm"
          onClick={() => onConfirm(user.email)}
        >
          Yes, Remove
        </button>
      </div>
    </div>
  </div>
);

// --- ADD USER MODAL INTERFACE ---
interface AddUserModalProps {
  groupId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

// FIX: Replaced <...> with AddUserModalProps
const AddUserModal: React.FC<AddUserModalProps> = ({
  groupId,
  onClose,
  onSuccess,
}) => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    if (!groupId) {
      setMessage("Error: Group ID is missing.");
      setLoading(false);
      return;
    }

    try {
      await protectedFetch(`/groups/${groupId}/add/users`, {
        method: "PATCH",
        body: JSON.stringify({ userEmails: [email] }),
        headers: { "Content-Type": "application/json" },
      });
      setMessage(`User with email ${email} added successfully!`);
      setEmail("");
      onSuccess();
      setTimeout(onClose, 1500);
    } catch (err: any) {
      setMessage(err.message || "Failed to add user.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div
      className="modal-backdrop"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 1000,
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <div className="modal-content">
        <h3>Add User to Group</h3>
        <form onSubmit={handleAddUser}>
          <input
            type="email"
            placeholder="User Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="modal-input"
            disabled={loading}
          />
          {message && (
            <p
              className={`form-message ${
                message?.includes("successfully") ? "success" : "error"
              }`}
            >
              {message}
            </p>
          )}
          <div className="modal-actions">
            <button
              type="button"
              className="action-button secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-button primary"
              disabled={loading || !email}
            >
              {loading ? "Adding..." : "Add User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- CHANGE ROLE MODAL INTERFACE ---
interface ChangeRoleModalProps {
  groupId: string;
  member: MemberToChangeRole;
  onClose: () => void;
  onSuccess: () => void;
}

// FIX: Replaced <...> with ChangeRoleModalProps
const ChangeRoleModal: React.FC<ChangeRoleModalProps> = ({
  groupId,
  member,
  onClose,
  onSuccess,
}) => {
  const availableRoles = ["MEMBER", "ADMIN", "OWNER"];
  const [newRole, setNewRole] = useState(member.currentRole);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const handleRoleChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    if (newRole === member.currentRole) {
      setMessage("Role is already set to this value.");
      setLoading(false);
      return;
    }

    try {
      // Endpoint: PATCH /groups/:id/change/role
      await protectedFetch(`/groups/${groupId}/change/role`, {
        method: "PATCH",
        body: JSON.stringify({ userEmail: member.email, role: newRole }),
        headers: { "Content-Type": "application/json" },
      });
      setMessage(`Role for ${member.name} changed to ${newRole} successfully!`);
      onSuccess();
      setTimeout(onClose, 1500);
    } catch (err: any) {
      const errorMsg = err.message || "Failed to change user role.";
      setMessage(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <h3>Change Role for {member.name || member.email}</h3>
        <form onSubmit={handleRoleChange}>
          <label
            htmlFor="role-select"
            style={{ display: "block", marginBottom: "8px" }}
          >
            Current Role: <strong>{member.currentRole}</strong>
          </label>
          <select
            id="role-select"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            required
            className="modal-input"
            disabled={loading}
            style={{ width: "100%", padding: "10px", marginBottom: "15px" }}
          >
            {availableRoles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>

          {message && (
            <p
              className={`form-message ${
                message?.includes("successfully") ? "success" : "error"
              }`}
            >
              {message}
            </p>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="action-button secondary"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="action-button primary"
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default function GroupDetailPage() {
  const { id: groupId } = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupResponseDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentUserId = localStorage.getItem("userId") || "";

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<MemberToDelete | null>(null);
  const [showAddUserModal, setShowAddUserModal] = useState(false);

  // Visibility for the Selector Modal
  const [showRoleSelectorModal, setShowRoleSelectorModal] = useState(false);

  // STATE for the specific member whose role is being changed
  const [showChangeRoleModal, setShowChangeRoleModal] = useState(false);
  const [memberToChangeRole, setMemberToChangeRole] =
    useState<MemberToChangeRole | null>(null);

  const fetchGroupDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const data: GroupResponseDto = await protectedFetch(`/groups/${groupId}`);
      setGroup(data);
    } catch (err: any) {
      setError(err.message || "Could not load group details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!groupId) {
      setError("Group ID is missing from the URL.");
      setLoading(false);
      return;
    }
    fetchGroupDetails();
  }, [groupId]);

  // Handler to open Delete Modal
  const handleDeleteUserClick = (
    memberId: string,
    memberEmail: string,
    nameOrEmail: string
  ) => {
    setUserToDelete({ id: memberId, email: memberEmail, nameOrEmail });
    setShowDeleteModal(true);
  };

  // Handler called when a member is selected from RoleSelectorModal
  const handleMemberSelectForRoleChange = (
    user: UserData,
    currentRole: string
  ) => {
    // 1. Close the selector modal
    setShowRoleSelectorModal(false);

    // 2. Set the member data
    setMemberToChangeRole({
      id: user.id,
      email: user.email,
      name: user.name,
      currentRole: currentRole,
    });

    // 3. Open the actual ChangeRoleModal
    setShowChangeRoleModal(true);
  };

  // Handler for when the ChangeRoleModal finishes its action
  const handleRoleChangeSuccess = () => {
    // Refresh the group data and ensure the ChangeRoleModal closes
    fetchGroupDetails();
    setShowChangeRoleModal(false);
  };

  const confirmDelete = async (userEmail: string) => {
    if (!groupId) return;

    try {
      setLoading(true);
      await protectedFetch(`/groups/${groupId}/remove/users`, {
        method: "PATCH",
        body: JSON.stringify({ userEmails: [userEmail] }),
        headers: { "Content-Type": "application/json" },
      });

      await fetchGroupDetails();
    } catch (err: any) {
      setError(err.message || `Failed to remove user ${userEmail}.`);
    } finally {
      setShowDeleteModal(false);
      setUserToDelete(null);
      setLoading(false);
    }
  };

  if (error) {
    return <div className="error-container">Error: {error}</div>;
  }
  if (loading) {
    return <div className="loading">Loading group details...</div>;
  }
  if (!group) {
    return <div className="no-data">Group not found.</div>;
  }

  let currentUserMembership = undefined;

  if (currentUserId && group.users) {
    currentUserMembership = group.users.find((membership) => {
      const nestedUserIdMatch = membership.user?.id === currentUserId;
      const topLevelUserIdMatch = membership.userId === currentUserId;

      return nestedUserIdMatch || topLevelUserIdMatch;
    });
  }

  const role = currentUserMembership?.role;
  const isAdmin = role === "ADMIN" || role === "OWNER";

  // Logic to find the CREATOR's name
  const creatorMembership = group.users?.find(
    (membership) => membership.user.id === group.creatorId
  );
  const creatorName =
    creatorMembership?.user.name ||
    creatorMembership?.user.email ||
    "Unknown Creator";

  return (
    <div className="group-detail-container">
      {/* --- Modals --- */}
      {showDeleteModal && userToDelete && (
        <ConfirmationModal
          user={userToDelete}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={confirmDelete}
        />
      )}

      {showAddUserModal && (
        <AddUserModal
          groupId={groupId}
          onClose={() => setShowAddUserModal(false)}
          onSuccess={fetchGroupDetails}
        />
      )}

      {/* Role Selector Modal */}
      {showRoleSelectorModal && group && (
        <RoleSelectorModal
          group={group}
          currentUserId={currentUserId}
          onClose={() => setShowRoleSelectorModal(false)}
          onMemberSelect={handleMemberSelectForRoleChange}
        />
      )}

      {/* Change Role Modal Render (Now only opens after selection from RoleSelectorModal) */}
      {showChangeRoleModal && memberToChangeRole && groupId && (
        <ChangeRoleModal
          groupId={groupId}
          member={memberToChangeRole}
          onClose={() => setShowChangeRoleModal(false)}
          onSuccess={handleRoleChangeSuccess}
        />
      )}

      <div className="group-header">
        <h1 className="group-title">{group.name}</h1>
        <p className="group-meta">
          Created by: {creatorName} | Created on:{" "}
          {new Date(group.createdAt).toLocaleDateString()}
        </p>
      </div>

      <div className="group-actions">
        {/* Button distinction update */}
        <button className="action-button primary">Start New Voting</button>
        {isAdmin && (
          <button
            className="action-button primary-outline"
            onClick={() => setShowRoleSelectorModal(true)}
          >
            Manage Roles
          </button>
        )}
      </div>

      <section className="section-block">
        <h2 className="section-title">Members ({group.users?.length || 0})</h2>
        <div className="members-list">
          {group.users && group.users.length > 0 ? (
            group.users.map((membership) => (
              <div
                key={membership.user.id}
                className={`member-card ${
                  isAdmin ? "admin-actions-enabled" : ""
                }`}
              >
                <div className="member-info">
                  <span className="member-name">
                    {membership.user.name || membership.user.email}
                    {membership.user.id === group.creatorId && (
                      <span className="member-tag">(Creator)</span>
                    )}
                  </span>
                  <span className="member-email">{membership.user.email}</span>
                  <span
                    className={`member-role role-${membership.role.toLowerCase()}`}
                  >
                    {membership.role}
                  </span>
                </div>

                {isAdmin && membership.user.id !== currentUserId && (
                  <button
                    className="delete-button"
                    title={`Remove ${
                      membership.user.name || membership.user.email
                    }`}
                    onClick={() =>
                      handleDeleteUserClick(
                        membership.user.id,
                        membership.user.email,
                        membership.user.name || membership.user.email
                      )
                    }
                  >
                    &times;
                  </button>
                )}
              </div>
            ))
          ) : (
            <p>No members found.</p>
          )}
        </div>

        {isAdmin && (
          <button
            className="action-button secondary add-member-button"
            onClick={() => setShowAddUserModal(true)}
          >
            + Add User to Group
          </button>
        )}
      </section>

      <section className="section-block">
        <h2 className="section-title">Recent Votings</h2>
        <p>This is where the list of votings for this group will appear.</p>
      </section>
    </div>
  );
}
