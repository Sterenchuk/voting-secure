"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGroups, GroupMember } from "@/hooks/api/useGroups";
import { useAuth } from "@/lib/auth/context";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Users, 
  UserPlus, 
  Trash2, 
  Shield, 
  ShieldAlert, 
  Settings,
  ArrowLeft
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const ROLES: GroupMember["role"][] = ["OWNER", "ADMIN", "MODERATOR", "MEMBER"];

export default function GroupSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const { user: currentUser } = useAuth();
  const { 
    currentGroup, 
    loading, 
    fetchGroup, 
    changeUserRole, 
    removeUsers, 
    addUsers 
  } = useGroups();

  const [inviteEmail, setInviteEmail] = useState("");
  const groupId = params.id as string;

  useEffect(() => {
    if (groupId) {
      fetchGroup(groupId);
    }
  }, [groupId, fetchGroup]);

  const handleRoleChange = async (targetUserId: string, newRole: GroupMember["role"]) => {
    const res = await changeUserRole(groupId, targetUserId, newRole);
    if (!res.error) {
      toast({ title: "Role Updated", description: "User role has been successfully updated." });
    } else {
      toast({ 
        title: "Update Failed", 
        description: res.error.message || "Failed to update role.",
        variant: "destructive"
      });
    }
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (confirm("Are you sure you want to remove this member?")) {
      const res = await removeUsers(groupId, [targetUserId]);
      if (!res.error) {
        toast({ title: "Member Removed", description: "User has been removed from the group." });
      } else {
        toast({ 
          title: "Removal Failed", 
          description: res.error.message || "Failed to remove member.",
          variant: "destructive"
        });
      }
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    const res = await addUsers(groupId, undefined, [inviteEmail.trim()]);

    if (!res.error) {
      toast({ title: "Member Invited", description: `${inviteEmail} has been added to the group.` });
      setInviteEmail("");
    } else {
      toast({ 
        title: "Invite Failed", 
        description: res.error.message || "User not found or already in group.",
        variant: "destructive"
      });
    }
  };

  if (loading && !currentGroup) return <div className="p-8 text-center">Loading group settings...</div>;
  if (!currentGroup) return <div className="p-8 text-center">Group not found.</div>;

  const userMembership = currentGroup.users?.find(u => u.userId === currentUser?.id);
  const canManage = userMembership?.role === "OWNER" || userMembership?.role === "ADMIN" || currentUser?.role === "admin";

  if (!canManage) {
    return (
      <div className="p-8 text-center">
        <ShieldAlert className="mx-auto h-12 w-12 text-destructive mb-4" />
        <h2 className="text-xl font-bold">Access Denied</h2>
        <p className="text-muted-foreground">You do not have permission to manage this group.</p>
        <Button className="mt-4" onClick={() => router.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{currentGroup.name} Settings</h1>
            <p className="text-muted-foreground">Manage group members, roles, and invitations.</p>
          </div>
        </div>
        <Badge variant="outline" className="px-3 py-1">
          <Shield className="h-3 w-3 mr-2" />
          {userMembership?.role}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <UserPlus className="h-5 w-5" />
              Invite Member
            </CardTitle>
            <CardDescription>Add a user to the group by their email address.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleInvite} className="grid gap-4">
              <div className="grid gap-2">
                <Input 
                  placeholder="user@example.com" 
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full">Add User</Button>
            </form>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Users className="h-5 w-5" />
              Group Members
            </CardTitle>
            <CardDescription>
              Total members: {currentGroup.users?.length || 0}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentGroup.users?.map((member) => (
                  <TableRow key={member.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{member.user?.name || "Anonymous"}</span>
                        <span className="text-xs text-muted-foreground">{member.user?.email}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Select
                        value={member.role}
                        onValueChange={(val: GroupMember["role"]) => handleRoleChange(member.userId, val)}
                        disabled={
                          member.userId === currentUser?.id || // Can't change own role
                          (userMembership?.role === "ADMIN" && member.role === "OWNER") // ADMIN can't change OWNER
                        }
                      >
                        <SelectTrigger className="w-[130px] h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((r) => (
                            <SelectItem key={r} value={r} className="text-xs">
                              {r}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => handleRemoveMember(member.userId)}
                        disabled={
                          member.userId === currentUser?.id || // Can't remove self
                          (userMembership?.role === "ADMIN" && (member.role === "OWNER" || member.role === "ADMIN")) // ADMIN constraints
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
