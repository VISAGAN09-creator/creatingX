import { LoaderCircle, LogOut, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchInventory,
  INVENTORY_SIZES,
  type InventoryProduct,
  type InventorySize,
  saveInventory,
} from '../lib/adminApi';
import { Button } from './ui/button';

type InventoryManagementProps = {
  adminEmail: string | null;
  onSignOut: () => Promise<void>;
  onExit: () => void;
  onOpenOrders: () => void;
};

type Drafts = Record<string, Partial<Record<InventorySize, string>>>;

function draftKey(productId: string, size: InventorySize) {
  return `${productId}\u0000${size}`;
}

function validQuantity(value: string) {
  return /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value));
}

function visibleQuantity(product: InventoryProduct, drafts: Drafts, size: InventorySize) {
  const draft = drafts[product.productId]?.[size];
  return draft === undefined ? product.sizes[size] : draft;
}

export function InventoryManagement({ adminEmail, onSignOut, onExit, onOpenOrders }: InventoryManagementProps) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loadInventory = useCallback(async (signal?: AbortSignal) => {
    const next = await fetchInventory(signal);
    setProducts(next);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    loadInventory(controller.signal)
      .catch((loadError: unknown) => {
        if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load inventory.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [loadInventory, reloadToken]);

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? products.filter((product) => product.name.toLowerCase().includes(query)) : products;
  }, [products, search]);

  const pendingProducts = useMemo(() => {
    return products.filter((product) => Object.entries(drafts[product.productId] ?? {}).some(([size, value]) => {
      const inventorySize = size as InventorySize;
      return value !== String(product.sizes[inventorySize] ?? '');
    }));
  }, [drafts, products]);
  const pendingCount = pendingProducts.length;

  const setDraft = (product: InventoryProduct, size: InventorySize, value: string) => {
    setDrafts((current) => ({
      ...current,
      [product.productId]: { ...current[product.productId], [size]: value },
    }));
    setInvalid((current) => {
      const next = new Set(current);
      const key = draftKey(product.productId, size);
      if (value === '' || !validQuantity(value)) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const resetDrafts = () => {
    setDrafts({});
    setInvalid(new Set());
    setError(null);
    setNotice('Unsaved inventory changes were discarded.');
  };

  const saveChanges = async () => {
    if (saving || pendingCount === 0) return;
    if (invalid.size > 0) {
      setError('Use non-negative whole numbers that are safe integers before saving.');
      return;
    }

    const updates = pendingProducts.flatMap((product) => {
      if (!product.version) return [];
      const changes = Object.fromEntries(
        Object.entries(drafts[product.productId] ?? {})
          .filter(([size, value]) => value !== String(product.sizes[size as InventorySize] ?? ''))
          .map(([size, value]) => [size, Number(value)]),
      ) as Partial<Record<InventorySize, number>>;
      return Object.keys(changes).length ? [{ productId: product.productId, version: product.version, changes }] : [];
    });

    if (updates.length !== pendingCount) {
      setError('One or more products no longer have a valid version. Refresh inventory before saving.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const result = await saveInventory(updates);
      const successful = new Set(result.successful.map((item) => item.productId));
      if (successful.size > 0) {
        setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([productId]) => !successful.has(productId))));
        setInvalid((current) => new Set([...current].filter((key) => !successful.has(key.split('\u0000')[0]))));
      }
      if (result.failed.length > 0) {
        setError(`${result.failed.length} inventory update${result.failed.length === 1 ? '' : 's'} failed. Unsaved values were kept: ${result.failed.map((item) => `${item.productId ?? 'unknown product'} — ${item.message}`).join('; ')}`);
      }
      if (successful.size > 0) {
        setNotice(`${successful.size} product inventory update${successful.size === 1 ? '' : 's'} saved.`);
        setReloadToken((token) => token + 1);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save inventory.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative z-[1] min-h-screen bg-[#111214] px-4 py-5 text-zinc-100 sm:px-7 sm:py-8 lg:px-10">
      <section className="mx-auto w-full max-w-[1500px]">
        <header className="mb-7 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500"><ShieldCheck size={15} aria-hidden="true" /> VARATAAA administration</div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Inventory</h1>
            <p className="mt-2 text-sm text-zinc-400">Edit only the stock fields each product already uses. Changes are checked against the latest product version.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="max-w-[220px] truncate text-zinc-500">{adminEmail || 'Authorized administrator'}</span>
            <button type="button" onClick={onOpenOrders} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">Orders</button>
            <button type="button" onClick={onExit} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">Storefront</button>
            <button type="button" onClick={() => void onSignOut()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white"><LogOut size={15} aria-hidden="true" /> Sign out</button>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="relative block max-w-md flex-1"><span className="sr-only">Search products</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="h-10 w-full rounded-lg border border-white/15 bg-[#1a1b1f] pl-9 pr-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-white/45" /></label>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setReloadToken((token) => token + 1)} disabled={loading || saving || pendingCount > 0} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh</button>
            <Button type="button" variant="outline" onClick={resetDrafts} disabled={pendingCount === 0 || saving} className="border-white/20 bg-transparent text-zinc-100 hover:bg-white/10 hover:text-white">Cancel changes</Button>
            <Button type="button" onClick={() => void saveChanges()} disabled={pendingCount === 0 || saving} className="bg-white text-black hover:bg-zinc-200">{saving && <LoaderCircle className="mr-2 animate-spin" size={15} aria-hidden="true" />}{saving ? 'Saving' : `Save${pendingCount ? ` (${pendingCount})` : ''}`}</Button>
          </div>
        </div>

        <div aria-live="polite" className="mb-4 space-y-2">
          {notice && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}
          {pendingCount > 0 && <p className="text-sm text-amber-200">{pendingCount} product{pendingCount === 1 ? '' : 's'} with unsaved stock changes.</p>}
        </div>

        <div className="overflow-hidden rounded-xl border border-white/10 bg-[#17181b] shadow-2xl shadow-black/20"><div className="overflow-x-auto"><table className="w-full min-w-[1240px] border-collapse text-left text-sm"><thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase tracking-[0.12em] text-zinc-500"><tr><th className="sticky left-0 z-10 min-w-60 bg-[#1a1b1f] px-5 py-4 font-medium">Product name</th>{INVENTORY_SIZES.map((size) => <th key={size} className="w-20 px-2 py-4 text-center font-medium">{size}</th>)}<th className="px-5 py-4 text-right font-medium">Total stock</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={10} className="px-5 py-14 text-center text-zinc-400"><LoaderCircle className="mx-auto mb-3 animate-spin" size={20} aria-hidden="true" />Loading inventory…</td></tr> : filteredProducts.length === 0 ? <tr><td colSpan={10} className="px-5 py-14 text-center text-zinc-400">{products.length === 0 ? 'No products were found in the configured collections.' : 'No products match your search.'}</td></tr> : filteredProducts.map((product) => {
            const total = INVENTORY_SIZES.reduce((sum, size) => { const value = visibleQuantity(product, drafts, size); return sum + (typeof value === 'string' && validQuantity(value) ? Number(value) : typeof value === 'number' ? value : 0); }, 0);
            const hasDraft = Boolean(drafts[product.productId] && Object.entries(drafts[product.productId]).some(([size, value]) => value !== String(product.sizes[size as InventorySize] ?? '')));
            return <tr key={product.productId} className={`border-b border-white/[0.07] ${hasDraft ? 'bg-amber-300/[0.045]' : 'hover:bg-white/[0.025]'}`}><td className="sticky left-0 z-[1] bg-[#17181b] px-5 py-4 align-top"><p className="font-medium text-zinc-100">{product.name}</p><p className="mt-1 text-xs text-zinc-500">{product.collectionName}{!product.editable && ' · stock field needs migration'}</p>{hasDraft && <p className="mt-1 text-xs text-amber-200">Unsaved change</p>}</td>{INVENTORY_SIZES.map((size) => { const saved = product.sizes[size]; const value = visibleQuantity(product, drafts, size); const inputInvalid = invalid.has(draftKey(product.productId, size)); const changed = value !== saved && value !== String(saved ?? ''); return <td key={size} className="px-2 py-3 text-center">{saved === null ? <span className="text-zinc-600" title="Size not configured">—</span> : <input aria-label={`${product.name}, ${size} stock`} value={value ?? ''} onChange={(event) => setDraft(product, size, event.target.value)} disabled={saving || !product.editable} inputMode="numeric" className={`h-9 w-16 rounded-md border bg-[#111214] px-2 text-center text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${inputInvalid ? 'border-red-400' : changed ? 'border-amber-300 bg-amber-300/10' : saved === 0 ? 'border-red-400/40 text-red-200' : 'border-white/15 focus:border-white/50'}`} />}</td>; })}<td className="px-5 py-4 text-right font-semibold text-zinc-100">{total}</td></tr>;
          })}</tbody></table></div></div>
      </section>
    </main>
  );
}
