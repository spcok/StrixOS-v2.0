import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Menu,
  UserCircle,
  PlayCircle,
  StopCircle,
  Loader2,
  CloudOff,
  CloudUpload,
  Eye,
  Type,
  ZoomIn,
  Lock,
  Fingerprint,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth, type UIPreferences } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import { getLocalDateString } from '../../lib/utils';
import { ResponsiveModal } from '../ui/ResponsiveModal';

interface HeaderProps {
  onMenuClick: () => void;
}

const OVERLAY_PRESETS = [
  { id: 'none', label: 'None (Crisp White)', color: 'transparent' },
  { id: 'cream', label: 'Warm Cream', color: '#fdf6e3' },
  { id: 'yellow', label: 'Irlen Yellow', color: '#fef08a' },
  { id: 'mint', label: 'Mint Green', color: '#bbf7d0' },
  { id: 'sky', label: 'Sky Blue', color: '#bae6fd' },
  { id: 'rose', label: 'Soft Rose', color: '#fecdd3' },
  { id: 'lavender', label: 'Soft Lavender', color: '#e9d5ff' },
] as const;

export function Header({ onMenuClick }: HeaderProps) {
  const queryClient = useQueryClient();
  const {
    user,
    profile,
    uiPreferences,
    updateUIPreferences,
    lockSession,
    registerBiometrics,
  } = useAuth();

  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [pausedCount, setPausedCount] = useState(0);
  const [isA11yModalOpen, setIsA11yModalOpen] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const mutationCache = queryClient.getMutationCache();
    const updatePausedCount = () => {
      const count = mutationCache.getAll().filter((m) => m.state.isPaused).length;
      setPausedCount(count);
    };

    updatePausedCount();
    const unsubscribe = mutationCache.subscribe(updatePausedCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, [queryClient]);

  // Direct Supabase query for active shift (gracefully returns null if table not yet created)
  const { data: activeShift, isLoading: isLoadingShift } = useQuery({
    queryKey: ['my_active_shift', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('timesheets')
        .select('id, clock_in_time, shift_date')
        .eq('user_id', user.id)
        .is('clock_out_time', null)
        .eq('is_deleted', false)
        .order('clock_in_time', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) return null;
      return data;
    },
    enabled: Boolean(user?.id),
  });

  const clockInMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error('Not authenticated');
      const now = new Date();
      const { error } = await supabase.from('timesheets').insert({
        user_id: user.id,
        shift_date: getLocalDateString(now),
        clock_in_time: now.toISOString(),
        status: 'ACTIVE',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_active_shift'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['active_timesheets_rollcall'] });
      toast.success('Clocked in for shift.');
    },
    onError: (err: Error) => {
      toast.error(`Clock-in unavailable: ${err.message}`);
    },
  });

  const clockOutMutation = useMutation({
    mutationFn: async (shiftId: string) => {
      const now = new Date();
      const clockInDate = activeShift?.clock_in_time
        ? new Date(activeShift.clock_in_time)
        : now;
      const totalHours = Math.max(
        0,
        Number(((now.getTime() - clockInDate.getTime()) / (1000 * 60 * 60)).toFixed(2))
      );

      const { error } = await supabase
        .from('timesheets')
        .update({
          clock_out_time: now.toISOString(),
          total_hours: totalHours,
          status: 'COMPLETED',
        })
        .eq('id', shiftId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my_active_shift'] });
      queryClient.invalidateQueries({ queryKey: ['timesheets'] });
      queryClient.invalidateQueries({ queryKey: ['active_timesheets_rollcall'] });
      toast.success('Clocked out of shift.');
    },
    onError: (err: Error) => {
      toast.error(`Clock-out failed: ${err.message}`);
    },
  });

  return (
    <>
      <header className="bg-white border-b border-slate-200 h-16 md:h-20 flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shrink-0">
        {/* LEFT SIDE: Menu Toggle & Welcome Text */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <button
            type="button"
            onClick={onMenuClick}
            className="p-2.5 -ml-2 text-slate-600 hover:text-slate-900 transition-colors rounded-xl hover:bg-slate-100 cursor-pointer"
            title="Toggle Navigation Menu"
          >
            <Menu size={22} />
          </button>

          <div className="hidden sm:block">
            <h2 className="text-sm md:text-base font-bold text-slate-800 tracking-tight">
              {activeShift ? 'Active Shift:' : 'Welcome back,'}{' '}
              <span className="text-emerald-600">
                {profile?.name?.split(' ')[0] || 'Staff'}
              </span>
            </h2>
          </div>
        </div>

        {/* RIGHT SIDE: Offline Telemetry, Accessibility Drawer, Lock, Clock In/Out & Profile */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0 justify-end">
          {/* Offline / Queue Indicator */}
          {!isOnline ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold shadow-xs">
              <CloudOff size={14} className="shrink-0" />
              <span className="hidden sm:inline">Offline</span>
              {pausedCount > 0 && (
                <span className="ml-1 bg-rose-200 text-rose-800 px-1.5 py-0.5 rounded-full text-[11px]">
                  {pausedCount}
                </span>
              )}
            </div>
          ) : pausedCount > 0 ? (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-xl text-xs font-bold shadow-xs">
              <CloudUpload size={14} className="animate-pulse shrink-0" />
              <span className="hidden sm:inline">Syncing</span>
              <span className="ml-1 bg-amber-200 text-amber-800 px-1.5 py-0.5 rounded-full text-[11px]">
                {pausedCount}
              </span>
            </div>
          ) : null}

          {/* Accessibility & Visual Comfort Button */}
          <button
            type="button"
            onClick={() => setIsA11yModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer shrink-0"
            title="Accessibility, Zoom & Coloured Overlays"
          >
            <Eye size={15} className="text-emerald-600 shrink-0" />
            <span className="hidden lg:inline">Display &amp; Comfort</span>
          </button>

          {/* Quick Soft-Lock Button */}
          {(profile?.pin || profile?.biometric_credential_id) && (
            <button
              type="button"
              onClick={lockSession}
              className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors cursor-pointer shrink-0"
              title="Lock Screen (PIN / Biometrics)"
            >
              <Lock size={15} />
            </button>
          )}

          {/* CLOCK IN / OUT BUTTON */}
          <div className="flex items-center shrink-0">
            {isLoadingShift ? (
              <div className="px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-center min-w-[90px]">
                <Loader2 size={14} className="animate-spin text-slate-400" />
              </div>
            ) : activeShift ? (
              <button
                type="button"
                onClick={() => clockOutMutation.mutate(activeShift.id)}
                disabled={clockOutMutation.isPending}
                className="group flex items-center gap-1.5 px-3.5 py-2 bg-rose-50 border border-rose-200 text-rose-700 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {clockOutMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin shrink-0" />
                ) : (
                  <StopCircle size={14} className="shrink-0" />
                )}
                <span>Clock Out</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => clockInMutation.mutate()}
                disabled={clockInMutation.isPending}
                className="group flex items-center gap-1.5 px-3.5 py-2 bg-indigo-50 border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white rounded-xl text-xs font-bold transition-all shadow-xs disabled:opacity-50 whitespace-nowrap cursor-pointer"
              >
                {clockInMutation.isPending ? (
                  <Loader2 size={14} className="animate-spin shrink-0" />
                ) : (
                  <PlayCircle size={14} className="shrink-0" />
                )}
                <span>Clock In</span>
              </button>
            )}
          </div>

          {/* USER AVATAR */}
          <div className="hidden sm:flex items-center gap-3 pl-3 md:pl-4 border-l border-slate-200 shrink-0">
            <div className="hidden md:block text-right">
              <p className="text-xs font-bold text-slate-900 truncate">
                {profile?.name || 'Staff Member'}
              </p>
              <p className="text-[11px] font-semibold text-slate-500">
                {profile?.role?.replace(/_/g, ' ') || 'Staff'}
              </p>
            </div>
            <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-500 overflow-hidden shrink-0">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.name || 'User'}
                  className="w-full h-full object-cover"
                />
              ) : (
                <UserCircle size={28} strokeWidth={1.5} />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ACCESSIBILITY, PAGE ZOOM & IRLEN COLOURED OVERLAY MODAL */}
      <ResponsiveModal
        isOpen={isA11yModalOpen}
        onClose={() => setIsA11yModalOpen(false)}
        title="Display, Dyslexia & Visual Comfort"
        subtitle="Personalised settings saved automatically to your staff profile"
        icon={<Eye size={18} />}
        maxWidth="lg"
      >
        <div className="space-y-6">
          {/* 1. Page Zoom */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <ZoomIn size={15} className="text-emerald-600" />
              Page Zoom &amp; Text Scaling ({uiPreferences.scale})
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
              {(['95%', '100%', '105%', '110%', '115%', '125%'] as const).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => updateUIPreferences({ scale: s })}
                  className={`py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                    uiPreferences.scale === s
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* 2. Reading Font Mode */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Type size={15} className="text-emerald-600" />
              Typography &amp; Dyslexia Font
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {
                    id: 'default',
                    name: 'Standard (Inter)',
                    desc: 'Crisp modern system font',
                  },
                  {
                    id: 'hyperlegible',
                    name: 'Atkinson Hyperlegible',
                    desc: 'Braille Institute high-clarity characters',
                  },
                  {
                    id: 'dyslexic',
                    name: 'OpenDyslexic',
                    desc: 'Weighted bottoms & anti-flip spacing',
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    updateUIPreferences({ font: f.id as UIPreferences['font'] })
                  }
                  className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                    uiPreferences.font === f.id
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <p className="text-xs font-bold">{f.name}</p>
                  <p
                    className={`text-[11px] mt-0.5 ${
                      uiPreferences.font === f.id ? 'text-slate-300' : 'text-slate-500'
                    }`}
                  >
                    {f.desc}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Coloured Overlays (Irlen Syndrome / Visual Stress) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Eye size={15} className="text-emerald-600" />
                Coloured Overlay Filter (Irlen Visual Stress)
              </label>
              {uiPreferences.overlayColor !== 'transparent' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-500">
                    Tint: {uiPreferences.overlayOpacity}%
                  </span>
                  <input
                    type="range"
                    min={10}
                    max={40}
                    value={uiPreferences.overlayOpacity}
                    onChange={(e) =>
                      updateUIPreferences({ overlayOpacity: Number(e.target.value) })
                    }
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
                  onClick={() => updateUIPreferences({ overlayColor: preset.color })}
                  className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 transition-all cursor-pointer ${
                    uiPreferences.overlayColor === preset.color
                      ? 'border-slate-900 ring-2 ring-slate-900/20 bg-white'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <span
                    className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                    style={{
                      backgroundColor:
                        preset.color === 'transparent' ? '#ffffff' : preset.color,
                    }}
                  />
                  <span>{preset.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 4. ADHD Focus Mode & Biometric Quick-Unlock */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() =>
                updateUIPreferences({ focusMode: !uiPreferences.focusMode })
              }
              className={`p-3.5 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer ${
                uiPreferences.focusMode
                  ? 'bg-emerald-950 text-white border-emerald-800'
                  : 'bg-slate-50 text-slate-800 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <div>
                <p className="text-xs font-bold flex items-center gap-1.5">
                  <Sparkles size={14} className="text-emerald-500" />
                  ADHD Focus Mode
                </p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    uiPreferences.focusMode ? 'text-emerald-200' : 'text-slate-500'
                  }`}
                >
                  Disables animations &amp; clutter
                </p>
              </div>
              <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-white/10">
                {uiPreferences.focusMode ? 'ON' : 'OFF'}
              </span>
            </button>

            <button
              type="button"
              onClick={registerBiometrics}
              className="p-3.5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-left flex items-center justify-between transition-all cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <Fingerprint size={15} className="text-indigo-600" />
                  Biometric Quick-Unlock
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {profile?.biometric_credential_id
                    ? 'FaceID / Fingerprint active'
                    : 'Link FaceID / TouchID / Fingerprint'}
                </p>
              </div>
            </button>
          </div>
        </div>
      </ResponsiveModal>
    </>
  );
}

export default Header;