"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

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
import { ROUTES } from "@/config/routes";
import { BranchRequestsPanel } from "./branch-requests-panel";
import { useVendorCounts } from "../hooks/use-vendor-counts";

// `count` is the key into GET /admin/vendors/counts, so every option can show how many it holds.
const STATUS_OPTIONS = [
  { value: "__all__", label: "All", count: "all" },
  { value: "__incomplete__", label: "Incomplete profile", count: "incomplete" },
  { value: "pending", label: "Pending", count: "pending" },
  { value: "active", label: "Active", count: "active" },
  { value: "suspended", label: "Suspended", count: "suspended" },
  { value: "rejected", label: "Rejected", count: "rejected" },
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
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("__all__");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(
    null,
  );
  const [reason, setReason] = useState("");
  const [approveConfirmOpen, setApproveConfirmOpen] =
    useState<AdminVendor | null>(null);

  const params: Record<string, string> = { page: String(page), limit: "20" };
  // "All" and "Incomplete profile" are filters of their own, never a status the API should match.
  if (status === "__incomplete__") params.incomplete = "true";
  else if (status && status !== "__all__") params.status = status;

  const { data, isLoading, isError, refetch } = useAdminVendors(params);
  const { mutate: updateStatus, isPending: updating } = useUpdateVendorStatus();
  const { data: counts } = useVendorCounts();

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
          {(row.missing?.length ?? 0) > 0 && (
            <span
              className="mt-1 inline-flex items-center gap-1 rounded-full bg-destructive px-2 py-0.5 text-[11px] font-semibold text-destructive-foreground"
              title={`Not filled in yet: ${row.missing?.join(", ")}`}
            >
              {row.missing?.length} missing
            </span>
          )}
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
          <Star className="h-3 w-3 fill-warning text-warning" />
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
            <DropdownMenuItem onClick={() => router.push(ROUTES.vendor(row.id))}>
              View full profile
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {row.status !== "active" && (
              <DropdownMenuItem onClick={() => handleApprove(row)}>
                <CheckCircle className="mr-2 h-4 w-4 text-success" />
                Approve
              </DropdownMenuItem>
            )}
            {row.status === "active" && (
              <DropdownMenuItem
                onClick={() => handleSuspendReject(row, "suspend")}
              >
                <PauseCircle className="mr-2 h-4 w-4 text-warning" />
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
          <h1 className="font-display text-2xl font-semibold text-foreground">Vendors</h1>
          <p className="text-sm text-muted-foreground">{total} vendors</p>
        </div>
      </div>

      {(counts?.incomplete ?? 0) > 0 && status !== "__incomplete__" && (
        <button
          type="button"
          onClick={() => { setStatus("__incomplete__"); setPage(1); }}
          className="flex w-full items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-left text-sm text-destructive hover:bg-destructive/15"
        >
          <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground">
            {counts?.incomplete}
          </span>
          vendor{counts?.incomplete === 1 ? "" : "s"} haven&apos;t filled in all the requirements. Tap to see who.
        </button>
      )}

      <BranchRequestsPanel />

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select
          value={status || "__all__"}
          onValueChange={(v) => {
            setStatus(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-56">
            <SelectValue placeholder="All" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {counts ? `${counts[opt.count] ?? 0} · ` : ""}
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={vendors}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          error={isError}
          errorMessage="Couldn't load vendors."
          onRetry={() => refetch()}
          emptyMessage="No vendors found."
          onRowClick={(row) => router.push(ROUTES.vendor(row.id))}
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
