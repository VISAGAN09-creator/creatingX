/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { CustomizerState, PanelId, TShirtSize } from './types';
import { PRESET_DESIGNS } from './presets';
import { TShirt3DViewer } from './components/TShirt3DViewer';
import { 
  Shirt, RotateCcw, Upload, Trash2, Check, Download, 
  Sliders, Sparkles, ArrowLeft, ShoppingBag, Layers,
  Palette, Info
} from 'lucide-react';
import type { Product } from '../../types';

interface TShirtCustomizerProps {
  onAddToCart?: (product: Product) => void;
  onBack?: () => void;
}

type MobileTab = 'upload' | 'edit' | 'presets' | null;

function useIsMobile(breakpoint = 1024) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < breakpoint : true
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [breakpoint]);

  return isMobile;
}

export function TShirtCustomizer({ onAddToCart, onBack }: TShirtCustomizerProps) {
  // Initialize customizer state with premium defaults
  const [state, setState] = useState<CustomizerState>({
    color: 'black',
    garmentSize: 'L',
    activePanel: 'front',
    designs: {
      front: {
        url: PRESET_DESIGNS[1].url, // Synthwave Sun preset
        name: 'Preset: Synthwave Sun',
        x: 50,
        y: 45,
        sizeType: 'medium',
        rotation: 0,
      },
      back: {
        url: PRESET_DESIGNS[3].url, // Raw Force Industrial preset
        name: 'Preset: Raw Force Industrial',
        x: 50,
        y: 42,
        sizeType: 'medium',
        rotation: 0,
      },
      leftSleeve: {
        url: null,
        name: null,
        x: 50,
        y: 50,
        sizeType: 'medium',
        rotation: 0,
      },
      rightSleeve: {
        url: null,
        name: null,
        x: 50,
        y: 50,
        sizeType: 'medium',
        rotation: 0,
      },
      extra: {
        url: null,
        name: null,
        x: 50,
        y: 50,
        sizeType: 'medium',
        rotation: 0,
      },
    },
    style: 'oversized',
    finish: 'normal',
  });

  const [is3dShowcase, setIs3dShowcase] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [showExportSuccess, setShowExportSuccess] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [mobileTab, setMobileTab] = useState<MobileTab>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2800);
  };

  // Helper to handle state updates
  const handleStateChange = (updater: (prev: CustomizerState) => CustomizerState) => {
    setState(updater);
  };

  // Upload file conversion to local blob URL
  const handleUploadFile = (panel: PanelId, file: File) => {
    if (!file.type.startsWith('image/')) {
      showToast('Please upload a valid image file (PNG, JPG, SVG, WebP)');
      return;
    }
    const localUrl = URL.createObjectURL(file);
    setState((prev) => {
      const nextDesigns = { ...prev.designs };
      nextDesigns[panel] = {
        ...nextDesigns[panel],
        url: localUrl,
        name: file.name,
      };
      return { ...prev, designs: nextDesigns };
    });
    showToast(`Uploaded design for ${panel === 'extra' ? 'extra graphic' : panel} side!`);
  };

  // Apply preset design to active panel
  const handleApplyPreset = (preset: (typeof PRESET_DESIGNS)[0]) => {
    setState((prev) => {
      const nextDesigns = { ...prev.designs };
      nextDesigns[prev.activePanel] = {
        ...nextDesigns[prev.activePanel],
        url: preset.url,
        name: `Preset: ${preset.name}`,
      };
      return { ...prev, designs: nextDesigns };
    });
    showToast(`Applied "${preset.name}" to ${state.activePanel} panel`);
  };

  const handleClearDesign = (panel: PanelId) => {
    setState((prev) => {
      const nextDesigns = { ...prev.designs };
      nextDesigns[panel] = {
        ...nextDesigns[panel],
        url: null,
        name: null,
      };
      return { ...prev, designs: nextDesigns };
    });
    showToast(`Removed graphic from ${panel} panel`);
  };

  // Reset to initial mockup configuration
  const handleReset = () => {
    setState({
      color: 'black',
      garmentSize: 'L',
      activePanel: 'front',
      designs: {
        front: {
          url: PRESET_DESIGNS[1].url,
          name: 'Preset: Synthwave Sun',
          x: 50,
          y: 45,
          sizeType: 'medium',
          rotation: 0,
        },
        back: {
          url: PRESET_DESIGNS[3].url,
          name: 'Preset: Raw Force Industrial',
          x: 50,
          y: 42,
          sizeType: 'medium',
          rotation: 0,
        },
        leftSleeve: {
          url: null,
          name: null,
          x: 50,
          y: 50,
          sizeType: 'medium',
          rotation: 0,
        },
        rightSleeve: {
          url: null,
          name: null,
          x: 50,
          y: 50,
          sizeType: 'medium',
          rotation: 0,
        },
        extra: {
          url: null,
          name: null,
          x: 50,
          y: 50,
          sizeType: 'medium',
          rotation: 0,
        },
      },
      style: 'oversized',
      finish: 'normal',
    });
    showToast('Reset to default mockup');
  };

  // Compute total detailed pricing breakdown
  const computePriceBreakdown = () => {
    const hasFrontAndBack = !!state.designs.front.url && !!state.designs.back.url;
    
    if (!hasFrontAndBack) {
      return {
        isPriceLocked: true,
        basePrice: 0,
        finishPrice: 0,
        prints: [],
        totalPrice: 0,
      };
    }

    const basePrice = 599; 
    const finishPrice = state.finish === 'acid wash' ? 150 : 0; 
    
    const prints: { panelName: string; size: string; price: number }[] = [];
    
    prints.push({
      panelName: 'Front Graphic Print',
      size: state.designs.front.sizeType,
      price: 0,
    });
    
    prints.push({
      panelName: 'Back Graphic Print',
      size: state.designs.back.sizeType,
      price: 0,
    });
    
    if (state.designs.leftSleeve.url) {
      prints.push({
        panelName: 'Left Sleeve Graphic',
        size: state.designs.leftSleeve.sizeType,
        price: 0,
      });
    }

    if (state.designs.rightSleeve.url) {
      prints.push({
        panelName: 'Right Sleeve Graphic',
        size: state.designs.rightSleeve.sizeType,
        price: 0,
      });
    }

    if (state.designs.extra.url) {
      prints.push({
        panelName: 'Extra Graphic (Front)',
        size: state.designs.extra.sizeType,
        price: 0,
      });
    }

    const totalPrice = basePrice + finishPrice;

    return {
      isPriceLocked: false,
      basePrice,
      finishPrice,
      prints,
      totalPrice,
    };
  };

  const { isPriceLocked, basePrice, finishPrice, prints, totalPrice } = computePriceBreakdown();

  // Add customized t-shirt to Cart
  const handleAddToCart = () => {
    if (!onAddToCart) {
      showToast('Cart not available');
      return;
    }

    const customProduct: Product = {
      id: `custom-${state.style}-${state.color}-${state.garmentSize}-${Date.now()}`,
      name: `Custom ${state.style === 'oversized' ? 'Oversized' : 'Classic Polo'} Tee`,
      price: totalPrice > 0 ? totalPrice : 599,
      priceLabel: `Rs. ${totalPrice > 0 ? totalPrice : 599}`,
      image: state.designs.front.url || state.designs.back.url || 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=600&h=800&fit=crop',
      alt: `Custom ${state.color} ${state.style} t-shirt`,
      tag: 'Custom Print',
      subtitle: `${state.color.toUpperCase()} • Size ${state.garmentSize} • ${state.finish === 'acid wash' ? 'Acid Wash' : 'Classic Cotton'}`,
      description: `Custom ${state.style} t-shirt with personalized graphics. Garment size: ${state.garmentSize}, Finish: ${state.finish}, Color: ${state.color}. Includes custom front & back placements.`,
      details: [
        `Style: ${state.style === 'oversized' ? 'Streetwear Oversized Fit' : 'Tailored Classic Polo'}`,
        `Color: ${state.color.toUpperCase()}`,
        `Size: ${state.garmentSize}`,
        `Finish: ${state.finish.toUpperCase()}`,
        `Front Print: ${state.designs.front.name || 'None'}`,
        `Back Print: ${state.designs.back.name || 'None'}`,
      ],
      theme: 'Custom Studio',
    };

    onAddToCart(customProduct);
    showToast('Custom tee added to cart!');
  };

  // Export Mockup SVG directly to customer local disk
  const handleExport = () => {
    setIsExporting(true);
    setTimeout(() => {
      setIsExporting(false);
      setShowExportSuccess(true);
      
      const svgEl = document.querySelector('#tshirt-viewer-container svg');
      if (svgEl) {
        const serializer = new XMLSerializer();
        let source = serializer.serializeToString(svgEl);
        if (!source.match(/^<svg[^>]+xmlns="http:\/\/www\.w3\.org\/2000\/svg"/)) {
          source = source.replace(/^<svg/, '<svg xmlns="http://www.w3.org/2000/svg"');
        }
        if (!source.match(/^<svg[^>]+xmlns:xlink="http:\/\/www\.w3\.org\/1999\/xlink"/)) {
          source = source.replace(/^<svg/, '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
        }
        
        const blob = new Blob([source], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `varataaa-custom-mockup-${state.style}-${state.color}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }, 600);
  };

  // 1. Upload & Layer Section
  const uploadSection = (
    <section className="bg-white border border-metal-mid rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-0.5 bg-black text-white text-[10px] font-mono font-bold uppercase tracking-widest rounded">
            Layers
          </div>
          <span className="text-xs text-metal-dark font-mono font-medium">→ Printable Positions</span>
        </div>
        <span className="text-[10px] text-black font-mono font-bold flex items-center gap-1 bg-metal-light px-2 py-0.5 rounded border border-metal-mid">
          ★ FRONT & BACK REQUIRED
        </span>
      </div>

      {/* Panel Buttons */}
      <div className="grid grid-cols-2 gap-2 p-2 bg-metal-off rounded-xl border border-metal-mid">
        {(['front', 'back', 'leftSleeve', 'rightSleeve', 'extra'] as PanelId[]).map((panel) => {
          const isActive = state.activePanel === panel;
          const hasDesign = !!state.designs[panel].url;
          const isCompulsory = panel === 'front' || panel === 'back';
          const isExtra = panel === 'extra';

          return (
            <button
              key={panel}
              type="button"
              onClick={() => setState((prev) => ({ ...prev, activePanel: panel }))}
              className={`relative flex flex-col items-start justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none ${
                isActive
                  ? 'bg-black border-black text-white shadow-sm scale-[1.01] z-10 font-medium'
                  : 'bg-white border-metal-mid text-black hover:border-black hover:bg-metal-light/40'
              } ${isExtra ? 'col-span-2' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[11px] font-bold uppercase tracking-wide">
                  {panel === 'front' && 'Front Print'}
                  {panel === 'back' && 'Back Print'}
                  {panel === 'leftSleeve' && 'Left Sleeve'}
                  {panel === 'rightSleeve' && 'Right Sleeve'}
                  {panel === 'extra' && 'Extra Front Print'}
                  {isCompulsory && <span className="text-red-500 ml-1 font-bold">★</span>}
                </span>
                {hasDesign && (
                  <span className={`text-[8px] font-bold px-1.5 py-0.2 rounded uppercase tracking-wider ${
                    isActive ? 'bg-white text-black' : 'bg-metal-light text-black border border-metal-mid'
                  }`}>
                    Loaded
                  </span>
                )}
              </div>

              <div className="mt-1.5 w-full flex items-center justify-between">
                {hasDesign ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded bg-metal-light border border-metal-mid overflow-hidden flex items-center justify-center p-0.5">
                        <img
                          src={state.designs[panel].url!}
                          alt="preview"
                          className="object-contain w-full h-full"
                        />
                      </div>
                      <span className={`text-[10px] truncate max-w-[130px] font-mono ${isActive ? 'text-neutral-300' : 'text-metal-dark'}`}>
                        {state.designs[panel].name}
                      </span>
                    </div>
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDesign(panel);
                      }}
                      className={`p-1 rounded transition-colors cursor-pointer ${
                        isActive ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-metal-light text-metal-dark hover:text-red-600'
                      }`}
                      title="Remove Graphic"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </span>
                  </div>
                ) : (
                  <div className={`flex items-center gap-1.5 text-[10px] ${isActive ? 'text-neutral-400' : 'text-metal-text'}`}>
                    <Upload className="w-3 h-3" />
                    <span>No graphic attached</span>
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Upload File CTA */}
      <div className="flex flex-col gap-2 bg-metal-off p-3.5 rounded-xl border border-metal-mid">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-metal-dark uppercase tracking-wider">
            Upload Your Own Art ({state.activePanel === 'extra' ? 'Extra' : state.activePanel})
          </span>
          <span className="text-[9px] text-metal-text font-mono">PNG, JPG, SVG, WebP</span>
        </div>
        <input
          type="file"
          ref={fileInputRef}
          accept="image/*"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleUploadFile(state.activePanel, file);
          }}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-3 px-4 border-2 border-dashed border-metal-mid hover:border-black bg-white hover:bg-metal-light text-xs font-semibold text-black rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm group"
        >
          <Upload className="w-4 h-4 text-metal-dark group-hover:text-black transition-colors" />
          <span>Upload Image from Device</span>
        </button>
      </div>

      {/* Preset Designs Quick Pick */}
      <div className="flex flex-col gap-2 bg-metal-off p-3.5 rounded-xl border border-metal-mid">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono font-bold text-metal-dark uppercase tracking-wider flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-black" />
            Curated Artwork Presets
          </span>
          <span className="text-[9px] text-metal-text font-mono">Click to Apply</span>
        </div>
        
        <div className="grid grid-cols-2 gap-2">
          {PRESET_DESIGNS.map((preset) => {
            const isCurrent = state.designs[state.activePanel].url === preset.url;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleApplyPreset(preset)}
                className={`flex items-center gap-2.5 p-2 rounded-lg border text-left transition-all cursor-pointer ${
                  isCurrent
                    ? 'bg-black text-white border-black font-semibold shadow-xs'
                    : 'bg-white text-black border-metal-mid hover:border-black hover:bg-metal-light/50'
                }`}
              >
                <div className="w-7 h-7 rounded bg-metal-light overflow-hidden flex items-center justify-center border border-metal-mid shrink-0 p-0.5">
                  <img src={preset.url} alt={preset.name} className="w-full h-full object-contain" />
                </div>
                <div className="min-w-0">
                  <p className="text-[10px] font-bold truncate leading-tight">{preset.name}</p>
                  <p className={`text-[8px] uppercase tracking-wider ${isCurrent ? 'text-neutral-400' : 'text-metal-text'}`}>{preset.category}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );

  // 2. Garment Style, Color & Size Configuration
  const editSection = (
    <section className="bg-white border border-metal-mid rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="px-2.5 py-0.5 bg-black text-white text-[10px] font-mono font-bold uppercase tracking-widest rounded">
          Garment
        </div>
        <span className="text-xs text-metal-dark font-mono font-medium">→ Silhouette & Specs</span>
      </div>

      {/* Style selector */}
      <div className="flex flex-col gap-3">
        <label className="text-[10px] font-mono font-bold text-metal-dark uppercase tracking-wider">
          1. Select Silhouette
        </label>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, style: 'oversized' }))}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              state.style === 'oversized'
                ? 'bg-black border-black text-white shadow-sm font-bold'
                : 'bg-white border-metal-mid text-black hover:bg-metal-light hover:border-black'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase">Oversized Tee</span>
              {state.style === 'oversized' && <Check className="w-4 h-4 text-white" />}
            </div>
            <span className={`text-[9px] mt-1 block font-mono ${state.style === 'oversized' ? 'text-neutral-300' : 'text-metal-text'}`}>
              Streetwear boxy cut
            </span>
          </button>

          <button
            type="button"
            onClick={() => setState((prev) => ({ ...prev, style: 'polo' }))}
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              state.style === 'polo'
                ? 'bg-black border-black text-white shadow-sm font-bold'
                : 'bg-white border-metal-mid text-black hover:bg-metal-light hover:border-black'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase">Classic Polo</span>
              {state.style === 'polo' && <Check className="w-4 h-4 text-white" />}
            </div>
            <span className={`text-[9px] mt-1 block font-mono ${state.style === 'polo' ? 'text-neutral-300' : 'text-metal-text'}`}>
              Structured collar & placket
            </span>
          </button>
        </div>

        {/* Finish coating */}
        {state.style === 'oversized' && (
          <div className="flex items-center justify-between gap-2 bg-metal-off p-2.5 rounded-xl border border-metal-mid mt-1">
            <span className="text-[10px] font-mono font-bold text-metal-dark uppercase">Fabric Treatment:</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, finish: 'normal' }))}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  state.finish === 'normal'
                    ? 'bg-black border-black text-white shadow-xs'
                    : 'bg-white border-metal-mid text-metal-dark hover:border-black hover:text-black'
                }`}
              >
                Classic Cotton
              </button>
              <button
                type="button"
                onClick={() => setState((prev) => ({ ...prev, finish: 'acid wash' }))}
                className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase transition-all cursor-pointer ${
                  state.finish === 'acid wash'
                    ? 'bg-black border-black text-white shadow-xs'
                    : 'bg-white border-metal-mid text-metal-dark hover:border-black hover:text-black'
                }`}
              >
                Acid Wash (+Rs. 150)
              </button>
            </div>
          </div>
        )}

        {/* Color Palette */}
        <div className="flex flex-col gap-2 mt-1">
          <label className="text-[10px] font-mono font-bold text-metal-dark uppercase tracking-wider">
            2. Color Way
          </label>
          <div className="flex items-center gap-3 bg-metal-off p-3 rounded-xl border border-metal-mid">
            {([
              { id: 'black', label: 'Black Core', hex: '#121214', border: 'border-neutral-950' },
              { id: 'white', label: 'Pure White', hex: '#ffffff', border: 'border-metal-mid' },
              { id: 'red', label: 'Crimson Red', hex: '#d91d2a', border: 'border-red-900' }
            ] as const).map((col) => {
              const isColActive = state.color === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setState((prev) => ({ ...prev, color: col.id }))}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg border cursor-pointer transition-all ${
                    isColActive
                      ? 'bg-white border-black shadow-sm font-bold text-black'
                      : 'bg-white/60 border-metal-mid text-metal-dark hover:border-black'
                  }`}
                >
                  <span
                    className={`w-4 h-4 rounded-full border ${col.border} shadow-xs shrink-0 flex items-center justify-center`}
                    style={{ backgroundColor: col.hex }}
                  >
                    {isColActive && (
                      <Check className={`w-2.5 h-2.5 ${col.id === 'white' ? 'text-black' : 'text-white'}`} />
                    )}
                  </span>
                  <span className="text-[11px] uppercase tracking-wider">{col.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Garment Size & Graphic Size */}
        <div className="grid grid-cols-2 gap-3 mt-1">
          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-bold text-metal-dark uppercase tracking-wider">
              Garment Size
            </label>
            <select
              value={state.garmentSize}
              onChange={(e) => setState((prev) => ({ ...prev, garmentSize: e.target.value as TShirtSize }))}
              className="w-full bg-white border border-metal-mid rounded-xl px-3 py-2 text-xs font-bold text-black hover:border-black cursor-pointer focus:outline-none focus:ring-1 focus:ring-black"
            >
              <option value="S">Small (S)</option>
              <option value="M">Medium (M)</option>
              <option value="L">Large (L)</option>
              <option value="XL">Extra Large (XL)</option>
              <option value="XXL">Double Extra Large (XXL)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-[10px] font-mono font-bold text-metal-dark uppercase tracking-wider flex items-center justify-between">
              <span>Graphic Scale ({state.activePanel})</span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-metal-off p-1 border border-metal-mid rounded-xl">
              {(['small', 'medium', 'large'] as const).map((sz) => {
                const isSzActive = state.designs[state.activePanel].sizeType === sz;
                return (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setState((prev) => {
                      const next = { ...prev.designs };
                      next[prev.activePanel] = {
                        ...next[prev.activePanel],
                        sizeType: sz,
                      };
                      return { ...prev, designs: next };
                    })}
                    className={`py-1 text-[10px] font-bold uppercase rounded-lg transition-all cursor-pointer ${
                      isSzActive 
                        ? 'bg-black text-white shadow-xs font-black' 
                        : 'bg-white text-metal-dark hover:text-black hover:bg-metal-light'
                    }`}
                  >
                    {sz[0]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Rotation Controls */}
        <div className="flex flex-col gap-2 bg-metal-off p-3 rounded-xl border border-metal-mid mt-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-mono font-bold text-metal-dark uppercase">
              Graphic Rotation ({state.activePanel}):
            </span>
            <span className="text-[11px] font-mono font-bold text-black">
              {state.designs[state.activePanel].rotation}°
            </span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min="0"
              max="360"
              value={state.designs[state.activePanel].rotation}
              onChange={(e) => {
                const rot = Number(e.target.value);
                setState((prev) => {
                  const next = { ...prev.designs };
                  next[prev.activePanel] = {
                    ...next[prev.activePanel],
                    rotation: rot,
                  };
                  return { ...prev, designs: next };
                });
              }}
              className="flex-grow accent-black bg-metal-mid h-1.5 rounded-lg cursor-pointer"
            />
            <div className="flex gap-1">
              {([0, 90, 180, 270] as const).map((deg) => (
                <button
                  key={deg}
                  type="button"
                  onClick={() => setState((prev) => {
                    const next = { ...prev.designs };
                    next[prev.activePanel] = {
                      ...next[prev.activePanel],
                      rotation: deg,
                    };
                    return { ...prev, designs: next };
                  })}
                  className="px-2 py-0.5 bg-white border border-metal-mid rounded text-[9px] font-mono text-metal-dark hover:border-black hover:text-black cursor-pointer"
                >
                  {deg}°
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );

  // 3. Price & Export Action Toolbar
  const actionToolbar = (
    <div className="flex flex-col sm:flex-row gap-3">
      {/* Price Summary Pill */}
      <button
        type="button"
        onClick={isPriceLocked ? undefined : () => setShowPriceBreakdown(true)}
        className={`flex-1 py-3 px-4 border font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-sm flex items-center justify-between ${
          isPriceLocked 
            ? 'border-dashed border-metal-mid bg-metal-off text-metal-text cursor-not-allowed' 
            : 'border-metal-mid bg-metal-off hover:bg-metal-light hover:border-black text-black cursor-pointer'
        }`}
      >
        <span className="flex items-center gap-1.5">
          <Info className="w-4 h-4 text-metal-dark" />
          <span>Package Price:</span>
        </span>
        <span className="font-mono text-sm font-black text-black">
          {isPriceLocked ? '🔒 Lock (Add Front & Back)' : `Rs. ${totalPrice}`}
        </span>
      </button>

      {/* Export SVG */}
      <button
        type="button"
        onClick={handleExport}
        disabled={isExporting}
        className="py-3 px-5 border border-metal-mid bg-white hover:bg-metal-light text-black font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer shadow-sm flex items-center justify-center gap-2 hover:border-black"
      >
        <Download className="w-4 h-4 text-metal-dark" />
        <span>{isExporting ? 'Exporting...' : 'Export SVG'}</span>
      </button>

      {/* Add to Cart CTA */}
      <button
        type="button"
        onClick={handleAddToCart}
        className="liquid-metal metal-sheen py-3.5 px-6 bg-black hover:bg-neutral-900 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-md flex items-center justify-center gap-2"
      >
        <ShoppingBag className="w-4 h-4" />
        <span>Add to Cart • Rs. {totalPrice > 0 ? totalPrice : 599}</span>
      </button>
    </div>
  );

  // 4. Overlays & Modals
  const viewerOverlays = (
    <>
      {showPriceBreakdown && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white border border-metal-mid text-black rounded-2xl w-full max-w-md p-6 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-metal-mid pb-3">
              <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                <Shirt className="w-4.5 h-4.5 text-black" />
                <span>Custom Package Breakdown</span>
              </h3>
              <button
                type="button"
                onClick={() => setShowPriceBreakdown(false)}
                className="w-7 h-7 rounded-lg hover:bg-metal-light flex items-center justify-center text-metal-dark hover:text-black cursor-pointer font-bold"
              >
                ✕
              </button>
            </div>

            <div className="my-5 flex flex-col gap-2.5 text-xs">
              <div className="flex justify-between items-center text-metal-dark">
                <span>Base Garment: <strong className="uppercase text-black">{state.style} Tee</strong></span>
                <span className="font-mono text-black font-semibold">Rs. {basePrice}</span>
              </div>

              <div className="flex justify-between items-center text-metal-dark">
                <span>Fabric Coating: <strong className="uppercase text-black">{state.finish}</strong></span>
                <span className="font-mono text-black font-semibold">{finishPrice > 0 ? `+Rs. ${finishPrice}` : 'Included'}</span>
              </div>

              {prints.length > 0 && (
                <div className="border-t border-dashed border-metal-mid pt-2.5 flex flex-col gap-2">
                  <span className="text-[10px] font-mono text-metal-text uppercase tracking-widest font-bold">Print Positions (Included in Bundle)</span>
                  {prints.map((pr, i) => (
                    <div key={i} className="flex justify-between items-center text-metal-dark">
                      <span>{pr.panelName} ({pr.size.toUpperCase()})</span>
                      <span className="font-mono text-black font-medium">Included</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-metal-mid pt-4 mt-2 flex justify-between items-baseline">
                <span className="text-sm font-black uppercase text-black">Total Price</span>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-black text-black font-mono">Rs. {totalPrice}</span>
                  <span className="text-xs text-metal-text line-through font-mono">Rs. 1,499</span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowPriceBreakdown(false)}
              className="w-full py-3 bg-black hover:bg-neutral-900 text-white text-xs font-black uppercase rounded-xl tracking-wider cursor-pointer shadow-md transition-all"
            >
              Continue Customizing
            </button>
          </div>
        </div>
      )}

      {showExportSuccess && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6">
          <div className="bg-white border border-metal-mid rounded-2xl w-full max-w-sm p-6 shadow-2xl relative text-center flex flex-col items-center gap-4">
            <div className="w-14 h-14 bg-metal-light text-black rounded-full flex items-center justify-center border border-metal-mid">
              <Check className="w-7 h-7 stroke-[3]" />
            </div>
            
            <div>
              <h3 className="text-base font-black uppercase text-black">Mockup Exported Successfully</h3>
              <p className="text-xs text-metal-dark mt-1 leading-relaxed">
                Vector SVG layout file has been generated and saved to your device.
              </p>
            </div>

            <div className="w-full bg-metal-off border border-metal-mid rounded-xl p-3.5 text-left">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-metal-dark uppercase tracking-widest mb-2">
                <Sparkles className="w-3.5 h-3.5 text-black" />
                <span>Specs Overview</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-[11px] text-metal-dark">
                <div>Style: <strong className="text-black uppercase">{state.style}</strong></div>
                <div>Treatment: <strong className="text-black uppercase">{state.finish}</strong></div>
                <div>Color: <strong className="text-black uppercase">{state.color}</strong></div>
                <div>Size: <strong className="text-black">{state.garmentSize}</strong></div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowExportSuccess(false)}
              className="w-full py-3 bg-black hover:bg-neutral-900 text-white text-xs font-black uppercase rounded-xl tracking-wider cursor-pointer shadow-md transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[3000] bg-black text-white px-6 py-3 rounded-full text-xs font-semibold shadow-2xl flex items-center gap-2 animate-fade-in">
          <Sparkles className="w-4 h-4 text-white" />
          <span>{toastMessage}</span>
        </div>
      )}
    </>
  );

  return (
    <div className="min-h-screen bg-white text-black px-4 sm:px-8 lg:px-12 pt-28 pb-16">
      <div className="mx-auto w-full max-w-shell">
        
        {/* Top Header & Breadcrumbs */}
        <header className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-metal-mid pb-5">
          <div>
            <div className="flex items-center gap-3 mb-2">
              {onBack && (
                <button
                  type="button"
                  onClick={onBack}
                  className="inline-flex items-center gap-2 px-3 py-1.5 border border-metal-mid hover:border-black bg-metal-off hover:bg-white text-xs font-bold uppercase rounded-lg text-black transition-all cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
              )}
              <span className="text-xs font-mono font-semibold uppercase tracking-[0.2em] text-metal-text">
                Studio // 3D Mockup Generator
              </span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-black">
              T-Shirt Customizer
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-2 px-4 py-2 border border-metal-mid hover:border-black bg-white hover:bg-metal-light text-xs font-bold uppercase rounded-xl text-black transition-all cursor-pointer shadow-xs"
            >
              <RotateCcw className="w-3.5 h-3.5 text-metal-dark" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </header>

        {/* ===== MOBILE LAYOUT ===== */}
        {isMobile ? (
          <div className="flex flex-col gap-4 pb-20">
            {/* Viewport Card */}
            <div className="bg-white border border-metal-mid rounded-2xl shadow-sm p-3">
              <div id="tshirt-viewer-container" className="w-full flex items-center justify-center">
                <TShirt3DViewer
                  state={state}
                  onChangeState={handleStateChange}
                  is3dShowcase={is3dShowcase}
                  setIs3dShowcase={setIs3dShowcase}
                />
              </div>
            </div>

            {/* Mobile Tabbed Panels */}
            <div className="flex border border-metal-mid rounded-xl overflow-hidden bg-metal-off p-1">
              <button
                type="button"
                onClick={() => setMobileTab(mobileTab === 'upload' ? null : 'upload')}
                className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mobileTab === 'upload' ? 'bg-black text-white shadow-xs' : 'text-metal-dark hover:text-black'
                }`}
              >
                <Layers className="w-4 h-4" />
                Upload & Layers
              </button>
              <button
                type="button"
                onClick={() => setMobileTab(mobileTab === 'edit' ? null : 'edit')}
                className={`flex-1 py-2.5 text-xs font-bold uppercase rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  mobileTab === 'edit' ? 'bg-black text-white shadow-xs' : 'text-metal-dark hover:text-black'
                }`}
              >
                <Palette className="w-4 h-4" />
                Garment Specs
              </button>
            </div>

            {mobileTab === 'upload' && <div className="animate-fade-in">{uploadSection}</div>}
            {mobileTab === 'edit' && <div className="animate-fade-in">{editSection}</div>}

            {/* Bottom Actions */}
            <div className="sticky bottom-4 z-30 bg-white/95 backdrop-blur-md p-3 rounded-2xl border border-metal-mid shadow-lg">
              {actionToolbar}
            </div>
          </div>
        ) : (
          /* ===== DESKTOP WORKSTATION LAYOUT ===== */
          <div className="grid grid-cols-12 gap-8 items-start">
            {/* Left Column: Controls (Upload & Layers, Garment Specs) */}
            <div className="col-span-5 flex flex-col gap-6">
              {uploadSection}
              {editSection}
            </div>

            {/* Right Column: 3D/2D Viewport & Actions */}
            <div className="col-span-7 flex flex-col gap-6 sticky top-28">
              <div className="bg-white border border-metal-mid rounded-2xl shadow-sm p-5">
                <div id="tshirt-viewer-container" className="w-full flex items-center justify-center min-h-[460px]">
                  <TShirt3DViewer
                    state={state}
                    onChangeState={handleStateChange}
                    is3dShowcase={is3dShowcase}
                    setIs3dShowcase={setIs3dShowcase}
                  />
                </div>
              </div>

              {actionToolbar}
            </div>
          </div>
        )}

        {viewerOverlays}
      </div>
    </div>
  );
}

export default TShirtCustomizer;
