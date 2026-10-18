import { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  ClipboardList,
  ArrowLeft,
  Edit2,
  Archive,
  AlertTriangle,
  ShieldAlert,
  Scale,
  X,
  CalendarDays,
  Target,
  ThermometerSun,
  Droplets,
  MapPin,
  GitMerge,
  Presentation,
  Loader2,
  Skull,
  FileBadge,
  User,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { formatWeightDisplay, formatDisplayDate } from '../../lib/utils';
import type { Animal } from '../../types';
import { IUCNBadge } from './IUCNBadge';
import AnimalFormModal from './AnimalFormModal';
import HusbandryLogs from '../husbandry/HusbandryLogs';
import { SignGenerator } from './SignGenerator';
import { AnimalDocumentsTab } from './AnimalDocumentsTab';

export interface AnimalProfileProps {
  animalId?: string;
  id?: string;
  animal?: Animal | null;
  onBack?: () => void;
  onClose?: () => void;
}

export function AnimalProfile({
  animalId,
  id,
  animal: passedAnimal,
  onBack,
  onClose,
}: AnimalProfileProps) {
  const queryClient = useQueryClient();
  const { profile, hasPermission } = useAuth();
  const params = useParams({ strict: false }) as Record<string, string | undefined>;
  const effectiveId = passedAnimal?.id || animalId || id || params.id || '';
  const handleClose = onClose || onBack;

  const canReadDocs = hasPermission(['documents:view', 'documents:manage']);
  const canEditAnimal = hasPermission(['animals:edit', 'animals:manage']);
  const canManageAnimal = hasPermission('animals:manage');

  const [activeTab, setActiveTab] = useState<
    'profile' | 'husbandry' | 'documents' | 'events' | 'training'
  >('profile');
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isSignModalOpen, setIsSignModalOpen] = useState(false);

  const [isArchiveConfirmOpen, setIsArchiveConfirmOpen] = useState(false);
  const [archiveReason, setArchiveReason] = useState('Transferred');
  const [archiveDestination, setArchiveDestination] = useState('');
  const [archivedAt, setArchivedAt] = useState('');

  const [causeOfDeath, setCauseOfDeath] = useState('');
  const [necropsyNotes, setNecropsyNotes] = useState('');

  const isDeath = archiveReason === 'Died' || archiveReason === 'Euthanasia';
  const requiresDestination =
    archiveReason === 'Transferred' || archiveReason === 'Released to Wild';

  const handleOpenArchive = () => {
    setArchiveReason('Transferred');
    setArchiveDestination('');
    setCauseOfDeath('');
    setNecropsyNotes('');

    const now = new Date();
    const tzOffset = now.getTimezoneOffset() * 60000;
    const localISOTime = new Date(now.getTime() - tzOffset)
      .toISOString()
      .slice(0, 16);
    setArchivedAt(localISOTime);

    setIsArchiveConfirmOpen(true);
  };

  const { data: animal, isLoading } = useQuery({
    queryKey: ['animal_profile', effectiveId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animals')
        .select('*')
        .eq('id', effectiveId)
        .single();
      if (error) throw error;
      return data as Animal & Record<string, any>;
    },
    enabled: Boolean(effectiveId),
    initialData: passedAnimal
      ? (passedAnimal as Animal & Record<string, any>)
      : undefined,
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const dispositionDateISO = archivedAt
        ? new Date(archivedAt).toISOString()
        : new Date().toISOString();

      const { error: animalError } = await supabase
        .from('animals')
        .update({
          status: 'ARCHIVED',
          archive_reason: archiveReason,
          archive_destination: requiresDestination ? archiveDestination : null,
          archived_at: dispositionDateISO,
          archived_by: profile?.id || null,
        })
        .eq('id', effectiveId);

      if (animalError) throw animalError;

      if (isDeath) {
        const { error: deathError } = await supabase.from('death_logs').insert({
          animal_id: effectiveId,
          date_of_death: dispositionDateISO,
          manner_of_death: archiveReason,
          cause_of_death: causeOfDeath || null,
          necropsy_notes: necropsyNotes || null,
          logged_by: profile?.id || null,
        });

        if (deathError) {
          throw new Error(
            `Archived, but Mortality Log failed: ${deathError.message}`
          );
        }
      } else {
        const { error: transferError } = await supabase
          .from('external_transfers')
          .insert({
            animal_id: effectiveId,
            transfer_type: 'OUT',
            transfer_date: dispositionDateISO,
            entity_name: archiveDestination || 'Unknown / N/A',
            reason: archiveReason,
            authorized_by: profile?.id || null,
          });

        if (transferError) {
          throw new Error(
            `Archived, but Transfer Log failed: ${transferError.message}`
          );
        }
      }
    },
    onSuccess: () => {
      setIsArchiveConfirmOpen(false);
      toast.success(
        `${animal?.name || 'Animal'} has been formally dispositioned.`
      );
      queryClient.invalidateQueries({ queryKey: ['animals'] });
      queryClient.invalidateQueries({ queryKey: ['animal_profile'] });
      queryClient.invalidateQueries({ queryKey: ['external_transfers'] });
      queryClient.invalidateQueries({ queryKey: ['death_logs'] });
      if (handleClose) handleClose();
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Failed to process disposition.');
    },
  });

  if (!effectiveId) return null;

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500" />
      </div>
    );
  }

  if (!animal) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <AlertTriangle className="text-rose-500 mx-auto mb-3" size={32} />
          <h3 className="text-base font-black text-slate-900 uppercase tracking-tight mb-4">
            Profile Not Found
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="px-6 py-2.5 bg-slate-100 text-slate-700 rounded-xl font-bold uppercase tracking-wider text-xs hover:bg-slate-200 cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const tabs = [
    { id: 'profile', label: 'Profile Matrix', icon: FileText },
    { id: 'husbandry', label: 'Husbandry Logs', icon: ClipboardList },
    ...(canReadDocs
      ? [{ id: 'documents', label: 'Documents & CITES', icon: FileBadge }]
      : []),
    { id: 'events', label: 'Events', icon: CalendarDays },
    { id: 'training', label: 'Training', icon: Target },
  ] as const;

  return (
    <div className="fixed inset-0 z-40 bg-slate-900/65 backdrop-blur-xs overflow-y-auto pt-6 pb-12 px-4 custom-scrollbar">
      <div className="max-w-5xl mx-auto space-y-6 relative">
        {handleClose && (
          <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-slate-200">
            <button
              type="button"
              onClick={handleClose}
              className="flex items-center gap-2 hover:text-white transition-colors bg-slate-800/70 px-3.5 py-2 rounded-xl border border-slate-700 cursor-pointer"
            >
              <ArrowLeft size={15} /> Back To Dashboard
            </button>
          </div>
        )}

        {/* HEADER CARD */}
        <div className="bg-white rounded-3xl p-5 sm:p-6 flex flex-col md:flex-row gap-6 sm:gap-8 shadow-2xl">
          <div className="w-full md:w-[260px] h-[240px] md:h-[260px] shrink-0 rounded-2xl overflow-hidden bg-slate-100 shadow-inner border border-slate-200 flex items-center justify-center">
            {animal.profile_image_url ? (
              <img
                src={animal.profile_image_url}
                alt={animal.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                <User size={48} strokeWidth={1.2} />
                <span className="text-xs font-bold">No Photo Uploaded</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col pt-1 relative">
            <div className="flex items-center justify-end gap-2 mb-3 md:mb-0 md:absolute md:top-0 md:right-0">
              <button
                type="button"
                onClick={() => setIsSignModalOpen(true)}
                className="p-2.5 text-blue-600 border border-slate-200 rounded-xl hover:bg-blue-50 hover:border-blue-200 transition-all shadow-2xs bg-white cursor-pointer"
                title="Generate Signage"
              >
                <Presentation size={16} />
              </button>
              {canEditAnimal && (
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-2.5 text-emerald-600 border border-slate-200 rounded-xl hover:bg-emerald-50 hover:border-emerald-200 transition-all shadow-2xs bg-white cursor-pointer"
                  title="Edit Profile"
                >
                  <Edit2 size={16} />
                </button>
              )}
              {canManageAnimal && (
                <button
                  type="button"
                  onClick={handleOpenArchive}
                  className="p-2.5 border rounded-xl transition-all shadow-2xs text-rose-600 border-slate-200 bg-white hover:bg-rose-50 hover:border-rose-200 cursor-pointer"
                  title="Log Disposition"
                >
                  <Archive size={16} />
                </button>
              )}
              {handleClose && (
                <button
                  type="button"
                  onClick={handleClose}
                  className="p-2.5 text-slate-400 border border-slate-200 rounded-xl hover:bg-slate-100 hover:text-slate-700 transition-all shadow-2xs bg-white ml-1 cursor-pointer"
                >
                  <X size={16} />
                </button>
              )}
            </div>

            <div className="mb-6 md:pr-44">
              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mb-1.5 truncate">
                {animal.name}
              </h1>
              <p className="text-xs font-bold text-slate-500 font-mono tracking-wider uppercase flex flex-wrap items-center gap-2">
                <span>RING: {animal.ring_number || 'UN-RINGED'}</span>
                <span>|</span>
                <span>
                  CHIP: {animal.microchip_id || animal.microchip_number || 'NONE'}
                </span>
                {canReadDocs && animal.cites_annex && (
                  <>
                    <span>|</span>
                    <span className="text-amber-600 font-black">
                      CITES: {String(animal.cites_annex).replace(/_/g, ' ')}
                    </span>
                  </>
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-y-5 gap-x-4">
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Species
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {animal.species || 'Unknown'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Latin Name
                </span>
                <span className="text-sm font-bold text-slate-900 italic">
                  {animal.latin_name || 'N/A'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Gender
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {animal.gender || 'UNKNOWN'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Date of Birth
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {animal.is_dob_unknown
                    ? 'Unknown'
                    : animal.date_of_birth
                    ? formatDisplayDate(animal.date_of_birth)
                    : 'Unrecorded'}
                  {animal.is_dob_estimated && (
                    <span className="ml-1 text-xs text-slate-500 font-medium">
                      (Approx)
                    </span>
                  )}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Location
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {animal.location || 'Unassigned'}
                </span>
              </div>
              <div>
                <span className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Category
                </span>
                <span className="text-sm font-bold text-slate-900">
                  {animal.category || 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* TABS & BODY */}
        <div className="bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col min-h-[480px]">
          <div className="flex border-b border-slate-100 px-2 pt-2 bg-slate-50 shrink-0 overflow-x-auto custom-scrollbar">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-5 py-3.5 text-xs font-bold uppercase tracking-wider transition-all border-b-2 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'border-emerald-500 text-emerald-600 bg-white rounded-t-xl'
                      : 'border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100/50 rounded-t-xl'
                  }`}
                >
                  <tab.icon size={15} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="p-6 bg-white flex-1 overflow-y-auto custom-scrollbar">
            {activeTab === 'profile' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN */}
                <div className="lg:col-span-2 space-y-6">
                  {animal.critical_husbandry_notes && (
                    <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-5 shadow-2xs">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-rose-900 mb-3">
                        <AlertTriangle size={16} className="text-rose-600" />
                        Critical Husbandry Notes
                      </h3>
                      <div className="text-sm font-bold text-rose-800 space-y-2">
                        {String(animal.critical_husbandry_notes)
                          .split('\n')
                          .map((n, i) => (
                            <p key={i} className="flex gap-2.5">
                              <span className="text-rose-500 font-black">
                                &bull;
                              </span>
                              <span>{n.replace(/^- /, '')}</span>
                            </p>
                          ))}
                      </div>
                    </div>
                  )}

                  <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-2xs">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
                      <Scale size={16} className="text-emerald-600" />
                      Biometrics &amp; Weight Parameters
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="p-3.5 bg-white border border-slate-100 rounded-xl">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Target / Flying
                        </span>
                        <span className="text-lg font-black text-slate-800">
                          {formatWeightDisplay(
                            animal.flying_weight,
                            animal.weight_unit
                          ) || '--'}
                        </span>
                      </div>
                      <div className="p-3.5 bg-white border border-slate-100 rounded-xl">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Winter / Resting
                        </span>
                        <span className="text-lg font-black text-slate-800">
                          {formatWeightDisplay(
                            animal.winter_weight,
                            animal.weight_unit
                          ) || '--'}
                        </span>
                      </div>
                      <div className="p-3.5 bg-white border border-slate-100 rounded-xl">
                        <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                          Average Target
                        </span>
                        <span className="text-lg font-black text-slate-800">
                          {formatWeightDisplay(
                            animal.average_target_weight,
                            animal.weight_unit
                          ) || '--'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {animal.category === 'EXOTIC' && (
                    <div className="bg-orange-50/40 border border-orange-200 rounded-2xl p-5 shadow-2xs">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
                        <ThermometerSun size={16} className="text-orange-500" />
                        Environmental Parameters
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Day Target
                          </span>
                          <span className="text-sm font-black text-slate-800">
                            {animal.target_day_temp_c
                              ? `${animal.target_day_temp_c}°C`
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Night Target
                          </span>
                          <span className="text-sm font-black text-slate-800">
                            {animal.target_night_temp_c
                              ? `${animal.target_night_temp_c}°C`
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">
                            Humidity Range
                          </span>
                          <span className="text-sm font-black text-slate-800">
                            {animal.target_humidity_min_percent
                              ? `${animal.target_humidity_min_percent}%`
                              : '--'}{' '}
                            -{' '}
                            {animal.target_humidity_max_percent
                              ? `${animal.target_humidity_max_percent}%`
                              : '--'}
                          </span>
                        </div>
                        <div>
                          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1">
                            <Droplets size={12} /> Misting
                          </span>
                          <span className="text-sm font-black text-slate-800">
                            {animal.misting_not_required
                              ? 'Not Req.'
                              : animal.misting_frequency || '--'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {animal.description && (
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 shadow-2xs">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 mb-2">
                        Description &amp; Identifying Marks
                      </h3>
                      <p className="text-sm font-medium text-slate-700 leading-relaxed">
                        {animal.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* RIGHT COLUMN */}
                <div className="space-y-6">
                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
                      <ShieldAlert size={16} className="text-amber-500" />
                      Safety &amp; Status
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500">
                          Hazard Rating
                        </span>
                        <span
                          className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg ${
                            animal.hazard_rating === 'HIGH'
                              ? 'bg-rose-100 text-rose-700'
                              : animal.hazard_rating === 'MEDIUM'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {animal.hazard_rating || 'LOW'}
                        </span>
                      </div>
                      <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                        <span className="text-xs font-bold text-slate-500">
                          Conservation
                        </span>
                        <IUCNBadge
                          status={animal.red_list_status}
                          showLabel={false}
                        />
                      </div>
                      {canReadDocs && (
                        <>
                          <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                            <span className="text-xs font-bold text-slate-500">
                              CITES Status
                            </span>
                            <span
                              className={`text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-lg ${
                                animal.cites_annex === 'ANNEX_A'
                                  ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                  : animal.cites_annex === 'ANNEX_B'
                                  ? 'bg-amber-100 text-amber-700 border border-amber-200'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {animal.cites_annex
                                ? String(animal.cites_annex).replace(/_/g, ' ')
                                : 'NON-CITES'}
                            </span>
                          </div>
                          {animal.article_10_number && (
                            <div className="flex justify-between items-center pb-3 border-b border-slate-100">
                              <span className="text-xs font-bold text-slate-500">
                                Article 10 Cert
                              </span>
                              <span className="text-xs font-mono font-bold text-slate-800">
                                {animal.article_10_number}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                      {animal.is_venomous && (
                        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold uppercase tracking-wider p-2.5 rounded-xl text-center flex items-center justify-center gap-2">
                          <AlertTriangle size={14} /> Venomous Species
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs">
                    <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 mb-4">
                      <GitMerge size={16} className="text-purple-500" />
                      Lineage &amp; Origin
                    </h3>
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="block text-xs font-bold text-slate-400">
                            Sire ID
                          </span>
                          <span
                            className="text-xs font-mono text-slate-800 truncate block"
                            title={animal.sire_id || 'Unknown'}
                          >
                            {animal.sire_id
                              ? `${animal.sire_id.substring(0, 8)}...`
                              : 'Unknown'}
                          </span>
                        </div>
                        <div>
                          <span className="block text-xs font-bold text-slate-400">
                            Dam ID
                          </span>
                          <span
                            className="text-xs font-mono text-slate-800 truncate block"
                            title={animal.dam_id || 'Unknown'}
                          >
                            {animal.dam_id
                              ? `${animal.dam_id.substring(0, 8)}...`
                              : 'Unknown'}
                          </span>
                        </div>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <span className="text-xs font-bold text-slate-400 flex items-center gap-1 mb-1">
                          <MapPin size={12} /> Origin / Acquisition
                        </span>
                        <span className="text-sm font-bold text-slate-800 block">
                          {animal.origin || 'Unknown Source'}
                        </span>
                        <span className="text-xs text-slate-500 font-medium">
                          {animal.acquisition_date
                            ? formatDisplayDate(animal.acquisition_date)
                            : 'No date'}{' '}
                          ({animal.acquisition_type || 'Unknown Type'})
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'husbandry' && (
              <HusbandryLogs animalId={animal.id} animal={animal} />
            )}

            {activeTab === 'documents' && canReadDocs && (
              <AnimalDocumentsTab animal={animal} />
            )}

            {activeTab === 'events' && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <CalendarDays size={32} className="opacity-40" />
                <h3 className="text-sm font-bold text-slate-600">
                  Events &amp; Public Displays History
                </h3>
                <p className="text-xs text-slate-500 text-center max-w-md">
                  Displays scheduled events, flight appearances, and school/VIP
                  encounters allocated to {animal.name}.
                </p>
              </div>
            )}

            {activeTab === 'training' && (
              <div className="flex flex-col items-center justify-center py-16 text-slate-400 gap-3">
                <Target size={32} className="opacity-40" />
                <h3 className="text-sm font-bold text-slate-600">
                  Behavioral &amp; Flight Conditioning Ledger
                </h3>
                <p className="text-xs text-slate-500 text-center max-w-md">
                  Logs flight performance, creance/free-flight sessions, and
                  target weight conditioning for {animal.name}.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {isEditModalOpen && (
        <AnimalFormModal
          isOpen={isEditModalOpen}
          initialData={animal}
          onClose={() => setIsEditModalOpen(false)}
        />
      )}
      {isSignModalOpen && (
        <SignGenerator
          animal={animal}
          onClose={() => setIsSignModalOpen(false)}
        />
      )}

      {/* DYNAMIC DISPOSITION MODAL */}
      {isArchiveConfirmOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/65 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-3xl p-6 md:p-8 max-w-md w-full shadow-2xl my-auto">
            <div className="flex flex-col">
              <div className="flex items-center gap-3 mb-6">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                    isDeath
                      ? 'bg-slate-100 text-slate-700'
                      : 'bg-rose-50 text-rose-500'
                  }`}
                >
                  {isDeath ? <Skull size={24} /> : <AlertTriangle size={24} />}
                </div>
                <div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight">
                    Log Disposition
                  </h3>
                  <p className="text-xs font-semibold text-slate-500 truncate w-full">
                    Record {animal.name}&apos;s Departure
                  </p>
                </div>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                    Reason for Disposition
                  </label>
                  <select
                    value={archiveReason}
                    onChange={(e) => setArchiveReason(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2"
                  >
                    <option value="Transferred">Transferred (External)</option>
                    <option value="Died">Died (Natural/Illness)</option>
                    <option value="Euthanasia">Euthanasia</option>
                    <option value="Released to Wild">Released to Wild</option>
                    <option value="Escaped">Escaped</option>
                  </select>
                </div>

                {isDeath ? (
                  <div className="space-y-4">
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                        Cause of Death (If Known)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Aspergillosis, Renal Failure..."
                        value={causeOfDeath}
                        onChange={(e) => setCauseOfDeath(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                        Necropsy / Post-Mortem Notes
                      </label>
                      <textarea
                        rows={3}
                        placeholder="Initial clinical observations..."
                        value={necropsyNotes}
                        onChange={(e) => setNecropsyNotes(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 resize-none"
                      />
                    </div>
                  </div>
                ) : (
                  <div className={!requiresDestination ? 'opacity-50' : ''}>
                    <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                      Destination / Receiving Entity
                    </label>
                    <input
                      type="text"
                      placeholder={
                        requiresDestination ? 'e.g. London Zoo' : 'N/A'
                      }
                      value={archiveDestination}
                      onChange={(e) => setArchiveDestination(e.target.value)}
                      disabled={!requiresDestination}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-900 disabled:cursor-not-allowed"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-bold text-slate-600 uppercase tracking-wider mb-1.5 block">
                    Date &amp; Time of Disposition
                  </label>
                  <input
                    type="datetime-local"
                    value={archivedAt}
                    onChange={(e) => setArchivedAt(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 w-full border-t border-slate-100 pt-5">
                <button
                  type="button"
                  onClick={() => setIsArchiveConfirmOpen(false)}
                  disabled={archiveMutation.isPending}
                  className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl hover:bg-slate-200 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => archiveMutation.mutate()}
                  disabled={
                    archiveMutation.isPending ||
                    (requiresDestination && !archiveDestination.trim())
                  }
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-colors disabled:opacity-50 cursor-pointer ${
                    isDeath
                      ? 'bg-slate-900 hover:bg-slate-800'
                      : 'bg-rose-600 hover:bg-rose-500'
                  }`}
                >
                  {archiveMutation.isPending ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    'Confirm Disposition'
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default AnimalProfile;