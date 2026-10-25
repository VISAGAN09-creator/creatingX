import { LoaderCircle, LogOut, RefreshCw, Search, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchInventory,
  INVENTORY_SIZES,
  type InventoryProduct,
  type InventorySize,
  saveInventory,
} from '../lib/adminApi';
import { SmartImage } from './SmartImage';
import { Button } from './ui/button';

type InventoryDrafts = Record<string, Partial<Record<InventorySize, string>>>;
type MetadataDraft = Partial<{ name: string; price: string; latest: boolean; hero: boolean; couple: boolean }>;
type MetadataDrafts = Record<string, MetadataDraft>;

function draftKey(productId: string, field: string) {
  return `${productId}\u0000${field}`;
}

function validQuantity(value: string) {
  return /^(0|[1-9]\d*)$/.test(value) && Number.isSafeInteger(Number(value));
}

function validPrice(value: string) {
  if (!value.trim()) return false;
  const price = Number(value);
  return Number.isFinite(price) && price >= 0;
}

/**
 * Keeps stock fields numeric: digits only, no sign or decimal point, and no
 * leading zeros (so "007" cannot fail the stricter validQuantity check).
 */
function quantityInputValue(raw: string) {
  return raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

/** Keeps the price field numeric: digits and at most one decimal point. */
function priceInputValue(raw: string) {
  const digitsAndDots = raw.replace(/[^\d.]/g, '');
  const [whole, ...decimalParts] = digitsAndDots.split('.');
  return decimalParts.length > 0 ? `${whole}.${decimalParts.join('')}` : whole;
}

function visibleQuantity(product: InventoryProduct, drafts: InventoryDrafts, size: InventorySize) {
  const draft = drafts[product.productId]?.[size];
  return draft === undefined ? product.sizes[size] : draft;
}

function metadataHasChanges(product: InventoryProduct, drafts: MetadataDrafts) {
  const draft = drafts[product.productId];
  if (!draft) return false;
  if (draft.name !== undefined && draft.name.trim() !== product.name) return true;
  if (draft.price !== undefined && (!validPrice(draft.price) || Number(draft.price) !== product.price)) return true;
  return ['latest', 'hero', 'couple'].some((field) => {
    const flag = field as 'latest' | 'hero' | 'couple';
    return draft[flag] !== undefined && draft[flag] !== product.flags[flag];
  });
}

function metadataPayload(product: InventoryProduct, drafts: MetadataDrafts) {
  const draft = drafts[product.productId] ?? {};
  const metadata: Partial<{ name: string; price: number; latest: boolean; hero: boolean; couple: boolean }> = {};
  if (draft.name !== undefined && draft.name.trim() !== product.name) metadata.name = draft.name.trim().replace(/\s+/g, ' ');
  if (draft.price !== undefined && validPrice(draft.price) && Number(draft.price) !== product.price) metadata.price = Number(draft.price);
  for (const field of ['latest', 'hero', 'couple'] as const) {
    if (draft[field] !== undefined && draft[field] !== product.flags[field]) metadata[field] = draft[field];
  }
  return metadata;
}

type SetMetadataDraft = <Field extends keyof MetadataDraft>(
  product: InventoryProduct,
  field: Field,
  value: MetadataDraft[Field],
) => void;

function InventoryMobileCard({
  product,
  inventoryDrafts,
  metadataDrafts,
  invalid,
  saving,
  hasDraft,
  onInventoryDraft,
  onMetadataDraft,
}: {
  product: InventoryProduct;
  inventoryDrafts: InventoryDrafts;
  metadataDrafts: MetadataDrafts;
  invalid: Set<string>;
  saving: boolean;
  hasDraft: boolean;
  onInventoryDraft: (product: InventoryProduct, size: InventorySize, value: string) => void;
  onMetadataDraft: SetMetadataDraft;
}) {
  const metadata = metadataDrafts[product.productId] ?? {};
  const displayName = metadata.name ?? product.name;
  const displayPrice = metadata.price ?? (product.price === null ? '' : String(product.price));
  const total = INVENTORY_SIZES.reduce((sum, size) => {
    const value = visibleQuantity(product, inventoryDrafts, size);
    return sum + (typeof value === 'string' && validQuantity(value) ? Number(value) : typeof value === 'number' ? value : 0);
  }, 0);

  return (
    <article className={`rounded-xl border p-4 shadow-lg shadow-black/10 ${hasDraft ? 'border-amber-300/50 bg-amber-300/[0.045]' : 'border-white/10 bg-[#17181b]'}`}>
      <div className="flex min-w-0 gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-black/30">
          <SmartImage src={product.image} alt={product.name} fallbackLabel="No image" className="h-full w-full object-cover text-[9px]" />
        </div>
        <div className="min-w-0 flex-1">
          <label className="sr-only" htmlFor={`${product.productId}-name`}>Product name</label>
          <textarea
            id={`${product.productId}-name`}
            value={displayName}
            onChange={(event) => onMetadataDraft(product, 'name', event.target.value)}
            disabled={saving || !product.nameField}
            rows={2}
            className={`w-full resize-none rounded-md border bg-[#111214] px-2.5 py-2 text-sm font-medium leading-5 text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${invalid.has(draftKey(product.productId, 'name')) ? 'border-red-400' : 'border-white/15 focus:border-white/50'}`}
          />
          <p className="mt-1.5 break-words text-xs text-zinc-500">
            {product.collectionName}{!product.nameField && ' · name field needs migration'}{!product.editable && ' · stock field needs migration'}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5 text-xs font-medium uppercase tracking-[0.1em] text-zinc-400" htmlFor={`${product.productId}-price`}>
          Price
          <input
            id={`${product.productId}-price`}
            aria-label={`${product.name} price`}
            value={displayPrice}
            onChange={(event) => onMetadataDraft(product, 'price', event.target.value)}
            disabled={saving}
            inputMode="decimal"
            className={`min-h-11 w-full rounded-md border bg-[#111214] px-3 text-right text-base text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${invalid.has(draftKey(product.productId, 'price')) ? 'border-red-400' : 'border-white/15 focus:border-white/50'}`}
          />
        </label>

        <div className="grid grid-cols-3 gap-2">
          {(['latest', 'hero', 'couple'] as const).map((field) => {
            const value = metadata[field] ?? product.flags[field];
            const label = field === 'couple' ? 'Couple T-shirt' : field[0].toUpperCase() + field.slice(1);
            return (
              <label key={field} className="grid min-w-0 gap-1.5 text-xs font-medium uppercase tracking-[0.08em] text-zinc-400">
                <span className="truncate" title={label}>{label}</span>
                <select
                  aria-label={`${product.name} ${label}`}
                  value={value ? 'yes' : 'no'}
                  onChange={(event) => onMetadataDraft(product, field, event.target.value === 'yes')}
                  disabled={saving}
                  className="min-h-11 w-full rounded-md border border-white/15 bg-[#111214] px-2 text-sm text-white outline-none focus:border-white/50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </label>
            );
          })}
        </div>
      </div>

      <details open className="mt-4 rounded-lg border border-white/10 bg-black/15">
        <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-3 px-3 text-sm font-medium text-zinc-200">
          <span>Inventory by size</span>
          <span className="whitespace-nowrap text-xs text-zinc-400">Total stock: {total}</span>
        </summary>
        <div className="grid grid-cols-2 gap-2 border-t border-white/10 p-3 sm:grid-cols-4">
          {INVENTORY_SIZES.map((size) => {
            const saved = product.sizes[size];
            const value = visibleQuantity(product, inventoryDrafts, size);
            const inputInvalid = invalid.has(draftKey(product.productId, size));
            const changed = value !== saved && value !== String(saved ?? '');
            return (
              <label key={size} className="grid gap-1 text-xs font-medium text-zinc-400">
                {size}
                {saved === null ? (
                  <span className="flex min-h-11 items-center justify-center rounded-md border border-white/10 bg-[#111214] text-zinc-600" title="Size not configured">—</span>
                ) : (
                  <input
                    aria-label={`${product.name}, ${size} stock`}
                    value={value ?? ''}
                    onChange={(event) => onInventoryDraft(product, size, event.target.value)}
                    disabled={saving || !product.editable}
                    inputMode="numeric"
                    className={`min-h-11 w-full rounded-md border bg-[#111214] px-2 text-center text-base text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${inputInvalid ? 'border-red-400' : changed ? 'border-amber-300 bg-amber-300/10' : saved === 0 ? 'border-red-400/40 text-red-200' : 'border-white/15 focus:border-white/50'}`}
                  />
                )}
              </label>
            );
          })}
        </div>
      </details>

      {hasDraft && <p className="mt-3 text-sm text-amber-200">Unsaved changes for this product.</p>}
    </article>
  );
}

export function InventoryManagement({ adminEmail, onSignOut, onExit, onOpenOrders }: {
  adminEmail: string | null;
  onSignOut: () => Promise<void>;
  onExit: () => void;
  onOpenOrders: () => void;
}) {
  const [products, setProducts] = useState<InventoryProduct[]>([]);
  const [inventoryDrafts, setInventoryDrafts] = useState<InventoryDrafts>({});
  const [metadataDrafts, setMetadataDrafts] = useState<MetadataDrafts>({});
  const [invalid, setInvalid] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [collection, setCollection] = useState('');
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

  const collections = useMemo(
    () => [...new Set(products.map((product) => product.collectionName))].sort((a, b) => a.localeCompare(b)),
    [products],
  );

  const filteredProducts = useMemo(() => {
    const query = search.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCollection = !collection || product.collectionName === collection;
      const matchesSearch = !query || product.name.toLowerCase().includes(query);
      return matchesCollection && matchesSearch;
    });
  }, [collection, products, search]);

  const pendingProducts = useMemo(() => products.filter((product) => {
    const inventoryChanged = Object.entries(inventoryDrafts[product.productId] ?? {}).some(([size, value]) => value !== String(product.sizes[size as InventorySize] ?? ''));
    return inventoryChanged || metadataHasChanges(product, metadataDrafts);
  }), [inventoryDrafts, metadataDrafts, products]);
  const pendingCount = pendingProducts.length;

  const setInvalidState = (key: string, isInvalid: boolean) => {
    setInvalid((current) => {
      const next = new Set(current);
      if (isInvalid) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  const setInventoryDraft = (product: InventoryProduct, size: InventorySize, value: string) => {
    const nextValue = quantityInputValue(value);
    setInventoryDrafts((current) => ({
      ...current,
      [product.productId]: { ...current[product.productId], [size]: nextValue },
    }));
    setInvalidState(draftKey(product.productId, size), nextValue === '' || !validQuantity(nextValue));
  };

  const setMetadataDraft = <Field extends keyof MetadataDraft>(product: InventoryProduct, field: Field, value: MetadataDraft[Field]) => {
    const nextValue = (field === 'price' ? priceInputValue(String(value ?? '')) : value) as MetadataDraft[Field];
    setMetadataDrafts((current) => ({
      ...current,
      [product.productId]: { ...current[product.productId], [field]: nextValue },
    }));
    if (field === 'name') setInvalidState(draftKey(product.productId, field), !String(nextValue).trim());
    if (field === 'price') setInvalidState(draftKey(product.productId, field), !validPrice(String(nextValue)));
  };

  const resetDrafts = () => {
    setInventoryDrafts({});
    setMetadataDrafts({});
    setInvalid(new Set());
    setError(null);
    setNotice('Unsaved inventory changes were discarded.');
  };

  const saveChanges = async () => {
    if (saving || pendingCount === 0) return;
    if (invalid.size > 0) {
      setError('Enter a product name, a valid non-negative price, and non-negative whole-number stock quantities before saving.');
      return;
    }

    const updates = pendingProducts.flatMap((product) => {
      if (!product.version) return [];
      const changes = Object.fromEntries(
        Object.entries(inventoryDrafts[product.productId] ?? {})
          .filter(([size, value]) => value !== String(product.sizes[size as InventorySize] ?? ''))
          .map(([size, value]) => [size, Number(value)]),
      ) as Partial<Record<InventorySize, number>>;
      const metadata = metadataPayload(product, metadataDrafts);
      return Object.keys(changes).length || Object.keys(metadata).length
        ? [{ productId: product.productId, version: product.version, ...(Object.keys(changes).length ? { changes } : {}), ...(Object.keys(metadata).length ? { metadata } : {}) }]
        : [];
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
        setInventoryDrafts((current) => Object.fromEntries(Object.entries(current).filter(([productId]) => !successful.has(productId))));
        setMetadataDrafts((current) => Object.fromEntries(Object.entries(current).filter(([productId]) => !successful.has(productId))));
        setInvalid((current) => new Set([...current].filter((key) => !successful.has(key.split('\u0000')[0]))));
      }
      if (result.failed.length > 0) {
        setError(`${result.failed.length} product update${result.failed.length === 1 ? '' : 's'} failed. Unsaved values were kept: ${result.failed.map((item) => `${item.productId ?? 'unknown product'} — ${item.message}`).join('; ')}`);
      }
      if (successful.size > 0) {
        setNotice(`${successful.size} product update${successful.size === 1 ? '' : 's'} saved.`);
        setReloadToken((token) => token + 1);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save inventory.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="relative z-[1] min-h-screen overflow-x-hidden bg-[#111214] px-4 py-5 text-zinc-100 sm:px-7 sm:py-8 lg:px-10">
      <section className="mx-auto w-full max-w-[1900px]">
        <header className="mb-7 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500"><ShieldCheck size={15} aria-hidden="true" /> VARATAAA administration</div>
            <h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Inventory</h1>
            <p className="mt-2 text-sm text-zinc-400">Edit product details and stock together. Every save checks the latest product version.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="max-w-[220px] truncate text-zinc-500">{adminEmail || 'Authorized administrator'}</span>
            <button type="button" onClick={onOpenOrders} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">Orders</button>
            <button type="button" onClick={onExit} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white">Storefront</button>
            <button type="button" onClick={() => void onSignOut()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-zinc-300 transition hover:border-white/35 hover:text-white"><LogOut size={15} aria-hidden="true" /> Sign out</button>
          </div>
        </header>

        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <label className="sr-only" htmlFor="inventory-collection">Collection</label>
            <select id="inventory-collection" value={collection} onChange={(event) => setCollection(event.target.value)} className="min-h-11 w-full rounded-lg border border-white/15 bg-[#1a1b1f] px-3 text-sm text-white outline-none focus:border-white/45 sm:w-auto">
              <option value="">All Collections</option>
              {collections.map((collectionName) => <option key={collectionName} value={collectionName}>{collectionName}</option>)}
            </select>
            <label className="relative block w-full max-w-md sm:w-80"><span className="sr-only">Search products</span><Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={16} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search products" className="min-h-11 w-full rounded-lg border border-white/15 bg-[#1a1b1f] pl-9 pr-3 text-base text-white outline-none placeholder:text-zinc-500 focus:border-white/45" /></label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setReloadToken((token) => token + 1)} disabled={loading || saving || pendingCount > 0} className="inline-flex min-h-11 items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition hover:bg-white/5 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"><RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden="true" /> Refresh</button>
            <Button type="button" variant="outline" onClick={resetDrafts} disabled={pendingCount === 0 || saving} className="min-h-11 border-white/20 bg-transparent text-zinc-100 hover:bg-white/10 hover:text-white">Cancel changes</Button>
            <Button type="button" onClick={() => void saveChanges()} disabled={pendingCount === 0 || saving} className="min-h-11 bg-white text-black hover:bg-zinc-200">{saving && <LoaderCircle className="mr-2 animate-spin" size={15} aria-hidden="true" />}{saving ? 'Saving' : `Save${pendingCount ? ` (${pendingCount})` : ''}`}</Button>
          </div>
        </div>

        <div aria-live="polite" className="mb-4 space-y-2">
          {notice && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}
          {error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}
          {pendingCount > 0 && <p className="text-sm text-amber-200">{pendingCount} product{pendingCount === 1 ? '' : 's'} with unsaved changes.</p>}
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-white/10 bg-[#17181b] shadow-2xl shadow-black/20 lg:block"><div className="overflow-x-auto"><table className="w-full min-w-[1720px] border-collapse text-left text-sm"><thead className="border-b border-white/10 bg-white/[0.025] text-xs uppercase tracking-[0.12em] text-zinc-500"><tr><th className="sticky left-0 z-10 min-w-[290px] bg-[#1a1b1f] px-5 py-4 font-medium">Product</th><th className="min-w-28 px-3 py-4 text-center font-medium">Price</th><th className="min-w-24 px-3 py-4 text-center font-medium">Latest</th><th className="min-w-24 px-3 py-4 text-center font-medium">Hero</th><th className="min-w-28 px-3 py-4 text-center font-medium">Couple T-shirt</th>{INVENTORY_SIZES.map((size) => <th key={size} className="w-20 px-2 py-4 text-center font-medium">{size}</th>)}<th className="px-5 py-4 text-right font-medium">Total stock</th></tr></thead><tbody>
          {loading ? <tr><td colSpan={14} className="px-5 py-14 text-center text-zinc-400"><LoaderCircle className="mx-auto mb-3 animate-spin" size={20} aria-hidden="true" />Loading inventory…</td></tr> : filteredProducts.length === 0 ? <tr><td colSpan={14} className="px-5 py-14 text-center text-zinc-400">{products.length === 0 ? 'No products were found in the configured collections.' : 'No products match the current collection and search.'}</td></tr> : filteredProducts.map((product) => {
            const total = INVENTORY_SIZES.reduce((sum, size) => { const value = visibleQuantity(product, inventoryDrafts, size); return sum + (typeof value === 'string' && validQuantity(value) ? Number(value) : typeof value === 'number' ? value : 0); }, 0);
            const hasDraft = pendingProducts.some((pendingProduct) => pendingProduct.productId === product.productId);
            const metadata = metadataDrafts[product.productId] ?? {};
            const displayName = metadata.name ?? product.name;
            const displayPrice = metadata.price ?? (product.price === null ? '' : String(product.price));
            return <tr key={product.productId} className={`border-b border-white/[0.07] ${hasDraft ? 'bg-amber-300/[0.045]' : 'hover:bg-white/[0.025]'}`}><td className="sticky left-0 z-[1] bg-[#17181b] px-5 py-3 align-top"><div className="flex min-w-0 gap-3"><div className="h-12 w-12 shrink-0 overflow-hidden rounded-md bg-black/30"><SmartImage src={product.image} alt={product.name} fallbackLabel="No image" className="h-full w-full object-cover text-[8px]" /></div><div className="min-w-0 flex-1"><input aria-label={`${product.name} product name`} value={displayName} onChange={(event) => setMetadataDraft(product, 'name', event.target.value)} disabled={saving || !product.nameField} className={`h-9 w-full rounded-md border bg-[#111214] px-2.5 text-sm font-medium text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${invalid.has(draftKey(product.productId, 'name')) ? 'border-red-400' : 'border-white/15 focus:border-white/50'}`} /><p className="mt-1 text-xs text-zinc-500">{product.collectionName}{!product.nameField && ' · name field needs migration'}{!product.editable && ' · stock field needs migration'}</p>{hasDraft && <p className="mt-1 text-xs text-amber-200">Unsaved change</p>}</div></div></td><td className="px-3 py-3 align-top"><input aria-label={`${product.name} price`} value={displayPrice} onChange={(event) => setMetadataDraft(product, 'price', event.target.value)} disabled={saving} inputMode="decimal" className={`h-9 w-full rounded-md border bg-[#111214] px-2 text-right text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${invalid.has(draftKey(product.productId, 'price')) ? 'border-red-400' : 'border-white/15 focus:border-white/50'}`} /></td>{(['latest', 'hero', 'couple'] as const).map((field) => { const value = metadata[field] ?? product.flags[field]; return <td key={field} className="px-3 py-3 align-top"><select aria-label={`${product.name} ${field}`} value={value ? 'yes' : 'no'} onChange={(event) => setMetadataDraft(product, field, event.target.value === 'yes')} disabled={saving} className="h-9 w-full rounded-md border border-white/15 bg-[#111214] px-2 text-sm text-white outline-none focus:border-white/50 disabled:cursor-not-allowed disabled:opacity-50"><option value="yes">Yes</option><option value="no">No</option></select></td>; })}{INVENTORY_SIZES.map((size) => { const saved = product.sizes[size]; const value = visibleQuantity(product, inventoryDrafts, size); const inputInvalid = invalid.has(draftKey(product.productId, size)); const changed = value !== saved && value !== String(saved ?? ''); return <td key={size} className="px-2 py-3 text-center">{saved === null ? <span className="text-zinc-600" title="Size not configured">—</span> : <input aria-label={`${product.name}, ${size} stock`} value={value ?? ''} onChange={(event) => setInventoryDraft(product, size, event.target.value)} disabled={saving || !product.editable} inputMode="numeric" className={`h-9 w-16 rounded-md border bg-[#111214] px-2 text-center text-sm text-white outline-none disabled:cursor-not-allowed disabled:opacity-50 ${inputInvalid ? 'border-red-400' : changed ? 'border-amber-300 bg-amber-300/10' : saved === 0 ? 'border-red-400/40 text-red-200' : 'border-white/15 focus:border-white/50'}`} />}</td>; })}<td className="px-5 py-4 text-right font-semibold text-zinc-100">{total}</td></tr>;
          })}</tbody></table></div></div>

        <div className="space-y-4 lg:hidden">
          {loading ? (
            <div className="rounded-xl border border-white/10 bg-[#17181b] px-5 py-14 text-center text-zinc-400"><LoaderCircle className="mx-auto mb-3 animate-spin" size={20} aria-hidden="true" />Loading inventory…</div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#17181b] px-5 py-14 text-center text-zinc-400">{products.length === 0 ? 'No products were found in the configured collections.' : 'No products match the current collection and search.'}</div>
          ) : (
            filteredProducts.map((product) => (
              <InventoryMobileCard
                key={product.productId}
                product={product}
                inventoryDrafts={inventoryDrafts}
                metadataDrafts={metadataDrafts}
                invalid={invalid}
                saving={saving}
                hasDraft={pendingProducts.some((pendingProduct) => pendingProduct.productId === product.productId)}
                onInventoryDraft={setInventoryDraft}
                onMetadataDraft={setMetadataDraft}
              />
            ))
          )}
        </div>
      </section>
    </main>
  );
}
