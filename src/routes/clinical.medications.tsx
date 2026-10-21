import React, { useState, useMemo, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQuery,
  useMutation,
  useQueryClient,
  queryOptions,
} from '@tanstack/react-query';
import {
  Pill,
  Activity,
  WifiOff,
  FileText,
  Plus,
  Loader2,
  ShieldAlert,
  Search,
  CheckCircle2,
  Printer,
  Trash2,
  Edit2,
  AlertTriangle,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import PrescriptionFormModal from '../components/medical/PrescriptionFormModal';
import { marExportService } from '../services/marExportService';

// ------------------------------------------------------------------
// STRICT OFFLINE QUERY OPTIONS
// ------------------------------------------------------------------
const getActivePrescriptionsOptions = () =>
  queryOptions({
    queryKey: ['prescriptions', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('prescriptions')
        .select(
          '*, animals(id, name, species, location, gender, flying_weight, weight_unit, special_requirements, date_of_birth, status)'
        )
        .eq('is_deleted', false)
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    networkMode: 'offlineFirst',
  });

const getTodayAdministrationsOptions = (dateStr: string) =>
  queryOptions({
    queryKey: ['medication_administrations', dateStr],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medication_administrations')
        .select('*')
        .eq('scheduled_date', dateStr)
        .eq('is_deleted', false);
      if (error) throw error;
      return data || [];
    },
    staleTime: 1000 * 60 * 2,
    networkMode: 'offlineFirst',
  });

// ------------------------------------------------------------------
// ROUTE CONFIGURATION
// ------------------------------------------------------------------
export const Route = createFileRoute('/clinical/medications')({
  loader: async ({ context: { queryClient } }) => {
    if (queryClient) {
      // @ts-ignore
      await queryClient.ensureQueryData(getActivePrescriptionsOptions());
    }
  },
  component: MedicationsModule,
});

// ------------------------------------------------------------------
// MAIN COMPONENT
// ------------------------------------------------------------------
function MedicationsModule() {
  const queryClient = useQueryClient();
  const { user, profile, hasPermission } = useAuth();

  const canWriteClinical = hasPermission([
    'clinical:records_write',
    'clinical:write',
  ]);
  const canPrescribe = hasPermission([
    'clinical:prescribe',
    'clinical:vet',
    'clinical:write',
  ]);
  const canSignMAR = hasPermission([
    'clinical:mar_sign',
    'clinical:write',
  ]);

  const [activeTab, setActiveTab] = useState<
    'DIGITAL_MAR' | 'PRESCRIPTIONS' | 'HISTORY'
  >('DIGITAL_MAR');
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );

  const [isPrescriptionModalOpen, setIsPrescriptionModalOpen] = useState(false);
  const [editingPrescription, setEditingPrescription] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Delete Confirmation State
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    id: string;
    type: 'PRESCRIPTION' | 'ADMINISTRATION';
    title: string;
  } | null>(null);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Network State Listeners
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Realtime Cache Invalidation for MAR events
  useEffect(() => {
    const channel = supabase
      .channel('med_dispensary_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'medication_administrations' },
        () => {
          queryClient.invalidateQueries({
            queryKey: ['medication_administrations'],
          });
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'prescriptions' },
        () => {
          queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
          queryClient.invalidateQueries({ queryKey: ['active_mars'] });
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  // Fetch Data
  const { data: prescriptions = [], isLoading: loadingRx } = useQuery(
    getActivePrescriptionsOptions()
  );
  const { data: todayAdmins = [], isLoading: loadingAdmins } = useQuery(
    getTodayAdministrationsOptions(todayStr)
  );

  // Filter Active vs Completed Prescriptions
  const activePrescriptions = useMemo(() => {
    return prescriptions.filter((p: any) => p.status === 'ACTIVE');
  }, [prescriptions]);

  const historicalPrescriptions = useMemo(() => {
    return prescriptions.filter((p: any) => p.status !== 'ACTIVE');
  }, [prescriptions]);

  // Filter based on search query
  const displayList = useMemo(() => {
    const list =
      activeTab === 'HISTORY' ? historicalPrescriptions : activePrescriptions;
    if (!searchQuery) return list;
    const q = searchQuery.toLowerCase();
    return list.filter((p: any) => {
      const animal = p.animals || {};
      return (
        animal.name?.toLowerCase().includes(q) ||
        animal.species?.toLowerCase().includes(q) ||
        p.medication_name?.toLowerCase().includes(q)
      );
    });
  }, [
    activeTab,
    activePrescriptions,
    historicalPrescriptions,
    searchQuery,
  ]);

  // Mutations
  const signDoseMutation = useMutation({
    mutationFn: async (rxId: string) => {
      if (!isOnline) {
        throw new Error(
          'Medication administration is locked offline to prevent double-dosing.'
        );
      }
      if (!user?.id) throw new Error('Authentication required.');

      const { error } = await supabase
        .from('medication_administrations')
        .insert({
          prescription_id: rxId,
          animal_id: activePrescriptions.find((p: any) => p.id === rxId)
            ?.animal_id,
          scheduled_date: todayStr,
          dose_slot: 1, // Basic support for now, future expansion for BID/TID
          status: 'GIVEN',
          administered_by: user.id,
          created_by: user.id,
          updated_by: user.id,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['medication_administrations'],
      });
      toast.success('Dose administered and signed off.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const revokePrescriptionMutation = useMutation({
    mutationFn: async (rxId: string) => {
      if (!isOnline) {
        throw new Error(
          'Network connection required to revoke active prescriptions.'
        );
      }
      const { error } = await supabase
        .from('prescriptions')
        .update({ status: 'REVOKED', updated_by: user?.id })
        .eq('id', rxId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['active_mars'] });
      toast.success('Prescription safely revoked and archived.');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async (adminId: string) => {
      if (!isOnline) {
        throw new Error(
          'Network connection required to delete administration logs.'
        );
      }
      const { error } = await supabase
        .from('medication_administrations')
        .update({ is_deleted: true, updated_by: user?.id })
        .eq('id', adminId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['medication_administrations'],
      });
      toast.success('Dose signature voided.');
      setDeleteConfirmation(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleOpenNewOrder = () => {
    setEditingPrescription(null);
    setIsPrescriptionModalOpen(true);
  };

  const handleEditOrder = (rx: any) => {
    setEditingPrescription(rx);
    setIsPrescriptionModalOpen(true);
  };

  const handlePrintUnifiedMar = async (
    rx: any,
    setLoading: (b: boolean) => void
  ) => {
    if (!isOnline) {
      toast.error(
        'Offline: Document generation requires an active network connection.'
      );
      return;
    }

    setLoading(true);
    try {
      const patientPrescriptions = activePrescriptions.filter(
        (p: any) => p.animal_id === rx.animal_id
      );
      await marExportService.exportUnifiedMAR(
        rx.animals,
        patientPrescriptions,
        profile?.name || 'Staff',
        user?.id || 'Unknown-ID'
      );
      toast.success('MAR Document successfully generated.');
    } catch (error: any) {
      console.error(error);
      toast.error(`Failed to generate DOCX MAR chart: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const tabs = [
    { id: 'DIGITAL_MAR', label: "Today's MAR", icon: Activity },
    { id: 'PRESCRIPTIONS', label: 'Active Orders', icon: Pill },
    { id: 'HISTORY', label: 'Medication History', icon: FileText },
  ] as const;

  return (
    <div className="h-[calc(100vh-6rem)] flex flex-col space-y-5 lg:space-y-6 animate-in fade-in duration-500 w-full font-sans text-left">
      {/* --- OFFLINE WARNING BANNER --- */}
      {!isOnline && (
        <div className="bg-rose-50 border-2 border-rose-300 p-4 rounded-2xl shadow-2xs flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3 text-rose-900">
            <ShieldAlert size={24} className="text-rose-600 shrink-0" />
            <div className="flex flex-col">
              <span className="font-black uppercase tracking-widest text-xs text-rose-600">
                Clinical Network Disconnected
              </span>
              <span className="text-sm font-bold mt-0.5">
                Medication administration is locked to prevent double-dosing.
                Please reconnect to WiFi.
              </span>
            </div>
          </div>
        </div>
      )}

      {/* --- BLOCK A: HEADER RIBBON --- */}
      <div className="flex justify-between items-start w-full mb-2 lg:mb-4 shrink-0">
        <div className="shrink-0 pr-4 flex flex-col gap-1.5 lg:gap-2">
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight leading-none">
            Clinical Dispensary
          </h1>
          <p className="text-[10px] lg:text-xs text-slate-500 font-bold uppercase tracking-widest">
            Prescription Management &amp; Digital MAR
          </p>
        </div>

        {/* Action Button */}
        {canPrescribe && (
          <button
            type="button"
            onClick={handleOpenNewOrder}
            disabled={!isOnline}
            className="flex items-center justify-center gap-2 bg-slate-900 hover:bg-slate-800 text-white px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest transition-all shadow-2xs active:scale-95 shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Plus size={14} className="text-blue-400 hidden sm:block" />
            <Pill size={14} className="text-blue-400 sm:hidden" />
            <span className="hidden sm:block">Provision Order</span>
            <span className="sm:hidden">New Rx</span>
          </button>
        )}
      </div>

      {/* --- BLOCK B: CONTROL DECK & TABS --- */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-2.5 w-full bg-slate-50/80 p-2 rounded-2xl border border-slate-200 shrink-0 text-left">
        <div className="relative flex-1 min-w-[200px]">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={14}
          />
          <input
            type="text"
            placeholder="Search specimen name, species, or drug..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 shadow-2xs"
          />
        </div>

        <div className="grid grid-cols-3 lg:flex lg:gap-2 shrink-0 gap-1.5 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-2 lg:px-5 py-2 lg:py-2.5 rounded-xl text-[10px] lg:text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all shadow-2xs flex items-center justify-center gap-2 cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-slate-900 text-white border border-slate-800'
                  : 'bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 border border-slate-200'
              }`}
            >
              <tab.icon
                size={16}
                className={
                  activeTab === tab.id
                    ? 'text-blue-400'
                    : 'text-slate-400 hidden lg:block'
                }
              />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* --- BLOCK C: MAIN DATA VIEW --- */}
      <div className="flex flex-col flex-1 min-h-0 relative bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        {(loadingRx || loadingAdmins) && (
          <div className="absolute inset-0 bg-white/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-100">
              <Loader2 className="animate-spin text-blue-600" size={24} />
              <span className="text-sm font-bold text-slate-700">
                Syncing Dispensary...
              </span>
            </div>
          </div>
        )}

        <div className="p-3.5 bg-slate-50/80 border-b border-slate-100 flex justify-between items-center shrink-0">
          <h4 className="text-xs font-black text-slate-700 uppercase tracking-widest flex items-center gap-2">
            {activeTab === 'DIGITAL_MAR' && (
              <>
                <Activity size={14} className="text-emerald-600" /> Today's
                Administration Queue
              </>
            )}
            {activeTab === 'PRESCRIPTIONS' && (
              <>
                <Pill size={14} className="text-blue-600" /> Active
                Prescription Orders
              </>
            )}
            {activeTab === 'HISTORY' && (
              <>
                <FileText size={14} className="text-slate-600" /> Medication
                Ledger
              </>
            )}
          </h4>
          <span className="text-[10px] font-mono font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-slate-600">
            {displayList.length} Orders
          </span>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4">
          {displayList.length === 0 && !(loadingRx || loadingAdmins) ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3 min-h-[200px]">
              <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center border border-slate-200 shadow-2xs">
                <Search size={24} className="text-slate-400" />
              </div>
              <p className="text-xs font-black uppercase tracking-widest">
                No Prescriptions Found
              </p>
            </div>
          ) : (
            displayList.map((rx: any) => {
              const animal = rx.animals;
              const hasGivenDoseToday = todayAdmins.find(
                (a: any) => a.prescription_id === rx.id && a.status === 'GIVEN'
              );

              return (
                <div
                  key={rx.id}
                  className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs hover:border-slate-300 transition-all flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4"
                >
                  <div className="flex-1 w-full lg:w-auto">
                    <div className="flex items-center justify-between lg:justify-start gap-2 mb-1.5">
                      <h3 className="text-sm font-black text-slate-900 tracking-tight">
                        {animal?.name || 'Unknown Patient'}
                      </h3>
                      <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-700 border border-slate-200">
                        {animal?.location || 'Isolation'}
                      </span>
                      {rx.is_prn && (
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest bg-amber-100 text-amber-800 border border-amber-200">
                          PRN (As Needed)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-500 font-medium truncate mb-2">
                      {animal?.species} &bull; ID:{' '}
                      {animal?.ring_number || 'N/A'}
                    </p>

                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-blue-50 text-blue-700 rounded-xl border border-blue-100 shrink-0">
                        <Pill size={20} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900 truncate">
                          {rx.medication_name}
                        </p>
                        <p className="text-xs font-semibold text-slate-600 truncate mt-0.5">
                          {rx.dosage} &bull; {rx.route} &bull; {rx.frequency}
                        </p>
                      </div>
                    </div>
                  </div>

                  {activeTab === 'DIGITAL_MAR' && (
                    <div className="w-full lg:w-auto shrink-0 flex justify-end">
                      {hasGivenDoseToday ? (
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-emerald-700 bg-emerald-50 border border-emerald-200">
                            <CheckCircle2 size={16} /> Signed
                          </span>
                          {canSignMAR && isOnline && (
                            <button
                              type="button"
                              onClick={() =>
                                setDeleteConfirmation({
                                  isOpen: true,
                                  id: hasGivenDoseToday.id,
                                  type: 'ADMINISTRATION',
                                  title: `Void signature for ${rx.medication_name}?`,
                                })
                              }
                              disabled={deleteAdminMutation.isPending}
                              className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                              title="Void Signature"
                            >
                              {deleteAdminMutation.isPending ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Trash2 size={16} />
                              )}
                            </button>
                          )}
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => signDoseMutation.mutate(rx.id)}
                          disabled={
                            !isOnline ||
                            !canSignMAR ||
                            signDoseMutation.isPending
                          }
                          className="w-full lg:w-auto px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-2xs flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                        >
                          {signDoseMutation.isPending ? (
                            <Loader2 size={16} className="animate-spin" />
                          ) : (
                            <CheckCircle2 size={16} />
                          )}
                          <span>Sign Dose</span>
                        </button>
                      )}
                    </div>
                  )}

                  {activeTab === 'PRESCRIPTIONS' && (
                    <div className="w-full lg:w-auto flex items-center justify-end gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          const btn = e.currentTarget;
                          handlePrintUnifiedMar(rx, (loading) => {
                            if (loading) {
                              btn.innerHTML =
                                '<svg class="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>';
                            } else {
                              btn.innerHTML =
                                '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="lucide lucide-printer"><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 9V3a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v6"/><rect width="12" height="8" x="6" y="14"/></svg>';
                            }
                          });
                        }}
                        className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                        title="Print Weekly MAR Chart"
                      >
                        <Printer size={16} />
                      </button>

                      {canPrescribe && isOnline && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleEditOrder(rx)}
                            className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                            title="Amend Prescription"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              revokePrescriptionMutation.mutate(rx.id)
                            }
                            disabled={revokePrescriptionMutation.isPending}
                            className="p-2.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 rounded-xl transition-all cursor-pointer shadow-2xs"
                            title="Revoke & Archive Prescription"
                          >
                            {revokePrescriptionMutation.isPending ? (
                              <Loader2 size={16} className="animate-spin" />
                            ) : (
                              <Trash2 size={16} />
                            )}
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* --- CONFIRMATION DELETE MODAL --- */}
      {deleteConfirmation && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 font-sans text-left animate-in fade-in duration-150">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight leading-tight">
                  {deleteConfirmation.title}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">
                  Action Cannot Be Undone
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 font-medium leading-relaxed">
              Are you sure you want to void this signature and remove it from
              the permanent clinical administration log?
            </p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setDeleteConfirmation(null)}
                disabled={deleteAdminMutation.isPending}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black uppercase tracking-widest transition-all cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteAdminMutation.mutate(deleteConfirmation.id)}
                disabled={deleteAdminMutation.isPending}
                className="flex items-center justify-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-2xs active:scale-95 cursor-pointer disabled:opacity-50"
              >
                {deleteAdminMutation.isPending ? (
                  <Loader2 size={13} className="animate-spin" />
                ) : (
                  <Trash2 size={13} />
                )}
                <span>Confirm Void</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- PRESCRIPTION FORM MODAL --- */}
      {isPrescriptionModalOpen && (
        <PrescriptionFormModal
          isOpen={isPrescriptionModalOpen}
          onClose={() => setIsPrescriptionModalOpen(false)}
          initialData={editingPrescription}
        />
      )}
    </div>
  );
}

export default MedicationsModule;