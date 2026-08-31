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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const params: Record<string, string> = { page: String(page), limit: "20" };
  if (status) params.status = status;
  if (search) params.search = search;
  if (dateFrom) params.date_from = dateFrom;
  if (dateTo) params.date_to = dateTo;

  const { data, isLoading } = useAdminOrders(params);
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
        <span className="font-mono text-xs text-muted-foreground">
          {row.customer_id.slice(0, 8)}…
        </span>
      ),
    },
    {
      key: "vendor",
      header: "Vendor",
      cell: (row) => (
        <span className="font-mono text-xs text-muted-foreground">
          {row.vendor_id.slice(0, 8)}…
        </span>
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
        <span className="font-medium tabular-nums">
          {formatKobo(row.total_kobo)}
        </span>
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
          <p className="text-sm text-muted-foreground">{total} total orders</p>
        </div>
      </div>

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
          value={status || "__all__"}
          onValueChange={(v) => {
            setStatus(v === "__all__" ? "" : v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-52">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            {STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => {
            setDateFrom(e.target.value);
            setPage(1);
          }}
          className="w-40"
          placeholder="From"
        />
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => {
            setDateTo(e.target.value);
            setPage(1);
          }}
          className="w-40"
          placeholder="To"
        />
      </div>

      <div className="rounded-lg border border-border bg-background shadow-card">
        <DataTable
          columns={columns}
          data={orders}
          keyExtractor={(row) => row.id}
          loading={isLoading}
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
