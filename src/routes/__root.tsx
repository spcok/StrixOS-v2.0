import React, { useState, useEffect } from 'react';
import { createRootRouteWithContext, Outlet, useLocation, useNavigate, Navigate } from '@tanstack/react-router';
import { QueryClient, useQueryClient } from '@tanstack/react-query';
import { AuthProvider, useAuth } from '../lib/auth';
import { Sidebar } from '../components/layout/Sidebar';
import { Header } from '../components/layout/Header';
import { LoginScreen } from '../components/auth/LoginScreen';
import { supabase } from '../lib/supabase';
import { toast, Toaster } from 'sonner';

export const Route = createRootRouteWithContext<{
  queryClient: QueryClient;
}>()({
  component: RootComponent,
});

function RootComponent() {
  return (
    <AuthProvider>
      <AuthGuard />
      <Toaster position="top-center" richColors theme="light" />
    </AuthProvider>
  );
}

// ------------------------------------------------------------------
// GLOBAL REALTIME MULTIPLEXER
// ------------------------------------------------------------------
function GlobalSyncEngine() {
  const queryClient = useQueryClient();
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return; 

    const channel = supabase.channel('strix-global-multiplexer')
      .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
        const table = payload.table;
        
        const tableToKeyMap: Record<string, string[]> = {
          // RBAC Realtime Cache Invalidation
          'rbac_role_permissions': ['rbac_permissions', 'rbac_role_permissions_all'],
          'user_permission_overrides': ['rbac_permissions', 'rbac_user_overrides'],
          'rbac_matrix': ['rbac_matrix', 'rbac_permissions'],
          'users': ['internal_users', 'userProfile', 'rbac_permissions'],

          // Operational Data
          'daily_logs': ['daily_logs', 'weekly_compliance_audit'],
          'animals': ['animals'],
          'external_directory': ['external_directory'],
          'safety_drills': ['safety_drills'],
          'shifts': ['shifts_data'],
          'timesheets': ['timesheets', 'my_active_shift', 'active_timesheets_rollcall'],
          'isolation_logs': ['isolation_logs_complete'],
          'vouchers': ['vouchers', 'vouchers_list', 'all_vouchers_directory'],
          'events_calendar': ['events_ledger_management', 'operational_calendar'],
          'event_commercials': ['events_ledger_management'],
          'event_staff_allocations': ['events_ledger_management'],
          'events_animals': ['events_ledger_management'],
          'feed_logs': ['feeds', 'feed_logs', 'weekly_compliance_audit', 'husbandry_logs_feed'],
          'weight_logs': ['weights', 'weight_logs', 'weekly_compliance_audit', 'husbandry_logs_feed'],
          'feeding_schedules': ['feeds', 'feeding_schedules', 'weekly_compliance_audit', 'husbandry_logs_feed'],
          'temperature_logs': ['temperatures', 'temperature_logs', 'weekly_compliance_audit'],
          'mist_logs': ['mist_logs', 'weekly_compliance_audit']
        };

        const keysToInvalidate = tableToKeyMap[table];
        if (keysToInvalidate) {
          keysToInvalidate.forEach(key => {
            queryClient.invalidateQueries({ queryKey: [key] });
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, session]);

  return null;
}

// ------------------------------------------------------------------
// ROUTE GATEKEEPER & ACCESS DEFLECTOR (Item-by-Item Granular Gates)
// ------------------------------------------------------------------
function RouteGatekeeper({ children }: { children: React.ReactNode }) {
  const { hasPermission, profile, isLocked, isLoading } = useAuth();
  const location = useLocation();

  const path = location.pathname;
  
  const routePermissions: Record<string, string | string[]> = {
    // Husbandry & Welfare (Granular item-by-item routes)
    '/husbandry/daily-logs': ['husbandry:logs_view', 'husbandry:read'],
    '/husbandry/rounds': ['husbandry:rounds_view', 'husbandry:read'],
    '/husbandry/feeding': ['husbandry:feeding_view', 'husbandry:read'],
    '/husbandry/missing-records': ['husbandry:compliance_view', 'husbandry:read'],
    '/husbandry/import': ['husbandry:import', 'husbandry:write'],

    // Clinical & Veterinary
    '/clinical/records': ['clinical:records_view', 'clinical:read'],
    '/clinical/medications': ['clinical:mar_view', 'clinical:read'],
    '/clinical/isolation': ['clinical:isolation_view', 'clinical:read'],
    '/clinical/mortality': ['clinical:mortality_view', 'clinical:read'],
    '/clinical': ['clinical:records_view', 'clinical:mar_view', 'clinical:read'],

    // Operations & Logistics (Calendar + Bookings Groundwork)
    '/logistics/calendar': ['calendar:view_schedule', 'calendar:view_assigned', 'events:manage', 'events:view'],
    '/logistics/events': ['events:manage', 'events:view'],
    '/logistics/vouchers': ['vouchers:view', 'vouchers:scan', 'vouchers:manage', 'vouchers:read'],
    '/logistics/internal-movements': ['transfers:internal', 'transfers:read', 'animals:view'],
    '/logistics/external-transfers': ['transfers:external', 'transfers:read', 'animals:manage'],

    // Safety & Facilities
    '/safety/drills': ['safety:drills_view', 'safety:read'],
    '/safety/incidents': ['safety:incidents_view', 'safety:read'],
    '/safety/first-aid': ['safety:firstaid_view', 'safety:read'],
    '/safety/maintenance': ['safety:maintenance_view', 'safety:read'],
    '/safety': ['safety:drills_view', 'safety:incidents_view', 'safety:read'],

    // Staff Hub
    '/staff/rota': ['rota:view', 'rota:manage', 'hr:read'],
    '/staff/shifts': ['shifts:view_self', 'timesheet:self', 'rota:manage'],
    '/staff/leave': ['leave:view', 'leave:approve', 'hr:read'],
    '/staff/timesheets': ['timesheet:self', 'timesheet:manage', 'hr:read'],

    // Governance & Settings
    '/settings/rbac': ['rbac:manage', 'admin:settings'],
    '/settings/directory': ['admin:users', 'admin:settings'],
    '/settings': ['admin:settings', 'rbac:manage'],
    '/reports': ['reports:view', 'admin:settings'],
  };

  const matchedPerms = Object.entries(routePermissions)
    .sort(([a], [b]) => b.length - a.length)
    .find(([routePrefix]) => path.startsWith(routePrefix))?.[1];

  const hasAccess = matchedPerms
    ? hasPermission(matchedPerms)
    : true;

  const isDenied = !isLoading && profile && !isLocked && !hasAccess;

  useEffect(() => {
    if (isDenied) {
      console.warn(`[Route Gatekeeper] Access denied for path: ${path}. Required:`, matchedPerms);
      toast.error('Unauthorized Access: You do not have permission to view this module.');
    }
  }, [isDenied, path, matchedPerms]);

  if (isDenied) {
    return <Navigate to="/" replace={true} />;
  }

  return <>{children}</>;
}

// ------------------------------------------------------------------
// LAYOUT GATEKEEPER WITH UI SHELL
// ------------------------------------------------------------------
function AuthGuard() {
  const { session, isLoading } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  // Detect if user is accessing the password reset flow or landing with recovery hash
  const isRecoveryHash = typeof window !== 'undefined' && 
    (window.location.hash.includes('type=recovery') || window.location.search.includes('type=recovery'));
  const isResetPasswordRoute = location.pathname.startsWith('/reset-password') || isRecoveryHash;

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        navigate({ to: '/reset-password' });
      }
    });

    if (isRecoveryHash && location.pathname !== '/reset-password') {
      navigate({ to: '/reset-password' });
    }

    return () => subscription.unsubscribe();
  }, [navigate, isRecoveryHash, location.pathname]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#0A0B0E] flex items-center justify-center">
        <div className="animate-pulse text-emerald-500 font-black tracking-widest uppercase">
          Initializing Engine...
        </div>
      </div>
    );
  }

  // Password reset bypass: Allow /reset-password without app shell or login screen
  if (isResetPasswordRoute) {
    return (
      <main className="min-h-screen w-full bg-slate-950">
        <Outlet />
      </main>
    );
  }

  if (!session) return <LoginScreen />;

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 font-sans antialiased relative overflow-hidden">
      <GlobalSyncEngine />
      <Sidebar isOpen={isSidebarOpen} onMobileClose={() => setIsSidebarOpen(false)} />
      
      <div className="flex flex-col flex-1 overflow-hidden transition-all duration-300">
        <Header onMenuClick={() => setIsSidebarOpen(!isSidebarOpen)} />
        <main className="flex-1 overflow-auto p-6 relative">
          <RouteGatekeeper>
            <Outlet />
          </RouteGatekeeper>
        </main>
      </div>
    </div>
  );
}

export default Route;