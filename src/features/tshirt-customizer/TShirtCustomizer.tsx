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
  Sliders, Sparkles 
} from 'lucide-react';

type MobileTab = 'upload' | 'edit' | null;

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

export default function App() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Helper to handle state updates
  const handleStateChange = (updater: (prev: CustomizerState) => CustomizerState) => {
    setState(updater);
  };

  // Upload file conversion to local blob URL
  const handleUploadFile = (panel: PanelId, file: File) => {
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

    // Flat price package of Rs. 599 for both Oversized & Polo wears with front and back designs.
    const basePrice = 599; 
    const finishPrice = state.finish === 'acid wash' ? 150 : 0; 
    
    const prints: { panelName: string; size: string; price: number }[] = [];
    
    prints.push({
      panelName: 'Front Graphic Print',
      size: state.designs.front.sizeType,
      price: 0, // Included
    });
    
    prints.push({
      panelName: 'Back Graphic Print',
      size: state.designs.back.sizeType,
      price: 0, // Included
    });
    
    if (state.designs.leftSleeve.url) {
      prints.push({
        panelName: 'Left Sleeve Graphic',
        size: state.designs.leftSleeve.sizeType,
        price: 0, // Included in package
      });
    }

    if (state.designs.rightSleeve.url) {
      prints.push({
        panelName: 'Right Sleeve Graphic',
        size: state.designs.rightSleeve.sizeType,
        price: 0, // Included in package
      });
    }

    if (state.designs.extra.url) {
      prints.push({
        panelName: 'Extra Graphic (Front)',
        size: state.designs.extra.sizeType,
        price: 0, // Included in package
      });
    }

    // Normally finish charges are extra, let's keep acid wash extra to be premium, or keep flat 599 total.
    // "you get a price of Rs. 599 for both Oversized & Polo wears" -> let's make it flat 599 total including acid wash or normal.
    const totalPrice = 599;

    return {
      isPriceLocked: false,
      basePrice,
      finishPrice,
      prints,
      totalPrice,
    };
  };

  const { isPriceLocked, basePrice, finishPrice, prints, totalPrice } = computePriceBreakdown();

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
        link.download = `coming-in-hot-mockup-${state.style}-${state.color}.svg`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      }
    }, 850);
  };

  const uploadSection = (
    <section className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-3 shadow-3xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-0.5 bg-neutral-900 text-white text-[9px] font-mono font-bold uppercase tracking-widest rounded">
            upload
          </div>
          <span className="text-[10px] text-neutral-500 font-mono">→ Design Layers</span>
        </div>
        <span className="text-[9px] text-neutral-600 font-mono font-semibold flex items-center gap-1">
          ★ COMPULSORY BUNDLE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 p-1.5 bg-neutral-50 rounded-xl border border-neutral-200">
        {(['front', 'back', 'leftSleeve', 'rightSleeve', 'extra'] as PanelId[]).map((panel) => {
          const isActive = state.activePanel === panel;
          const hasDesign = !!state.designs[panel].url;
          const isCompulsory = panel === 'front' || panel === 'back';
          const isExtra = panel === 'extra';

          return (
            <div
              key={panel}
              role="button"
              tabIndex={0}
              onClick={() => setState((prev) => ({ ...prev, activePanel: panel }))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setState((prev) => ({ ...prev, activePanel: panel }));
                }
              }}
              className={`relative flex flex-col items-start justify-between p-2.5 rounded-lg border text-left transition-all cursor-pointer select-none outline-hidden ${
                isActive
                  ? 'bg-neutral-900 border-neutral-950 text-white shadow-xs scale-[1.01] z-10'
                  : 'bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300 hover:bg-neutral-50/50'
              } ${isExtra ? 'col-span-2' : ''}`}
            >
              <div className="flex items-center justify-between w-full">
                <span className="text-[10px] font-bold uppercase tracking-wide">
                  {panel === 'front' && 'Front Side'}
                  {panel === 'back' && 'Back Side'}
                  {panel === 'leftSleeve' && 'Left Sleeve'}
                  {panel === 'rightSleeve' && 'Right Sleeve'}
                  {panel === 'extra' && 'Extra Graphic (Front Side)'}
                  {isCompulsory && <span className="text-red-500 ml-1">★</span>}
                </span>
                {hasDesign && (
                  <span className="text-[8px] bg-neutral-100 text-neutral-800 border border-neutral-200 font-bold px-1 rounded-sm uppercase tracking-wider scale-90">
                    Loaded
                  </span>
                )}
              </div>

              <div className="mt-1 w-full flex items-center gap-2">
                {hasDesign ? (
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-sm bg-neutral-100 border border-neutral-250 overflow-hidden flex items-center justify-center p-0.5">
                        <img
                          src={state.designs[panel].url!}
                          alt="preview"
                          className="object-contain w-full h-full"
                        />
                      </div>
                      <span className="text-[9px] text-neutral-500 truncate max-w-[140px]">
                        {state.designs[panel].name}
                      </span>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleClearDesign(panel);
                      }}
                      className={`p-1 rounded-md transition-colors ${
                        isActive ? 'hover:bg-neutral-800 text-neutral-300 hover:text-white' : 'hover:bg-neutral-100 text-neutral-400 hover:text-red-500'
                      }`}
                      title="Remove Graphic"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[9px] text-neutral-450 font-medium">
                    <Upload className="w-2.5 h-2.5 text-neutral-400" />
                    <span>No graphic loaded</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-col gap-1.5 bg-neutral-50 p-3 rounded-xl border border-neutral-200">
        <span className="text-[10px] font-mono font-bold text-neutral-500 uppercase tracking-wider">Upload Custom File</span>
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
          onClick={() => fileInputRef.current?.click()}
          className="w-full py-2.5 px-4 border border-neutral-200 border-dashed hover:border-neutral-450 bg-white hover:bg-neutral-50 text-xs font-semibold text-neutral-700 hover:text-neutral-900 rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer shadow-3xs"
        >
          <Upload className="w-4 h-4 text-neutral-450" />
          <span>Choose local file</span>
        </button>
      </div>
    </section>
  );

  const editSection = (
    <section className="bg-white border border-neutral-200 rounded-2xl p-4 flex flex-col gap-4 shadow-3xs">
      <div className="flex items-center gap-2">
        <div className="px-2.5 py-0.5 bg-neutral-900 text-white text-[9px] font-mono font-bold uppercase tracking-widest rounded">
          edit
        </div>
        <span className="text-[10px] text-neutral-500 font-mono">→ Garment Styles & Colors</span>
      </div>

      <div className="flex flex-col justify-center py-1">
        <div className="relative flex flex-col gap-2.5 items-center w-full">
          <div className="px-3 py-1 border border-neutral-200 bg-neutral-50 rounded-lg text-[9px] font-mono uppercase tracking-widest text-neutral-500 flex items-center gap-1.5 shadow-3xs">
            <Sliders className="w-3 h-3 text-neutral-600" />
            <span>Garment Style</span>
          </div>

          <div className="w-[1px] h-2.5 bg-neutral-200" />

          <div className="flex justify-between w-full max-w-sm gap-4">
            <button
              onClick={() => setState(prev => ({ ...prev, style: 'oversized' }))}
              className={`w-1/2 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                state.style === 'oversized'
                  ? 'bg-neutral-900 border-neutral-950 text-white shadow-xs scale-[1.02] z-10 font-bold'
                  : 'bg-white border-neutral-200 text-neutral-650 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase">Oversized Tee</span>
                {state.style === 'oversized' && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className={`text-[8px] mt-0.5 block ${state.style === 'oversized' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                Streetwear fit
              </span>
            </button>

            <button
              onClick={() => setState(prev => ({ ...prev, style: 'polo' }))}
              className={`w-1/2 p-2.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                state.style === 'polo'
                  ? 'bg-neutral-900 border-neutral-950 text-white shadow-xs scale-[1.02] z-10 font-bold'
                  : 'bg-white border-neutral-200 text-neutral-650 hover:bg-neutral-50 hover:text-neutral-900'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold uppercase">Classic Polo</span>
                {state.style === 'polo' && <Check className="w-3 h-3 text-white" />}
              </div>
              <span className={`text-[8px] mt-0.5 block ${state.style === 'polo' ? 'text-neutral-300' : 'text-neutral-500'}`}>
                Tailored collar
              </span>
            </button>
          </div>

          <div className="text-[9px] text-neutral-700 bg-neutral-50 border border-neutral-200/80 rounded-xl px-3 py-1.5 text-center mt-1 w-full max-w-sm">
            ✨ Upload both <strong>Front & Back</strong> designs to unlock package price of <strong>Rs. 599</strong>!
          </div>

          <div className="flex justify-between w-full max-w-sm px-[25%]">
            <div className="flex flex-col items-center w-full">
              <div className="w-[1px] h-3 bg-neutral-200" />
              {state.style === 'oversized' ? (
                <div className="flex gap-2.5 mt-0.5 justify-center w-[180px] translate-x-[-15px]">
                  <button
                    onClick={() => setState(prev => ({ ...prev, finish: 'normal' }))}
                    className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      state.finish === 'normal'
                        ? 'bg-neutral-900 border-neutral-950 text-white shadow-3xs'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    Classic Cotton
                  </button>
                  <button
                    onClick={() => setState(prev => ({ ...prev, finish: 'acid wash' }))}
                    className={`px-2.5 py-1.5 rounded-lg border text-[9px] font-bold uppercase transition-all cursor-pointer ${
                      state.finish === 'acid wash'
                        ? 'bg-neutral-900 border-neutral-950 text-white shadow-3xs'
                        : 'bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900'
                    }`}
                  >
                    Acid Wash (+Rs. 150)
                  </button>
                </div>
              ) : (
                <div className="text-[8px] font-mono text-neutral-450 uppercase tracking-widest mt-1">Direct Color Link</div>
              )}
            </div>
          </div>

          <div className="w-[1px] h-3 bg-neutral-250" />

          <div className="bg-neutral-50 border border-neutral-200 rounded-xl px-4 py-2 flex items-center gap-3 shadow-3xs">
            <span className="text-[9px] font-bold text-neutral-500 uppercase tracking-wider font-mono">Select Color:</span>
            <div className="flex items-center gap-2">
              {([
                { id: 'white', hex: '#ffffff', border: 'border-neutral-300' },
                { id: 'black', hex: '#121214', border: 'border-neutral-950' },
                { id: 'red', hex: '#ff1e27', border: 'border-red-950' }
              ] as const).map((col) => {
                const isColActive = state.color === col.id;
                return (
                  <button
                    key={col.id}
                    onClick={() => setState(prev => ({ ...prev, color: col.id }))}
                    className={`w-5.5 h-5.5 rounded-full border-2 cursor-pointer transition-all flex items-center justify-center shadow-3xs hover:scale-110 ${
                      isColActive ? 'border-neutral-900 scale-105' : 'border-transparent'
                    }`}
                  >
                    <span 
                      className={`w-4.5 h-4.5 rounded-full border ${col.border}`} 
                      style={{ backgroundColor: col.hex }}
                    >
                      {isColActive && (
                        <Check 
                          className={`w-3 h-3 mx-auto mt-0.5 ${col.id === 'white' ? 'text-black' : 'text-white'}`} 
                        />
                      )}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 pt-2.5 border-t border-neutral-200 flex-none">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1 w-1/2">
            <label className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-wider">Garment Size</label>
            <select
              value={state.garmentSize}
              onChange={(e) => setState(prev => ({ ...prev, garmentSize: e.target.value as TShirtSize }))}
              className="w-full bg-white border border-neutral-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-neutral-805 hover:border-neutral-350 cursor-pointer focus:outline-hidden focus:ring-1 focus:ring-neutral-900"
            >
              <option value="S">Small (S)</option>
              <option value="M">Medium (M)</option>
              <option value="L">Large (L)</option>
              <option value="XL">Extra Large (XL)</option>
              <option value="XXL">Double Extra Large (XXL)</option>
            </select>
          </div>

          <div className="flex flex-col gap-1 w-1/2">
            <label className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-wider flex items-center justify-between">
              <span>Graphic Print Size</span>
              <span className="text-[8px] text-neutral-800 font-bold font-sans">
                {isPriceLocked 
                  ? (state.designs[state.activePanel].sizeType === 'small' ? 'Rs. 150' : state.designs[state.activePanel].sizeType === 'medium' ? 'Rs. 250' : 'Rs. 350')
                  : 'Included'
                }
              </span>
            </label>
            <div className="grid grid-cols-3 gap-1 bg-neutral-50 p-0.5 border border-neutral-200 rounded-lg">
              {(['small', 'medium', 'large'] as const).map((sz) => {
                const isSzActive = state.designs[state.activePanel].sizeType === sz;
                return (
                  <button
                    key={sz}
                    onClick={() => setState((prev) => {
                      const next = { ...prev.designs };
                      next[prev.activePanel] = {
                        ...next[prev.activePanel],
                        sizeType: sz,
                      };
                      return { ...prev, designs: next };
                    })}
                    className={`py-1 text-[9px] font-bold uppercase rounded-md transition-all cursor-pointer ${
                      isSzActive 
                        ? 'bg-neutral-900 text-white shadow-2xs font-extrabold' 
                        : 'bg-white text-neutral-500 hover:text-neutral-900 hover:bg-neutral-50'
                    }`}
                  >
                    {sz}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-neutral-50 border border-neutral-200 rounded-xl p-2">
          <span className="text-[9px] font-mono font-bold text-neutral-500 uppercase tracking-wider w-16">Rotate:</span>
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
            className="flex-grow accent-neutral-900 bg-neutral-200 h-1 rounded-lg cursor-pointer"
          />
          <span className="text-[10px] font-mono font-semibold text-neutral-700 w-9 text-right">
            {state.designs[state.activePanel].rotation}°
          </span>
          
          <div className="flex gap-1">
            {([0, 90, 180, 270] as const).map((deg) => (
              <button
                key={deg}
                onClick={() => setState((prev) => {
                  const next = { ...prev.designs };
                  next[prev.activePanel] = {
                    ...next[prev.activePanel],
                    rotation: deg,
                  };
                  return { ...prev, designs: next };
                })}
                className="px-1 py-0.5 bg-white border border-neutral-200 rounded-sm text-[8px] font-mono text-neutral-500 hover:border-neutral-350 hover:text-white cursor-pointer"
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );

  const priceExportButtons = (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 flex-none">
      <button
        onClick={isPriceLocked ? undefined : () => setShowPriceBreakdown(true)}
        className={`py-2.5 border font-bold text-xs uppercase tracking-widest rounded-xl transition-all shadow-3xs flex items-center justify-center gap-1.5 ${
          isPriceLocked 
            ? 'border-dashed border-neutral-200 bg-neutral-50 text-neutral-400 cursor-not-allowed' 
            : 'border-neutral-200 bg-neutral-50 hover:bg-neutral-100 hover:translate-y-[-1px] active:translate-y-[0px] text-neutral-800 cursor-pointer hover:scale-[1.01]'
        }`}
      >
        <span>Price:</span>
        <span className="font-mono text-sm tracking-tight text-neutral-900 font-black">
          {isPriceLocked ? '🔒 Locked' : 'Rs. 599'}
        </span>
      </button>

      <button
        onClick={handleExport}
        disabled={isExporting}
        className={`py-2.5 font-bold text-xs uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-3xs flex items-center justify-center gap-1.5 ${
          isExporting 
            ? 'bg-neutral-100 text-neutral-400 border border-neutral-200 cursor-not-allowed' 
            : 'bg-neutral-900 hover:bg-neutral-950 text-white hover:translate-y-[-1px] active:translate-y-[0px] border border-neutral-900 hover:scale-[1.01]'
        }`}
      >
        <Download className="w-4 h-4" />
        <span>{isExporting ? 'Exporting...' : 'Export'}</span>
      </button>
    </div>
  );

  const viewerOverlays = (
    <>
      {showPriceBreakdown && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-35 animate-fade-in p-4 sm:p-6">
          <div className="bg-white border border-neutral-200 text-neutral-800 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-2.5">
              <h3 className="text-xs font-black uppercase tracking-wider text-neutral-900 flex items-center gap-1.5">
                <Shirt className="w-4 h-4 text-neutral-800" />
                <span>Garment Package Summary</span>
              </h3>
              <button
                onClick={() => setShowPriceBreakdown(false)}
                className="w-5 h-5 rounded-md hover:bg-neutral-100 flex items-center justify-center text-neutral-450 hover:text-neutral-900 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="my-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between items-center text-neutral-600">
                <span>Base Style: <span className="font-semibold uppercase text-neutral-800 font-sans">{state.style} Tee</span></span>
                <span className="font-mono text-neutral-400">Included</span>
              </div>

              <div className="flex justify-between items-center text-neutral-600">
                <span>Finish Coating: <span className="font-semibold uppercase text-neutral-800 font-sans">{state.finish}</span></span>
                <span className="font-mono text-neutral-400">Included</span>
              </div>

              {prints.length > 0 && (
                <div className="border-t border-dashed border-neutral-100 pt-2 flex flex-col gap-1.5">
                  <span className="text-[9px] font-mono text-neutral-400 uppercase tracking-widest font-bold">Print Positions (Package Bundle)</span>
                  {prints.map((pr, i) => (
                    <div key={i} className="flex justify-between items-center text-neutral-600">
                      <span>{pr.panelName} ({pr.size})</span>
                      <span className="font-mono text-neutral-900">Rs. 0</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-neutral-200 pt-3 mt-2 flex justify-between items-baseline">
                <span className="text-xs font-black uppercase text-neutral-900">Bundle Price</span>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-xl font-black text-neutral-900 font-mono">Rs. 599</span>
                  <span className="text-[10px] text-neutral-400 line-through font-mono">Rs. 1,499</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowPriceBreakdown(false)}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-950 text-white text-xs font-black uppercase rounded-xl tracking-wider cursor-pointer shadow-3xs transition-all"
            >
              Got it, Continue Customizing
            </button>
          </div>
        </div>
      )}

      {showExportSuccess && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-35 animate-fade-in p-4 sm:p-6">
          <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-sm p-5 shadow-2xl relative text-center flex flex-col items-center gap-3">
            <div className="w-12 h-12 bg-neutral-100 text-neutral-900 rounded-full flex items-center justify-center border border-neutral-250">
              <Check className="w-6 h-6 stroke-[3]" />
            </div>
            
            <div>
              <h3 className="text-sm font-black uppercase text-neutral-900">Mockup Export Successful</h3>
              <p className="text-xs text-neutral-500 mt-1 leading-relaxed">
                Vector layout generated and saved directly as SVG to your downloads folder.
              </p>
            </div>

            <div className="w-full bg-neutral-50 border border-neutral-100 rounded-xl p-3 text-left">
              <div className="flex items-center gap-2 text-xs font-mono font-bold text-neutral-450 uppercase tracking-widest mb-1.5">
                <Sparkles className="w-3.5 h-3.5 text-neutral-900" />
                <span>Specifications</span>
              </div>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-[10px] text-neutral-600">
                <div>Style: <strong className="text-neutral-800 uppercase font-sans">{state.style}</strong></div>
                <div>Finish: <strong className="text-neutral-800 uppercase font-sans">{state.finish}</strong></div>
                <div>Color: <strong className="text-neutral-800 uppercase font-sans">{state.color}</strong></div>
                <div>Size: <strong className="text-neutral-800 font-sans">{state.garmentSize}</strong></div>
              </div>
            </div>

            <button
              onClick={() => setShowExportSuccess(false)}
              className="w-full py-2.5 bg-neutral-900 hover:bg-neutral-950 text-white text-xs font-black uppercase rounded-xl tracking-wider cursor-pointer shadow-3xs transition-all"
            >
              Perfect
            </button>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className="h-screen max-h-screen overflow-hidden flex flex-col bg-neutral-50 text-neutral-900 p-3 sm:p-4 font-sans antialiased select-none">
      
      <header className="flex-none flex items-center justify-between border-b border-neutral-200 pb-2.5 mb-2.5 sm:pb-3 sm:mb-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center border border-neutral-950">
            <Shirt className="w-4.5 h-4.5 text-white" />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-display font-black tracking-widest text-neutral-900 uppercase text-md">
              HOTDROP
            </span>
            <span className="text-[8px] font-mono border border-neutral-250 bg-neutral-100 text-neutral-600 px-1 py-0.2 rounded-sm font-semibold uppercase tracking-wider">
              CUSTOM
            </span>
          </div>
        </div>

        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 border border-neutral-200 bg-white hover:bg-neutral-50 text-xs font-semibold rounded-lg text-neutral-600 hover:text-neutral-900 transition-all cursor-pointer shadow-2xs"
        >
          <RotateCcw className="w-3.5 h-3.5 text-neutral-400" />
          <span className="hidden sm:inline">Reset Defaults</span>
          <span className="sm:hidden">Reset</span>
        </button>
      </header>

      {/* ===== MOBILE LAYOUT (matches wireframe) ===== */}
      {isMobile ? (
        <>
          <div className="flex flex-col flex-grow min-h-0 overflow-hidden pb-[68px]">
            {/* 1. Preview — expands when panels are minimized */}
            <div
              className={`relative flex-grow min-h-[240px] bg-white border border-neutral-200 rounded-2xl shadow-3xs flex flex-col overflow-hidden p-2 transition-all ${
                mobileTab ? 'max-h-[38vh] flex-none' : ''
              }`}
            >
              <div id="tshirt-viewer-container" className="flex-grow flex items-center justify-center min-h-0 relative">
                <TShirt3DViewer
                  state={state}
                  onChangeState={handleStateChange}
                  is3dShowcase={is3dShowcase}
                  setIs3dShowcase={setIs3dShowcase}
                />
              </div>
              {viewerOverlays}
            </div>

            {/* 2. Price | Export — under preview */}
            <div className="mt-2.5 mb-2.5 flex-none">
              {priceExportButtons}
            </div>

            {/* 3. Panel opens only after tapping Upload or Edit */}
            {mobileTab && (
              <div className="flex-grow min-h-0 overflow-y-auto scrollbar-thin pb-1 animate-fade-in">
                {mobileTab === 'upload' ? uploadSection : editSection}
              </div>
            )}
          </div>

          {/* Sticky bottom nav — Upload | Edit (collapsed by default) */}
          <nav
            className="fixed bottom-0 inset-x-0 z-40 flex border-t border-neutral-200 bg-white/95 backdrop-blur-sm shadow-[0_-4px_20px_rgba(0,0,0,0.06)]"
            style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
            aria-label="Customizer sections"
          >
            <button
              type="button"
              aria-expanded={mobileTab === 'upload'}
              onClick={() => setMobileTab((prev) => (prev === 'upload' ? null : 'upload'))}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer ${
                mobileTab === 'upload'
                  ? 'text-neutral-900 bg-neutral-50 border-t-2 border-neutral-900 -mt-px'
                  : 'text-neutral-400 border-t-2 border-transparent'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload
            </button>
            <button
              type="button"
              aria-expanded={mobileTab === 'edit'}
              onClick={() => setMobileTab((prev) => (prev === 'edit' ? null : 'edit'))}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 py-3 text-[11px] font-bold uppercase tracking-widest transition-colors cursor-pointer border-l border-neutral-200 ${
                mobileTab === 'edit'
                  ? 'text-neutral-900 bg-neutral-50 border-t-2 border-neutral-900 -mt-px'
                  : 'text-neutral-400 border-t-2 border-transparent'
              }`}
            >
              <Sliders className="w-4 h-4" />
              Edit
            </button>
          </nav>
        </>
      ) : (
        /* ===== DESKTOP LAYOUT (side-by-side) ===== */
        <main className="grid flex-grow grid-cols-12 gap-5 min-h-0 overflow-hidden">
          <div className="col-span-5 flex flex-col gap-4 overflow-y-auto pr-1.5 h-full min-h-0 pb-4 scrollbar-thin">
            {uploadSection}
            {editSection}
          </div>

          <div className="col-span-7 flex flex-col h-full justify-between min-h-0 overflow-hidden">
            <div className="relative flex-grow bg-white border border-neutral-200 rounded-2xl shadow-3xs flex flex-col min-h-0 overflow-hidden p-4">
              <div id="tshirt-viewer-container" className="flex-grow flex items-center justify-center min-h-0 relative">
                <TShirt3DViewer
                  state={state}
                  onChangeState={handleStateChange}
                  is3dShowcase={is3dShowcase}
                  setIs3dShowcase={setIs3dShowcase}
                />
              </div>
              {viewerOverlays}
            </div>

            <div className="mt-3">
              {priceExportButtons}
            </div>
          </div>
        </main>
      )}
    </div>
  );
}
