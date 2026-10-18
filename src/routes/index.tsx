import { createFileRoute, Link } from '@tanstack/react-router';
import { ShieldCheck, Eye, Settings } from 'lucide-react';
import { useAuth } from '../lib/auth';

export const Route = createFileRoute('/')({
  component: DashboardPlaceholder,
});

function DashboardPlaceholder() {
  const { profile, hasPermission } = useAuth();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="bg-white border border-slate-200 rounded-3xl p-6 sm:p-8 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-900 tracking-tight">
              Welcome to StrixOS 2.0, {profile?.name?.split(' ')[0] || 'Keeper'}
            </h1>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Role Clearance: <strong className="text-emerald-600">{profile?.role?.replace(/_/g, ' ') || 'STAFF'}</strong> &bull; Phase 1 Core Identity &amp; Accessibility Active
            </p>
          </div>
        </div>

        <Link
          to="/accessibility"
          className="px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 transition-colors self-start sm:self-auto shrink-0"
        >
          <Eye size={15} className="text-emerald-400" />
          <span>Display &amp; Comfort Studio</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Link
          to="/accessibility"
          className="bg-white border border-slate-200 hover:border-emerald-500 rounded-3xl p-6 shadow-xs transition-all group"
        >
          <div className="w-10 h-10 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
            <Eye size={20} />
          </div>
          <h2 className="text-base font-bold text-slate-900">
            Personal Display &amp; Dyslexia Settings
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Adjust Page Zoom (95%–125%), OpenDyslexic / Atkinson Hyperlegible fonts, Irlen Coloured Overlays, and Biometric Quick-Unlock.
          </p>
        </Link>

        {hasPermission(['admin:settings', 'admin:users', 'rbac:manage']) && (
          <Link
            to="/settings"
            className="bg-white border border-slate-200 hover:border-indigo-500 rounded-3xl p-6 shadow-xs transition-all group"
          >
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-3 group-hover:scale-105 transition-transform">
              <Settings size={20} />
            </div>
            <h2 className="text-base font-bold text-slate-900">
              System Governance &amp; RBAC Settings
            </h2>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Manage staff directory, role permissions, organization profile, and operational lists.
            </p>
          </Link>
        )}
      </div>
    </div>
  );
}

export default DashboardPlaceholder;