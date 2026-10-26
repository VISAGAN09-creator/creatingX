import { ArrowDown, ArrowUp, ImagePlus, LoaderCircle, LogOut, ShieldCheck, Trash2, Upload } from 'lucide-react';
import { ChangeEvent, DragEvent, useEffect, useMemo, useRef, useState } from 'react';
import { getDownloadURL, ref, uploadBytesResumable } from 'firebase/storage';
import { createProduct, fetchProductCollections, INVENTORY_SIZES, type InventorySize } from '../lib/adminApi';
import { storage } from '../lib/firebase';
import { Button } from './ui/button';

type PendingImage = { id: string; file: File; preview: string };
type SizeDraft = Partial<Record<InventorySize, string>>;

function safeSegment(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 70);
}

function productIdentifier(name: string) {
  const suffix = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${safeSegment(name) || 'product'}-${suffix}`;
}

function numericInput(value: string) {
  return value.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
}

function validSizes(draft: SizeDraft) {
  const result: Partial<Record<InventorySize, number>> = {};
  for (const size of INVENTORY_SIZES) {
    const value = draft[size];
    if (value === undefined) continue;
    if (!/^(0|[1-9]\d*)$/.test(value)) return null;
    result[size] = Number(value);
  }
  return Object.keys(result).length ? result : null;
}

function fileExtension(file: File) {
  const matched = /\.([a-z0-9]+)$/i.exec(file.name);
  if (matched) return matched[1].toLowerCase();
  return file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
}

function SizeConfiguration({ title, value, onChange, disabled }: { title: string; value: SizeDraft; onChange: (next: SizeDraft) => void; disabled: boolean }) {
  return (
    <fieldset className="rounded-xl border border-white/10 bg-black/15 p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-100">{title}</legend>
      <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {INVENTORY_SIZES.map((size) => {
          const configured = value[size] !== undefined;
          return (
            <label key={size} className="rounded-lg border border-white/10 bg-[#111214] p-2 text-xs text-zinc-300">
              <span className="flex items-center gap-2 font-semibold"><input type="checkbox" checked={configured} disabled={disabled} onChange={(event) => { const next = { ...value }; if (event.target.checked) next[size] = '0'; else delete next[size]; onChange(next); }} />{size}</span>
              {configured && <input aria-label={`${title} ${size} stock`} value={value[size] ?? ''} disabled={disabled} inputMode="numeric" onChange={(event) => onChange({ ...value, [size]: numericInput(event.target.value) })} className="mt-2 h-9 w-full rounded border border-white/15 bg-[#1a1b1f] px-2 text-center text-sm text-white outline-none focus:border-white/50" placeholder="Stock" />}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function ProductCreation({ adminEmail, onSignOut, onExit, onOpenInventory, onOpenOrders }: {
  adminEmail: string | null;
  onSignOut: () => Promise<void>;
  onExit: () => void;
  onOpenInventory: () => void;
  onOpenOrders: () => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [collectionName, setCollectionName] = useState('');
  const [collections, setCollections] = useState<string[]>([]);
  const [latest, setLatest] = useState(false);
  const [hero, setHero] = useState(false);
  const [couple, setCouple] = useState(false);
  const [sizes, setSizes] = useState<SizeDraft>({});
  const [mensSizes, setMensSizes] = useState<SizeDraft>({});
  const [womensSizes, setWomensSizes] = useState<SizeDraft>({});
  const [images, setImages] = useState<PendingImage[]>([]);
  const [uploadedUrls, setUploadedUrls] = useState<Record<string, string>>({});
  const [uploadProgress, setUploadProgress] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchProductCollections(controller.signal).then(setCollections).catch((loadError: unknown) => {
      if (!controller.signal.aborted) setError(loadError instanceof Error ? loadError.message : 'Unable to load product collections.');
    });
    return () => controller.abort();
  }, []);

  const folder = useMemo(() => `products/${safeSegment(name) || 'product'}-${documentId || 'created-on-save'}`, [documentId, name]);
  const selectFiles = (files: FileList | File[]) => {
    const accepted = Array.from(files).filter((file) => file.type.startsWith('image/') && file.size <= 10 * 1024 * 1024);
    if (accepted.length !== Array.from(files).length) setError('Use image files no larger than 10 MB. Unsupported files were skipped.');
    setImages((current) => [...current, ...accepted.map((file) => ({ id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`, file, preview: URL.createObjectURL(file) }))]);
  };
  const onFileChange = (event: ChangeEvent<HTMLInputElement>) => { if (event.target.files) selectFiles(event.target.files); event.target.value = ''; };
  const onDrop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); selectFiles(event.dataTransfer.files); };
  const removeImage = (id: string) => setImages((current) => { const image = current.find((entry) => entry.id === id); if (image) URL.revokeObjectURL(image.preview); const next = current.filter((entry) => entry.id !== id); setUploadedUrls((urls) => { const copy = { ...urls }; delete copy[id]; return copy; }); return next; });
  const moveImage = (index: number, direction: -1 | 1) => setImages((current) => { const target = index + direction; if (target < 0 || target >= current.length) return current; const next = [...current]; [next[index], next[target]] = [next[target], next[index]]; return next; });
  const reset = () => { images.forEach((image) => URL.revokeObjectURL(image.preview)); setName(''); setPrice(''); setDocumentId(''); setCollectionName(''); setLatest(false); setHero(false); setCouple(false); setSizes({}); setMensSizes({}); setWomensSizes({}); setImages([]); setUploadedUrls({}); setUploadProgress({}); setError(null); };

  const submit = async () => {
    if (saving) return;
    const parsedPrice = Number(price);
    const standard = validSizes(sizes);
    const mens = validSizes(mensSizes);
    const womens = validSizes(womensSizes);
    if (!name.trim() || !Number.isFinite(parsedPrice) || parsedPrice <= 0 || !collectionName || !images.length || (couple ? (!mens || !womens) : !standard)) {
      setError(couple ? "Enter name, price, one collection, images, and at least one men's and women's stock size." : 'Enter name, price, one collection, images, and at least one stock size.');
      return;
    }
    const id = documentId || productIdentifier(name);
    if (!documentId) setDocumentId(id);
    setSaving(true); setError(null); setNotice(null);
    try {
      const nextUrls = { ...uploadedUrls };
      for (let index = 0; index < images.length; index += 1) {
        const image = images[index];
        if (nextUrls[image.id]) continue;
        const storagePath = `products/${safeSegment(name) || 'product'}-${id}/${String(index + 1).padStart(2, '0')}-${safeSegment(image.file.name.replace(/\.[^.]+$/, '')) || 'image'}.${fileExtension(image.file)}`;
        const task = uploadBytesResumable(ref(storage, storagePath), image.file, { contentType: image.file.type });
        nextUrls[image.id] = await new Promise<string>((resolve, reject) => task.on('state_changed', (snapshot) => setUploadProgress((current) => ({ ...current, [image.id]: Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100) })), reject, async () => resolve(await getDownloadURL(task.snapshot.ref))));
        setUploadedUrls({ ...nextUrls });
      }
      const productId = await createProduct({ name: name.trim().replace(/\s+/g, ' '), price: parsedPrice, collectionName, documentId: id, latest, hero, couple, imageUrls: images.map((image) => nextUrls[image.id]), ...(couple ? { mensSizes: mens!, womensSizes: womens! } : { sizes: standard! }) });
      setNotice(`${productId} was created. Add another product when ready.`);
      reset();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to upload images and save the product. Uploaded images remain available for retry.');
    } finally { setSaving(false); }
  };

  return <main className="relative z-[1] min-h-screen bg-[#111214] px-4 py-5 text-zinc-100 sm:px-7 sm:py-8 lg:px-10"><section className="mx-auto w-full max-w-6xl"><header className="mb-7 flex flex-col gap-5 border-b border-white/10 pb-6 lg:flex-row lg:items-end lg:justify-between"><div><div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500"><ShieldCheck size={15} /> VARATAAA administration</div><h1 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">Product Creation Center</h1><p className="mt-2 text-sm text-zinc-400">Upload images, set product details, and create inventory-ready catalog products.</p></div><div className="flex flex-wrap gap-3 text-sm"><span className="max-w-[220px] truncate py-2 text-zinc-500">{adminEmail || 'Authorized administrator'}</span><button type="button" onClick={onOpenInventory} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300">Inventory</button><button type="button" onClick={onOpenOrders} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300">Orders</button><button type="button" onClick={onExit} className="rounded-lg border border-white/15 px-3 py-2 text-zinc-300">Storefront</button><button type="button" onClick={() => void onSignOut()} className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-3 py-2 text-zinc-300"><LogOut size={15} />Sign out</button></div></header>
    <div className="grid gap-6 lg:grid-cols-[1fr_1.15fr]"><section className="space-y-5 rounded-xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-2 text-sm font-medium text-zinc-300">Product name<input value={name} disabled={saving} onChange={(event) => setName(event.target.value)} className="h-11 rounded-lg border border-white/15 bg-[#111214] px-3 text-white outline-none focus:border-white/50" /></label><label className="grid gap-2 text-sm font-medium text-zinc-300">Price (INR)<input value={price} disabled={saving} inputMode="decimal" onChange={(event) => setPrice(event.target.value.replace(/[^\d.]/g, ''))} className="h-11 rounded-lg border border-white/15 bg-[#111214] px-3 text-white outline-none focus:border-white/50" /></label></div><p className="text-xs text-zinc-500">Folder: <code>{folder}/</code></p><fieldset><legend className="text-sm font-medium text-zinc-300">Collection</legend><p className="mb-3 mt-1 text-xs text-zinc-500">Products belong to one Firestore collection; select exactly one to preserve storefront filtering.</p><div className="flex flex-wrap gap-2">{collections.map((collection) => <label key={collection} className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${collectionName === collection ? 'border-white bg-white text-black' : 'border-white/15 text-zinc-300'}`}><input type="checkbox" checked={collectionName === collection} disabled={saving} onChange={() => setCollectionName((current) => current === collection ? '' : collection)} />{collection}</label>)}</div></fieldset><div className="grid grid-cols-3 gap-3">{([{ label: 'Latest', value: latest, set: setLatest }, { label: 'Hero', value: hero, set: setHero }, { label: 'Couple T-shirt', value: couple, set: setCouple }] as const).map((flag) => <label key={flag.label} className="grid gap-1 text-xs font-medium text-zinc-400">{flag.label}<select value={flag.value ? 'yes' : 'no'} disabled={saving} onChange={(event) => flag.set(event.target.value === 'yes')} className="h-10 rounded-lg border border-white/15 bg-[#111214] px-2 text-sm text-white"><option value="no">No</option><option value="yes">Yes</option></select></label>)}</div>{couple ? <div className="grid gap-4"><SizeConfiguration title="Men's T-shirt Sizes" value={mensSizes} onChange={setMensSizes} disabled={saving} /><SizeConfiguration title="Women's T-shirt Sizes" value={womensSizes} onChange={setWomensSizes} disabled={saving} /></div> : <SizeConfiguration title="Size Configuration" value={sizes} onChange={setSizes} disabled={saving} />}</section>
    <section className="rounded-xl border border-white/10 bg-[#17181b] p-5 sm:p-6"><div onDragOver={(event) => event.preventDefault()} onDrop={onDrop} className="grid min-h-40 place-items-center rounded-xl border border-dashed border-white/25 bg-black/20 p-6 text-center"><ImagePlus size={28} className="text-zinc-400" /><p className="mt-3 text-sm font-medium">Drag images here</p><p className="mt-1 text-xs text-zinc-500">JPG, PNG, WEBP and other image formats up to 10 MB.</p><Button type="button" variant="outline" className="mt-4 border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white" onClick={() => inputRef.current?.click()} disabled={saving}>Choose images</Button><input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={onFileChange} /></div><div className="mt-5 space-y-3">{images.map((image, index) => <article key={image.id} className="flex gap-3 rounded-lg border border-white/10 bg-black/15 p-3"><img src={image.preview} alt="Selected product preview" className="h-20 w-16 rounded object-cover" /><div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{image.file.name}</p><p className="mt-1 text-xs text-zinc-500">{Math.round(image.file.size / 1024)} KB {uploadProgress[image.id] !== undefined && `· ${uploadProgress[image.id]}%`}</p>{uploadedUrls[image.id] && <p className="mt-1 text-xs text-emerald-300">Uploaded; retained for retry.</p>}</div><div className="flex flex-col gap-1"><button type="button" disabled={saving || index === 0} onClick={() => moveImage(index, -1)} aria-label="Move image earlier" className="p-1 text-zinc-300 disabled:opacity-30"><ArrowUp size={16} /></button><button type="button" disabled={saving || index === images.length - 1} onClick={() => moveImage(index, 1)} aria-label="Move image later" className="p-1 text-zinc-300 disabled:opacity-30"><ArrowDown size={16} /></button><button type="button" disabled={saving} onClick={() => removeImage(image.id)} aria-label="Remove image" className="p-1 text-red-300"><Trash2 size={16} /></button></div></article>)}</div><div aria-live="polite" className="mt-5 space-y-3">{error && <p role="alert" className="rounded-lg border border-red-400/30 bg-red-400/10 px-4 py-3 text-sm text-red-100">{error}</p>}{notice && <p className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-100">{notice}</p>}</div><Button type="button" onClick={() => void submit()} disabled={saving} className="mt-5 w-full bg-white text-black hover:bg-zinc-200">{saving ? <LoaderCircle className="mr-2 animate-spin" size={17} /> : <Upload className="mr-2" size={17} />}{saving ? 'Uploading images and saving…' : 'Upload Images & Save Product'}</Button></section></div>
  </section></main>;
}
