import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { ShieldCheck, Sparkles, Eye, Type, ZoomIn } from 'lucide-react';
import { ResponsiveModal } from '../components/ui/ResponsiveModal';

export const Route = createFileRoute('/')({
  component: BootVerificationScreen,
});

const OVERLAY_PRESETS = [
  { id: 'none', label: 'None (White)', color: 'transparent' },
  { id: 'cream', label: 'Warm Cream', color: '#fdf6e3' },
  { id: 'yellow', label: 'Irlen Yellow', color: '#fef08a' },
  { id: 'mint', label: 'Mint Green', color: '#bbf7d0' },
  { id: 'sky', label: 'Sky Blue', color: '#bae6fd' },
  { id: 'rose', label: 'Soft Rose', color: '#fecdd3' },
  { id: 'lavender', label: 'Lavender', color: '#e9d5ff' },
] as const;

function BootVerificationScreen() {
  const [scale, setScale] = useState('100%');
  const [font, setFont] = useState<'default' | 'hyperlegible' | 'dyslexic'>('default');
  const [overlayColor, setOverlayColor] = useState('transparent');
  const [overlayOpacity, setOverlayOpacity] = useState(20);
  const [testModalOpen, setTestModalOpen] = useState(false);

  const applyScale = (newScale: string) => {
    setScale(newScale);
    document.documentElement.style.setProperty('--app-scale', newScale);
  };

  const applyFont = (newFont: 'default' | 'hyperlegible' | 'dyslexic') => {
    setFont(newFont);
    if (newFont === 'default') {
      document.documentElement.removeAttribute('data-font');
    } else {
      document.documentElement.setAttribute('data-font', newFont);
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      {/* Irlen Coloured Overlay Layer */}
      {overlayColor !== 'transparent' && (
        <div
          className="pointer-events-none fixed inset-0 z-[9999] mix-blend-multiply transition-colors duration-200"
          style={{
            backgroundColor: overlayColor,
            opacity: overlayOpacity / 100,
          }}
        />
      )}

      {/* Boot Status Card */}
      <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-tight">StrixOS 2.0 Clean-Room</h1>
            <p className="text-xs text-slate-400 font-semibold mt-0.5">
              Phase 0 Spine Active &bull; TanStack Table v9 &bull; Accessibility Engine Ready
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setTestModalOpen(true)}
          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold text-xs rounded-xl transition-all cursor-pointer shadow-sm"
        >
          Test Mobile/Desktop Modal
        </button>
      </div>

      {/* Live Accessibility & Personalisation Sandbox */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sparkles size={18} className="text-emerald-600" />
          <h2 className="text-base font-bold text-slate-900">
            Accessibility &amp; Neurodivergence Engine Test
          </h2>
        </div>

        {/* 1. Page Zoom */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <ZoomIn size={15} className="text-slate-400" />
            1. Page Zoom / UI Scaling ({scale})
          </label>
          <div className="flex flex-wrap gap-2">
            {['95%', '100%', '105%', '110%', '115%', '125%'].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => applyScale(s)}
                className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                  scale === s
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Dyslexia & Hyperlegible Fonts */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <Type size={15} className="text-slate-400" />
            2. Reading Font Mode
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              { id: 'default', name: 'Standard (Inter)', desc: 'Default crisp UI typography' },
              { id: 'hyperlegible', name: 'Atkinson Hyperlegible', desc: 'Braille Institute high-clarity characters' },
              { id: 'dyslexic', name: 'OpenDyslexic', desc: 'Weighted bottoms & anti-flip spacing' },
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => applyFont(f.id as any)}
                className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                  font === f.id
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <p className="text-xs font-bold">{f.name}</p>
                <p className={`text-[11px] mt-0.5 ${font === f.id ? 'text-slate-300' : 'text-slate-500'}`}>
                  {f.desc}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Coloured Overlays (Irlen Syndrome / Visual Stress) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Eye size={15} className="text-slate-400" />
              3. Coloured Overlay Filter (Visual Stress / Dyslexia)
            </label>
            {overlayColor !== 'transparent' && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-500">Tint Strength: {overlayOpacity}%</span>
                <input
                  type="range"
                  min={10}
                  max={40}
                  value={overlayOpacity}
                  onChange={(e) => setOverlayOpacity(Number(e.target.value))}
                  className="w-24 accent-slate-900 cursor-pointer"
                />
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {OVERLAY_PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => setOverlayColor(preset.color)}
                className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
                  overlayColor === preset.color
                    ? 'border-slate-900 ring-2 ring-slate-900/20 bg-white'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                  style={{ backgroundColor: preset.color === 'transparent' ? '#ffffff' : preset.color }}
                />
                <span>{preset.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Test Universal Android / iOS / Desktop Modal */}
      <ResponsiveModal
        isOpen={testModalOpen}
        onClose={() => setTestModalOpen(false)}
        title="Universal Modal Test"
        subtitle="Bottom sheet on Android/iPhone, centered dialog on iPad/Desktop"
      >
        <p className="text-sm text-slate-600 leading-relaxed">
          Notice how this modal automatically respects your active <strong>Font Mode</strong>,{' '}
          <strong>Page Zoom ({scale})</strong>, and <strong>Coloured Overlay</strong>!
        </p>
      </ResponsiveModal>
    </div>
  );
}