"use client";

import { useState, useCallback } from "react";
import { api, ApiError } from "./useApi";
import { useAuth } from "@/lib/auth/context";

// ── Mirrors CreatorInfo DTO ───────────────────────────────────────────────────
export interface CreatorInfo {
  id: string;
  email: string;
  name: string | null;
}

// ── Mirrors UserGroupResponseDto ─────────────────────────────────────────────
export interface GroupMember {
  id: string;
  userId: string;
  groupId: string;
  role: "OWNER" | "ADMIN" | "MODERATOR" | "MEMBER";
  user?: {
    email: string;
    name: string | null;
  };
}

// ── Mirrors GroupResponseDto ──────────────────────────────────────────────────
// Backend returns: id, name, creatorId, creator?, deletedAt, createdAt,
// updatedAt, memberCount? (from _count.users), users? (UserGroupResponseDto[])
// No votingsCount / surveysCount — those are not in SELECT_GROUP_FIELDS
export interface Group {
  id: string;
  name: string;
  creatorId: string;
  creator?: CreatorInfo;
  deletedAt: string | null; // ISO string on the wire; Prisma DateTime → null not undefined
  createdAt: string;
  updatedAt: string;
  memberCount: number; // was membersCount — matches DTO field name exactly
  users?: GroupMember[]; // present only when fetched with SELECT_GROUP_WITH_USERS
  isMember?: boolean;
  userRole?: string;
}

export interface CreateGroupData {
  name: string;
  userEmails?: string[];
}

interface GroupsState {
  groups: Group[];
  currentGroup: Group | null;
  loading: boolean;
  error: ApiError | null;
}

// ── Maps raw backend response → typed Group ───────────────────────────────────
// Handles both SELECT_GROUP_FIELDS (_count.users) and SELECT_GROUP_WITH_USERS
// (users[]) shapes from the same mapper.
const mapGroup = (g: any): Group => ({
  id: g.id,
  name: g.name,
  creatorId: g.creatorId,
  creator: g.creator ?? undefined,
  deletedAt: g.deletedAt ?? null,
  createdAt: g.createdAt,
  updatedAt: g.updatedAt,
  memberCount: g.memberCount ?? g._count?.users ?? g.users?.length ?? 0,
  isMember: g.isMember,
  userRole: g.userRole,
  users: g.users?.map(
    (u: any): GroupMember => ({
      id: u.id,
      userId: u.userId,
      groupId: u.groupId,
      role: u.role,
      user: u.user ?? undefined,
    }),
  ),
});

export function useGroups() {
  const { user } = useAuth();
  const [state, setState] = useState<GroupsState>({
    groups: [],
    currentGroup: null,
    loading: false,
    error: null,
  });

  const fetchGroups = useCallback(async (filters?: { name?: string }) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const queryParams = new URLSearchParams();
    if (filters?.name) queryParams.append("name", filters.name);

    const url = `/groups${queryParams.toString() ? `?${queryParams}` : ""}`;
    const response = await api.get<any[]>(url);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        groups: response.data!.map(mapGroup),
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const fetchGroup = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.get<any>(`/groups/${id}`);

    if (response.data) {
      setState((prev) => ({
        ...prev,
        currentGroup: mapGroup(response.data),
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const createGroup = useCallback(async (data: CreateGroupData) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.post<any>("/groups", {
      ...data,
      userEmails: data.userEmails ?? [],
    });

    if (response.data) {
      const mapped = mapGroup(response.data);
      setState((prev) => ({
        ...prev,
        groups: [mapped, ...prev.groups],
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  const updateGroup = useCallback(
    async (id: string, data: Partial<CreateGroupData>) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await api.patch<any>(`/groups/${id}`, data);

      if (response.data) {
        const mapped = mapGroup(response.data);
        setState((prev) => ({
          ...prev,
          currentGroup: mapped,
          groups: prev.groups.map((g) => (g.id === id ? mapped : g)),
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error,
        }));
      }

      return response;
    },
    [],
  );

  // PATCH /groups/:id/add/users — backend expects { targetUserIds: string[] }
  // after ResolveEmailsPipe resolves emails → user ids
  const addUsers = useCallback(async (id: string, targetUserIds: string[]) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.patch<any>(`/groups/${id}/add/users`, {
      targetUserIds,
    });

    if (response.data) {
      const mapped = mapGroup(response.data);
      setState((prev) => ({
        ...prev,
        currentGroup: mapped,
        groups: prev.groups.map((g) => (g.id === id ? mapped : g)),
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  // PATCH /groups/:id/remove/users
  const removeUsers = useCallback(
    async (id: string, targetUserIds: string[]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await api.patch<any>(`/groups/${id}/remove/users`, {
        targetUserIds,
      });

      if (response.data) {
        const mapped = mapGroup(response.data);
        setState((prev) => ({
          ...prev,
          currentGroup: mapped,
          groups: prev.groups.map((g) => (g.id === id ? mapped : g)),
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error,
        }));
      }

      return response;
    },
    [],
  );

  const joinGroup = useCallback(
    async (id: string) => {
      if (!user) return { data: null, error: { message: "Not authenticated" } };
      return addUsers(id, [user.id]);
    },
    [user, addUsers],
  );

  const leaveGroup = useCallback(
    async (id: string) => {
      if (!user) return { data: null, error: { message: "Not authenticated" } };
      return removeUsers(id, [user.id]);
    },
    [user, removeUsers],
  );

  const changeUserRole = useCallback(
    async (id: string, targetUserId: string, role: GroupMember["role"]) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      const response = await api.patch<any>(`/groups/${id}/change/role`, {
        targetUserId,
        role,
      });

      if (response.data) {
        const mapped = mapGroup(response.data);
        setState((prev) => ({
          ...prev,
          currentGroup: mapped,
          groups: prev.groups.map((g) => (g.id === id ? mapped : g)),
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: response.error,
        }));
      }

      return response;
    },
    [],
  );

  const deleteGroup = useCallback(async (id: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const response = await api.delete(`/groups/${id}`);

    if (!response.error) {
      setState((prev) => ({
        ...prev,
        groups: prev.groups.filter((g) => g.id !== id),
        currentGroup: prev.currentGroup?.id === id ? null : prev.currentGroup,
        loading: false,
      }));
    } else {
      setState((prev) => ({ ...prev, loading: false, error: response.error }));
    }

    return response;
  }, []);

  return {
    ...state,
    fetchGroups,
    fetchGroup,
    createGroup,
    updateGroup,
    addUsers,
    removeUsers,
    joinGroup,
    leaveGroup,
    changeUserRole,
    deleteGroup,
  };
}

export default useGroups;
