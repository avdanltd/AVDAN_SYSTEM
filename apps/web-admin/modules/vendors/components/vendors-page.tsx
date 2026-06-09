"use client";

import { useState } from "react";

import {
  DataTable,
  Column,
  Badge,
  Button,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@avdan/ui";
import {
  MoreHorizontal,
  Star,
  CheckCircle,
  XCircle,
  PauseCircle,
} from "lucide-react";
import { useAdminVendors } from "../hooks/use-admin-vendors";
import { useUpdateVendorStatus } from "../hooks/use-update-vendor-status";
import type { AdminVendor } from "../types";
import { formatDate } from "@/lib/format";
import { Pagination } from "@/modules/shared/components/pagination";

const STATUS_OPTIONS = [
  { value: "__all__", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "rejected", label: "Rejected" },
];

const STATUS_VARIANTS: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "outline",
  active: "default",
  suspended: "secondary",
  rejected: "destructive",
};

interface PendingAction {
  vendor: AdminVendor;
  action: "approve" | "suspend" | "reject";
}

export function VendorsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("__all__");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [approveConfirmOpen, setApproveConfirmOpen] =
    useState<AdminVendor | null>(null);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (status) params.status = status;

  const { data, isLoading } = useAdminVendors(params);
  const { mutate: updateStatus, isPending: updating } = useUpdateVendorStatus();

  const vendors = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data ? Math.ceil(data.total / (data.page_size || 20)) : 1;

  function handleApprove(vendor: AdminVendor) {
    setApproveConfirmOpen(vendor);
  }

  function handleApproveConfirm() {
    if (!approveConfirmOpen) return;
    updateStatus(
      { id: approveConfirmOpen.id, status: "active" },
      { onSuccess: () => setApproveConfirmOpen(null) },
    );
  }

  function handleSuspendReject(
    vendor: AdminVendor,
    action: "suspend" | "reject",
  ) {
    setPendingAction({ vendor, action });
    setReason("");
  }

  function handleActionConfirm() {
    if (!pendingAction) return;
    const status =
      pendingAction.action === "suspend" ? "suspended" : "rejected";
    updateStatus(
      { id: pendingAction.vendor.id, status, reason },
      { onSuccess: () => setPendingAction(null) },
    );
  }

  const columns: Column<AdminVendor>[] = [
    {
      key: "name",
      header: "Vendor",
      cell: (row) => (
        <div>
          <p className="font-medium text-foreground">{row.name}</p>
          <p className="text-xs text-muted-foreground">{row.id.slice(0, 8)}…</p>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => (
        <Badge
          variant={STATUS_VARIANTS[row.status] ?? "secondary"}
          className="capitalize"
        >
          {row.status}
        </Badge>
      ),
    },
    {
      key: "rating",
      header: "Rating",
      cell: (row) => (
        <div className="flex items-center gap-1">
          <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
          <span className="text-sm">{row.rating?.toFixed(1) ?? "N/A"}</span>
        </div>
      ),
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
          <DropdownMenuContent align="end">
            {row.status !== "active" && (
              <DropdownMenuItem onClick={() => handleApprove(row)}>
                <CheckCircle className="mr-2 h-4 w-4 text-green-600" />
                Approve
              </DropdownMenuItem>
            )}
            {row.status === "active" && (
              <DropdownMenuItem
                onClick={() => handleSuspendReject(row, "suspend")}
              >
                <PauseCircle className="mr-2 h-4 w-4 text-amber-600" />
                Suspend
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onClick={() => handleSuspendReject(row, "reject")}
            >
              <XCircle className="mr-2 h-4 w-4" />
              Reject
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Vendors</h1>
          <p className="text-sm text-muted-foreground">{total} vendors</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={status || "__all__"}
          onValueChange={(v) => {
            setStatus(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-background">
        <DataTable
          columns={columns}
          data={vendors}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          emptyMessage="No vendors found."
        />
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </div>

      {/* Approve confirm */}
      {approveConfirmOpen && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setApproveConfirmOpen(null)}
          title="Approve Vendor"
          description={`Approve ${approveConfirmOpen.name}? They will be able to list products and receive orders.`}
          confirmLabel="Approve"
          loading={updating}
          onConfirm={handleApproveConfirm}
        />
      )}

      {/* Suspend / Reject dialog with reason */}
      {pendingAction && (
        <Dialog open onOpenChange={(o) => !o && setPendingAction(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {pendingAction.action === "suspend"
                  ? "Suspend Vendor"
                  : "Reject Vendor"}
              </DialogTitle>
              <DialogDescription>
                {pendingAction.action === "suspend"
                  ? `Suspend ${pendingAction.vendor.name}? Provide a reason.`
                  : `Reject ${pendingAction.vendor.name}? Provide a reason.`}
              </DialogDescription>
            </DialogHeader>
            <Textarea
              placeholder="Reason (required)…"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
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
                disabled={!reason.trim() || updating}
                onClick={handleActionConfirm}
              >
                {updating
                  ? "Saving…"
                  : pendingAction.action === "suspend"
                    ? "Suspend"
                    : "Reject"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
