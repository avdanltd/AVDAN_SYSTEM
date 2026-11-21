"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import {
  DataTable,
  Column,
  OrderStatusBadge,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@avdan/ui";
import { Search } from "lucide-react";
import { useAdminOrders } from "../hooks/use-admin-orders";
import type { AdminOrder } from "../types";
import { formatKobo, formatDate } from "@/lib/format";
import { Pagination } from "@/modules/shared/components/pagination";
import { ROUTES } from "@/config/routes";
import { DateRangeBar } from "@avdan/ui";
import { presetRange, type RangePreset } from "@avdan/types";
import { OrderStatsPanel } from "./order-stats-panel";
import { useOrderStatusCounts } from "../hooks/use-order-status-counts";

const STATUS_OPTIONS = [
  { value: "__all__", label: "All Statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PAID", label: "Paid" },
  { value: "VENDOR_ACCEPTED", label: "Vendor Accepted" },
  { value: "VENDOR_REJECTED", label: "Vendor Rejected" },
  { value: "PREPARING", label: "Preparing" },
  { value: "READY_FOR_PICKUP", label: "Ready for Pickup" },
  { value: "PICKED_UP", label: "Picked Up" },
  { value: "IN_TRANSIT_TO_HUB", label: "In Transit to Hub" },
  { value: "AT_HUB", label: "At Hub" },
  { value: "QA_IN_PROGRESS", label: "QA In Progress" },
  { value: "QA_PASSED", label: "QA Passed" },
  { value: "QA_FAILED", label: "QA Failed" },
  { value: "VENDOR_REMEDIATION", label: "Vendor Remediation" },
  { value: "OUT_FOR_DELIVERY", label: "Out for Delivery" },
  { value: "DELIVERED", label: "Delivered" },
  { value: "FAILED_DELIVERY", label: "Failed Delivery" },
  { value: "PAYMENT_RELEASE_PENDING", label: "Payment Release Pending" },
  { value: "PAYMENT_RELEASED", label: "Payment Released" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CANCELLED", label: "Cancelled" },
  { value: "REFUND_INITIATED", label: "Refund Initiated" },
  { value: "DISPUTED", label: "Disputed" },
  { value: "DISPUTE_RESOLVED", label: "Dispute Resolved" },
];

export function OrdersPage() {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  // Which stats chip is selected ("" = none); its statuses drive the list filter below.
  const [group, setGroup] = useState("");
  const [preset, setPreset] = useState<RangePreset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");

  // Lagos-calendar dates from the preset, or the two pickers when "Pick dates" is chosen.
  const range =
    preset === "custom" ? { from: customFrom, to: customTo } : presetRange(preset);

  const params: Record<string, string> = { page: String(page), page_size: "20" };
  if (status) params.status = status;
  if (search) params.search = search;
  if (range.from) params.date_from = range.from;
  if (range.to) params.date_to = range.to;

  const statsParams: Record<string, string> = {};
  if (group) statsParams.group = group;
  if (range.from) statsParams.date_from = range.from;
  if (range.to) statsParams.date_to = range.to;

  const { data: statusCounts } = useOrderStatusCounts({
    ...(range.from ? { date_from: range.from } : {}),
    ...(range.to ? { date_to: range.to } : {}),
  });
  const { data, isLoading, isError, refetch } = useAdminOrders(params);
  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const pages = data ? Math.ceil(data.total / (data.page_size || 20)) : 1;

  const columns: Column<AdminOrder>[] = [
    {
      key: "id",
      header: "Order ID",
      cell: (row) => (
        <span className="font-mono text-xs text-foreground">
          {row.id.slice(0, 12)}…
        </span>
      ),
    },
    {
      key: "customer",
      header: "Customer",
      cell: (row) => (
        <div>
          <p className="text-sm">{row.customer_name ?? `${row.customer_id.slice(0, 8)}…`}</p>
          {row.customer_phone && (
            <a href={`tel:${row.customer_phone}`} className="text-xs text-primary hover:underline">
              {row.customer_phone}
            </a>
          )}
        </div>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      cell: (row) => (
        <div>
          <p className="text-sm">{row.vendor_name ?? `${row.vendor_id.slice(0, 8)}…`}</p>
          {row.vendor_phone && (
            <a href={`tel:${row.vendor_phone}`} className="text-xs text-primary hover:underline">
              {row.vendor_phone}
            </a>
          )}
        </div>
      ),
    },
    {
      key: "rider",
      header: "Rider",
      cell: (row) =>
        row.rider_id ? (
          <div>
            <p className="text-sm">{row.rider_name ?? `${row.rider_id.slice(0, 8)}…`}</p>
            {row.rider_phone && (
              <a href={`tel:${row.rider_phone}`} className="text-xs text-primary hover:underline">
                {row.rider_phone}
              </a>
            )}
          </div>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "hub",
      header: "Hub",
      cell: (row) =>
        row.hub_name ? (
          <span className="text-sm">{row.hub_name}</span>
        ) : (
          <span className="text-sm text-muted-foreground">—</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      cell: (row) => <OrderStatusBadge status={row.status} />,
    },
    {
      key: "amount",
      header: "Amount",
      cell: (row) => (
        <div>
          <span className="font-medium tabular-nums">
            {formatKobo(row.total_kobo + row.delivery_fee_kobo)}
          </span>
          {row.delivery_quote?.method === "flat" && (
            <p className="text-xs text-warning">flat delivery fee</p>
          )}
        </div>
      ),
    },
    {
      key: "created_at",
      header: "Date",
      cell: (row) => (
        <span className="text-sm text-muted-foreground">
          {formatDate(row.created_at)}
        </span>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold text-foreground">Orders</h1>
          <p className="text-sm text-muted-foreground">
            {total} {range.from || range.to || status || search ? "matching" : "total"} orders
          </p>
        </div>
      </div>

      <DateRangeBar
        preset={preset}
        customFrom={customFrom}
        customTo={customTo}
        onPreset={(p) => {
          setPreset(p);
          setPage(1);
        }}
        onCustomFrom={(v) => {
          setCustomFrom(v);
          setPage(1);
        }}
        onCustomTo={(v) => {
          setCustomTo(v);
          setPage(1);
        }}
      />

      <OrderStatsPanel
        params={statsParams}
        group={group}
        onGroupChange={(g, statuses) => {
          setGroup(g);
          setStatus(statuses);
          setPage(1);
        }}
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by order ID…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={status.includes(",") ? "__all__" : status || "__all__"}
          onValueChange={(v) => {
            setStatus(v === "__all__" ? "" : v);
            setGroup("");
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {statusCounts ? `${statusCounts[opt.value === "__all__" ? "__all__" : opt.value] ?? 0} · ` : ""}
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={orders}
          keyExtractor={(row) => row.id}
          loading={isLoading}
          error={isError}
          errorMessage="Couldn't load orders."
          onRetry={() => refetch()}
          emptyMessage="No orders found."
          onRowClick={(row) => router.push(ROUTES.order(row.id))}
        />
        <Pagination
          page={page}
          pages={pages}
          total={total}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
