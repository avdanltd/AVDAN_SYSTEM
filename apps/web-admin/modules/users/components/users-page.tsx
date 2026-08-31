"use client";

import { useState } from "react";

import {
  DataTable,
  Column,
  Badge,
  UserStatusBadge,
  Button,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@avdan/ui";
import {
  MoreHorizontal,
  Plus,
  Search,
  UserX,
  ShieldCheck,
  UserCheck,
  Building2,
} from "lucide-react";
import { useUsers } from "../hooks/use-users";
import { useUpdateUserStatus } from "../hooks/use-update-user-status";
import type { AdminUser } from "../types";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/modules/shared/components/pagination";
import { CreateAdminDialog } from "./create-admin-dialog";
import { AssignHubDialog } from "./assign-hub-dialog";

const ROLE_OPTIONS = [
  { value: "__all__", label: "All Roles" },
  { value: "customer", label: "Customer" },
  { value: "vendor", label: "Vendor" },
  { value: "rider", label: "Rider" },
  { value: "agent", label: "Agent" },
  { value: "admin", label: "Admin" },
  { value: "support", label: "Support" },
];

interface PendingAction {
  user: AdminUser;
  action: "activate" | "suspend" | "ban";
}

export function UsersPage() {
  const [page, setPage] = useState(1);
  const [role, setRole] = useState("");
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [assignHubUser, setAssignHubUser] = useState<AdminUser | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [banConfirmText, setBanConfirmText] = useState("");

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (role) params.role = role;
  if (search) params.search = search;

  const { data, isLoading } = useUsers(params);
  const { mutate: updateStatus, isPending: updating } = useUpdateUserStatus();

  const users = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data ? Math.ceil(data.total / (data.page_size || 20)) : 1;

  function handleAction(
    user: AdminUser,
    action: "activate" | "suspend" | "ban",
  ) {
    setPendingAction({ user, action });
    setBanConfirmText("");
  }

  function handleConfirm() {
    if (!pendingAction) return;
    const statusMap = {
      activate: "active",
      suspend: "suspended",
      ban: "banned",
    };
    updateStatus(
      { id: pendingAction.user.id, status: statusMap[pendingAction.action] },
      { onSuccess: () => setPendingAction(null) },
    );
  }

  const columns: Column<AdminUser>[] = [
    {
      key: "name",
      header: "Name",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.id.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: "contact",
      header: "Email / Phone",
      cell: (row) => (
        <div>
          <p className="text-sm">{row.email ?? "—"}</p>
          <p className="text-xs text-muted-foreground">{row.phone ?? "—"}</p>
        </div>
      ),
    },
    {
      key: "role",
      header: "Role",
      cell: (row) => (
        <Badge variant="secondary" className="capitalize">
          {row.role}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <UserStatusBadge status={row.status} />,
    },
    {
      key: "created_at",
      header: "Joined",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.created_at)}
        </span>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      cell: (row) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            {row.status !== "active" && (
              <DropdownMenuItem onClick={() => handleAction(row, "activate")}>
                <UserCheck className="mr-2 h-4 w-4 text-green-600" />
                Activate
              </DropdownMenuItem>
            )}
            {row.status === "active" && (
              <DropdownMenuItem onClick={() => handleAction(row, "suspend")}>
                <ShieldCheck className="mr-2 h-4 w-4 text-amber-600" />
                Suspend
              </DropdownMenuItem>
            )}
            {row.role === "agent" && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAssignHubUser(row)}>
                  <Building2 className="mr-2 h-4 w-4 text-blue-600" />
                  Assign Hub
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleAction(row, "ban")}
            >
              <UserX className="mr-2 h-4 w-4" />
              Ban User
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  const isBanAction = pendingAction?.action === "ban";

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Users</h1>
          <p className="text-sm text-muted-foreground">{total} total users</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Create Staff
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name, email or phone…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={role || "__all__"}
          onValueChange={(v) => {
            setRole(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All Roles" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={users}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No users found."
        />
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </div>

      <CreateAdminDialog open={createOpen} onOpenChange={setCreateOpen} />
      {assignHubUser && (
        <AssignHubDialog
          user={assignHubUser}
          open
          onOpenChange={(o) => !o && setAssignHubUser(null)}
        />
      )}

      {/* Confirm Dialog for activate/suspend */}
      {pendingAction && !isBanAction && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setPendingAction(null)}
          title={
            pendingAction.action === "activate"
              ? "Activate User"
              : "Suspend User"
          }
          description={
            pendingAction.action === "activate"
              ? `Activate ${pendingAction.user.name ?? pendingAction.user.email}? They will regain access to the platform.`
              : `Suspend ${pendingAction.user.name ?? pendingAction.user.email}? They will lose access until reactivated.`
          }
          confirmLabel={
            pendingAction.action === "activate" ? "Activate" : "Suspend"
          }
          destructive={pendingAction.action === "suspend"}
          loading={updating}
          onConfirm={handleConfirm}
        />
      )}

      {/* Typed confirmation for ban */}
      {pendingAction && isBanAction && (
        <Dialog open onOpenChange={(o) => !o && setPendingAction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Ban User</DialogTitle>
              <DialogDescription>
                This will permanently ban{" "}
                <strong>
                  {pendingAction.user.name ?? pendingAction.user.email}
                </strong>
                . They will be unable to access the platform. Type{" "}
                <strong className="text-destructive">CONFIRM</strong> to
                proceed.
              </DialogDescription>
            </DialogHeader>
            <Input
              placeholder="Type CONFIRM"
              value={banConfirmText}
              onChange={(e) => setBanConfirmText(e.target.value)}
            />
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setPendingAction(null)}
                disabled={updating}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                disabled={banConfirmText !== "CONFIRM" || updating}
                onClick={handleConfirm}
              >
                {updating ? "Banning…" : "Ban User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
