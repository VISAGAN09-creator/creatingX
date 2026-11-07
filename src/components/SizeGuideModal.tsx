import { X } from 'lucide-react';
import { useEffect } from 'react';
import type { ProductSizeGuideRow } from '../types';

export const DEFAULT_SIZE_GUIDE: ProductSizeGuideRow[] = [
  { size: 'XXS', toFitChest: '34', Chest: '40', Length: '28', shoulder: '19' },
  { size: 'XS', toFitChest: '36', Chest: '42', Length: '28.5', shoulder: '20' },
  { size: 'S', toFitChest: '38', Chest: '44', Length: '29', shoulder: '21' },
  { size: 'M', toFitChest: '40', Chest: '46', Length: '29', shoulder: '22' },
  { size: 'L', toFitChest: '42', Chest: '48', Length: '29.5', shoulder: '23' },
  { size: 'XL', toFitChest: '44', Chest: '50', Length: '29.5', shoulder: '24' },
  { size: 'XXL', toFitChest: '46', Chest: '52', Length: '30', shoulder: '25' },
  { size: 'XXXL', toFitChest: '48', Chest: '54', Length: '30', shoulder: '26' },
];

type SizeGuideModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SizeGuideModal({ open, onClose }: SizeGuideModalProps) {
  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[2500] flex items-center justify-center bg-black/50 px-5 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="Size guide"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[620px] bg-white p-6 text-black shadow-metal sm:p-10">
        <div className="mb-7 flex items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-normal">Size Guide</h2>
            <p className="mt-1 text-sm text-metal-text">Measurements in inches</p>
          </div>
          <button
            type="button"
            aria-label="Close size guide"
            className="flex h-10 w-10 items-center justify-center border border-metal-mid text-black transition hover:bg-black hover:text-white"
            onClick={onClose}
          >
            <X size={18} strokeWidth={2} />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-center text-[13px]">
            <thead>
              <tr>
                {['Sizes', 'To Fit Chest', 'Chest', 'Length', 'Shoulder'].map((heading) => (
                  <th
                    key={heading}
                    className="border-b border-metal-light bg-[#f5f5f5] px-3 py-3.5 text-[11px] font-bold uppercase tracking-[0.08em]"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {DEFAULT_SIZE_GUIDE.map((row) => (
                <tr key={row.size} className="transition hover:bg-black/[0.02]">
                  <td className="border-b border-metal-light px-3 py-3.5 font-semibold">{row.size}</td>
                  <td className="border-b border-metal-light px-3 py-3.5">{row.toFitChest}</td>
                  <td className="border-b border-metal-light px-3 py-3.5">{row.Chest}</td>
                  <td className="border-b border-metal-light px-3 py-3.5">{row.Length}</td>
                  <td className="border-b border-metal-light px-3 py-3.5">{row.shoulder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
