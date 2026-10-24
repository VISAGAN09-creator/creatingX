import { ChevronDown, ChevronUp, LoaderCircle, LogOut, Pencil, RefreshCw, ShieldCheck } from 'lucide-react';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  type AdminOrder,
  type FulfillmentStatus,
  fetchAdminOrders,
  saveFulfillmentStatuses,
} from '../lib/adminApi';
import { cn } from '../lib/utils';
import { formatPrice } from '../utils/format';
import { Button } from './ui/button';

type AdminOrdersProps = {
  adminEmail: string | null;
  onSignOut: () => Promise<void>;
  onExit: () => void;
  onOpenInventory: () => void;
};

const statusLabels: Record<FulfillmentStatus, string> = {
  production: 'Production',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
};

const statuses = Object.keys(statusLabels) as FulfillmentStatus[];

function customerName(order: AdminOrder) {
  const name = [order.customer.firstName, order.customer.lastName].filter(Boolean).join(' ').trim();
  return name || order.customer.email || 'Customer details unavailable';
}

function initials(name: string) {
  const letters = name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('');
  return letters ? letters.toUpperCase() : '?';
}

function formatOrderDate(value: string | null) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date unavailable' : new Intl.DateTimeFormat('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  }).format(date);
}

function itemSummary(order: AdminOrder) {
  if (order.items.length === 0) return 'Items unavailable';
  const first = order.items[0];
  const firstName = first.name || 'Unnamed item';
  return order.items.length === 1 ? `${firstName} × ${first.quantity ?? 1}` : `${firstName} + ${order.items.length - 1} more`;
}

function statusClass(status: FulfillmentStatus) {
  if (status === 'delivered') return 'border-emerald-400/40 bg-emerald-400/10 text-emerald-200';
  if (status === 'out_for_delivery') return 'border-sky-400/40 bg-sky-400/10 text-sky-200';
  return 'border-amber-400/40 bg-amber-400/10 text-amber-100';
}

export function AdminOrders({ adminEmail, onSignOut, onExit, onOpenInventory }: AdminOrdersProps) {
  const [filter, setFilter] = useState<FulfillmentStatus>('production');
  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [pending, setPending] = useState<Record<string, FulfillmentStatus>>({});
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetchAdminOrders(filter, controller.signal)
      .then((nextOrders) => setOrders(nextOrders))
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setOrders([]);
        setError(requestError instanceof Error ? requestError.message : 'Unable to load orders.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [filter, refreshKey]);

  const pendingCount = Object.keys(pending).length;
  const visiblePendingCount = useMemo(
    () => orders.filter((order) => pending[order.orderId]).length,
    [orders, pending],
  );

  const setPendingStatus = useCallback((order: AdminOrder, nextStatus: FulfillmentStatus) => {
    setPending((current) => {
      const next = { ...current };
      if (nextStatus === order.fulfillmentStatus) delete next[order.orderId];
      else next[order.orderId] = nextStatus;
      return next;
    });
  }, []);

  const saveChanges = async () => {
    const updates = Object.entries(pending).map(([orderId, fulfillmentStatus]) => ({ orderId, fulfillmentStatus }));
    if (updates.length === 0 || saving) return;

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveFulfillmentStatuses(updates);
      const completedIds = new Set(result.successful.map((update) => update.orderId));
      if (completedIds.size > 0) {
        setPending((current) => {
          const next = { ...current };
          completedIds.forEach((orderId) => delete next[orderId]);
          return next;
        });
      }

      if (result.failed.length > 0) {
        setError(`${result.failed.length} status update${result.failed.length === 1 ? '' : 's'} failed. Pending changes were kept: ${result.failed.map((failure) => `${failure.orderId || 'unknown order'} — ${failure.message}`).join('; ')}`);
      }
      if (result.successful.length > 0) {
        setNotice(`${result.successful.length} fulfillment status update${result.successful.length === 1 ? '' : 's'} saved.`);
        setRefreshKey((key) => key + 1);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save fulfillment statuses.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative z-[1] min-h-screen bg-[#111214] px-4 py-5 text-zinc-100 sm:px-7 sm:py-8 lg:px-10">
      <section className="mx-auto w-full max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
              <ShieldCheck size={15} aria-hidden="true" /> VARATAAA administration
            </div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Orders</h1>
            <p className="mt-2 text-sm text-zinc-400">Manage fulfillment without changing verified payment records.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="max-w-[220px] truncate text-zinc-500">{adminEmail || 'Authorized administrator'}</span>
            <button type="button" onClick={onOpenInventory} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">Inventory</button>
            <button type="button" onClick={onExit} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">Storefront</button>
            <button type="button" onClick={() => void onSignOut()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">
              <LogOut size={15} aria-hidden="true" /> Sign out
            </button>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-3 text-sm font-medium text-zinc-300">
            Fulfillment status
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as FulfillmentStatus);
                setEditingOrderId(null);
                setExpandedOrderId(null);
              }}
              disabled={saving}
              className="min-h-10 rounded-lg border border-white/15 bg-[#1a1b1f] px-3 text-sm text-white outline-none transition focus:border-white/50 focus:ring-2 focus:ring-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading || saving}
            className="inline-flex items-center justify-center gap-2 self-start rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 sm:self-auto"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh
          </button>
        </div>

        <div aria-live="polite" className="mb-4 space-y-2">
          {notice && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}
          {pendingCount > 0 && <p className="text-sm text-amber-200">{pendingCount} unsaved change{pendingCount === 1 ? '' : 's'}{visiblePendingCount !== pendingCount ? ' across filtered orders' : ''}.</p>}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#17181b] shadow-2xl shadow-black/20">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1110px] border-collapse text-left text-sm">
              <thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase tracking-[0.12em] text-zinc-500">
                <tr>
                  <th className="px-5 py-4 font-medium">Order</th>
                  <th className="px-5 py-4 font-medium">Customer</th>
                  <th className="px-5 py-4 font-medium">Items</th>
                  <th className="px-5 py-4 font-medium">Total</th>
                  <th className="px-5 py-4 font-medium">Payment</th>
                  <th className="px-5 py-3 font-medium">
                    <div className="flex items-center justify-between gap-3">
                      <span>Date</span>
                      <Button
                        type="button"
                        size="default"
                        onClick={() => void saveChanges()}
                        disabled={pendingCount === 0 || saving}
                        className="h-8 bg-white px-3 text-xs text-black hover:bg-zinc-200"
                      >
                        {saving && <LoaderCircle className="mr-1.5 animate-spin" size={13} aria-hidden="true" />}
                        {saving ? 'Saving' : `Save${pendingCount ? ` (${pendingCount})` : ''}`}
                      </Button>
                    </div>
                  </th>
                  <th className="w-12 px-2 py-4" aria-label="Edit fulfillment status" />
                  <th className="px-5 py-4 font-medium">Fulfillment</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-14 text-center text-zinc-400"><LoaderCircle className="mx-auto mb-3 animate-spin" size={20} aria-hidden="true" />Loading {statusLabels[filter].toLowerCase()} orders…</td></tr>
                ) : orders.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-14 text-center text-zinc-400">No orders are currently in {statusLabels[filter].toLowerCase()}.</td></tr>
                ) : orders.map((order) => {
                  const proposedStatus = pending[order.orderId] || order.fulfillmentStatus;
                  const isEditing = editingOrderId === order.orderId;
                  const isExpanded = expandedOrderId === order.orderId;
                  const customer = customerName(order);
                  return (
                    <Fragment key={order.orderId}>
                      <tr className={cn('border-b border-white/[0.07] transition-colors hover:bg-white/[0.025]', pending[order.orderId] && 'bg-amber-300/[0.045]')}>
                        <td className="px-5 py-4 align-top"><span className="font-mono text-xs text-zinc-300">{order.orderId}</span></td>
                        <td className="px-5 py-4 align-top">
                          <div className="flex items-center gap-3">
                            <span className="grid size-9 shrink-0 place-items-center rounded-full border border-white/15 bg-zinc-800 text-xs font-semibold text-zinc-200">{initials(customer)}</span>
                            <div className="min-w-0"><p className="truncate font-medium text-zinc-100">{customer}</p><p className="mt-0.5 truncate text-xs text-zinc-500">{order.customer.email || order.customer.phone || 'Contact unavailable'}</p></div>
                          </div>
                        </td>
                        <td className="px-5 py-4 align-top">
                          <button type="button" onClick={() => setExpandedOrderId(isExpanded ? null : order.orderId)} className="inline-flex max-w-[205px] items-center gap-1.5 text-left text-zinc-300 transition hover:text-white">
                            <span className="truncate">{itemSummary(order)}</span>{isExpanded ? <ChevronUp size={15} aria-hidden="true" /> : <ChevronDown size={15} aria-hidden="true" />}
                          </button>
                        </td>
                        <td className="px-5 py-4 align-top font-medium text-zinc-100">{formatPrice(order.pricing.total)}</td>
                        <td className="px-5 py-4 align-top"><p className="capitalize text-zinc-200">{order.payment.gateway || '—'}</p><p className="mt-1 text-xs text-zinc-500">{order.paymentStatus || '—'}</p></td>
                        <td className="px-5 py-4 align-top whitespace-nowrap text-zinc-300">{formatOrderDate(order.createdAt)}</td>
                        <td className="px-2 py-4 align-top">
                          <button type="button" onClick={() => setEditingOrderId(isEditing ? null : order.orderId)} aria-label={`Edit fulfillment status for order ${order.orderId}`} aria-expanded={isEditing} className="grid size-9 place-items-center rounded-lg border border-white/15 text-zinc-300 transition hover:border-white/40 hover:bg-white/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-white/30">
                            <Pencil size={15} aria-hidden="true" />
                          </button>
                        </td>
                        <td className="px-5 py-4 align-top">
                          {isEditing ? (
                            <label className="block"><span className="sr-only">Fulfillment status for {order.orderId}</span><select value={proposedStatus} onChange={(event) => setPendingStatus(order, event.target.value as FulfillmentStatus)} disabled={saving} className="min-h-9 rounded-md border border-white/20 bg-[#111214] px-2 text-sm text-white outline-none focus:border-white/50 disabled:opacity-50">{statuses.map((status) => <option key={status} value={status}>{statusLabels[status]}</option>)}</select></label>
                          ) : <div><span className={cn('inline-flex rounded-full border px-2.5 py-1 text-xs font-medium', statusClass(proposedStatus))}>{statusLabels[proposedStatus]}</span>{pending[order.orderId] && <p className="mt-1.5 text-xs text-amber-200">Unsaved change</p>}</div>}
                        </td>
                      </tr>
                      {isExpanded && <tr className="border-b border-white/[0.07] bg-black/20"><td colSpan={8} className="px-5 py-5"><div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]"><div><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Complete order items</h2><ul className="space-y-2">{order.items.map((item, index) => <li key={`${item.id || item.name || 'item'}-${index}`} className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.025] px-3 py-2.5 text-sm"><span className="min-w-0 text-zinc-200"><span className="block truncate">{item.name || 'Unnamed item'} <span className="text-zinc-500">× {item.quantity ?? 1}</span></span>{(item.size || item.color) && <span className="mt-1 block text-xs text-zinc-500">{[item.size && `Size: ${item.size}`, item.color && `Color: ${item.color}`].filter(Boolean).join(' · ')}</span>}</span><span className="whitespace-nowrap text-zinc-400">{formatPrice(item.price)}</span></li>)}</ul></div><div><h2 className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-zinc-500">Delivery details</h2><p className="text-sm leading-6 text-zinc-300">{[order.shipping.address, order.shipping.apartment, order.shipping.city, order.shipping.state, order.shipping.pinCode, order.shipping.country].filter(Boolean).join(', ') || 'Delivery details unavailable'}</p>{order.customer.phone && <p className="mt-2 text-sm text-zinc-400">{order.customer.phone}</p>}</div></div></td></tr>}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
