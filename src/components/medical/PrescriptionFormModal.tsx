import React, { useState } from 'react';
import { useForm } from '@tanstack/react-form';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { X, Save, Loader2, AlertCircle, Pill, CalendarClock, Info } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';

interface PrescriptionFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData?: any;
}

// ------------------------------------------------------------------
// REUSABLE FORM COMPONENTS (Upgraded to StrixOS 2.0 UI)
// ------------------------------------------------------------------
function FormInput({
  field,
  label,
  type = 'text',
  placeholder,
  required = false,
}: {
  field: any;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
}) {
  const hasError = field.state?.meta?.errors?.length > 0 && field.state?.meta?.isTouched;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      {type === 'textarea' ? (
        <textarea
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full p-3 rounded-xl outline-none transition-all text-sm font-bold shadow-2xs h-24 custom-scrollbar resize-none ${
            hasError
              ? 'bg-rose-50 border border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-rose-900'
              : 'bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
          }`}
        />
      ) : (
        <input
          type={type}
          value={field.state.value}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full p-2.5 rounded-xl outline-none transition-all text-sm font-bold shadow-2xs ${
            hasError
              ? 'bg-rose-50 border border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-rose-900'
              : 'bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
          }`}
        />
      )}
      {hasError && (
        <span className="text-[10px] font-bold text-rose-500 mt-0.5 ml-1 flex items-center gap-1">
          <AlertCircle size={10} /> {field.state.meta.errors.join(', ')}
        </span>
      )}
    </div>
  );
}

function FormSelect({
  field,
  label,
  options,
  required = false,
}: {
  field: any;
  label: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const hasError = field.state?.meta?.errors?.length > 0 && field.state?.meta?.isTouched;
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 ml-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </label>
      <select
        value={field.state.value}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        className={`w-full p-2.5 rounded-xl outline-none transition-all text-sm font-bold shadow-2xs cursor-pointer ${
          hasError
            ? 'bg-rose-50 border border-rose-300 focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 text-rose-900'
            : 'bg-white border border-slate-200 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 text-slate-900'
        }`}
      >
        <option value="" disabled>
          -- Select Option --
        </option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hasError && (
        <span className="text-[10px] font-bold text-rose-500 mt-0.5 ml-1 flex items-center gap-1">
          <AlertCircle size={10} /> {field.state.meta.errors.join(', ')}
        </span>
      )}
    </div>
  );
}

// ------------------------------------------------------------------
// MAIN MODAL COMPONENT
// ------------------------------------------------------------------
export default function PrescriptionFormModal({
  isOpen,
  onClose,
  initialData,
}: PrescriptionFormModalProps) {
  const queryClient = useQueryClient();
  const { user, profile } = useAuth();
  const [saveError, setSaveError] = useState<string | null>(null);

  const { data: animals = [] } = useQuery({
    queryKey: ['animals', 'active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('animals')
        .select('id, name, species, location')
        .neq('status', 'ARCHIVED')
        .order('name');
      if (error) throw error;
      return data;
    },
    enabled: isOpen,
    networkMode: 'offlineFirst',
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: any) => {
      if (!navigator.onLine) {
        throw new Error('You must be online to provision or edit clinical medications.');
      }
      
      if (initialData?.id) {
        const { data, error } = await supabase
          .from('prescriptions')
          .update(payload)
          .eq('id', initialData.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from('prescriptions')
          .insert([payload])
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] });
      queryClient.invalidateQueries({ queryKey: ['active_mars'] });
      queryClient.invalidateQueries({ queryKey: ['clinical_records'] });
    },
  });

  const form = useForm({
    defaultValues: {
      animal_id: initialData?.animal_id || '',
      clinical_record_id: initialData?.clinical_record_id || null,
      order_type: initialData?.order_type || 'PRESCRIPTION',
      drug_name: initialData?.drug_name || '',
      concentration: initialData?.concentration || '',
      dosage: initialData?.dosage || '',
      route: initialData?.route || 'PO',
      frequency: initialData?.frequency || 'SID',
      is_prn: Boolean(initialData?.is_prn), // FIX: Restored PRN logic!
      indication: initialData?.indication || '',
      special_instructions: initialData?.special_instructions || '',
      start_date: initialData?.start_date || format(new Date(), 'yyyy-MM-dd'),
      end_date: initialData?.end_date || '',
      prescribing_vet_name: initialData?.prescribing_vet_name || '',
      prescribing_clinic: initialData?.prescribing_clinic || '',
    },
    onSubmit: async ({ value }) => {
      setSaveError(null);
      try {
        const payload = { ...value } as any;

        // 1. Strict Range Validation
        if (payload.end_date === '') {
          payload.end_date = null;
        } else if (payload.end_date < payload.start_date) {
          throw new Error('End date cannot be earlier than the start date.');
        }

        // 2. Conditional Clearing
        if (payload.order_type !== 'PRESCRIPTION') {
          payload.prescribing_vet_name = null;
          payload.prescribing_clinic = null;
        } else {
          if (payload.prescribing_vet_name === '') payload.prescribing_vet_name = null;
          if (payload.prescribing_clinic === '') payload.prescribing_clinic = null;
        }

        // 3. Security & Auditing
        payload.updated_by = profile?.id || null;
        if (!initialData?.id && user) {
          payload.internal_authorizing_user = user.id;
          payload.created_by = profile?.id || null;
        }

        await saveMutation.mutateAsync(payload);
        toast.success(initialData?.id ? 'Order updated.' : 'Order provisioned to MAR.');
        onClose();
      } catch (err: any) {
        setSaveError(err.message || 'Failed to save prescription. Check database connection.');
      }
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm overflow-y-auto flex items-center justify-center p-4 sm:p-6 font-sans text-left animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-3xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] border border-slate-200 overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 text-blue-700 rounded-xl flex items-center justify-center shadow-2xs border border-blue-200 shrink-0">
              <Pill size={20} />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-tight">
                {initialData?.id ? 'Edit Clinical Order' : 'Provision New Order'}
              </h2>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mt-0.5">
                Clinical Dispensary &amp; Formularies
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 overflow-y-auto custom-scrollbar flex-1 bg-white">
          {saveError && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-700 animate-in fade-in">
              <AlertCircle size={18} className="shrink-0 mt-0.5" />
              <div className="text-sm font-bold leading-relaxed">{saveError}</div>
            </div>
          )}

          <form
            id="rx-mutation-form"
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="space-y-6"
          >
            {/* Animal Selection */}
            <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 shadow-2xs">
              <form.Field
                name="animal_id"
                validators={{ onChange: ({ value }) => (!value ? 'Animal is required' : undefined) }}
              >
                {(field) => (
                  <FormSelect
                    field={field as any}
                    label="Select Animal"
                    required
                    options={animals.map((a: any) => ({
                      value: a.id,
                      label: `${a.name} (${a.species}) - ${a.location || 'No Loc'}`,
                    }))}
                  />
                )}
              </form.Field>
            </div>

            {/* Order Classification Toggles */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 border-t border-slate-100">
              <div className="md:col-span-2">
                <form.Field name="order_type">
                  {(field) => (
                    <div>
                      <label className="block text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">
                        Order Classification
                      </label>
                      <div className="flex bg-slate-50 border border-slate-200 rounded-xl p-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => field.handleChange('PRESCRIPTION')}
                          className={`flex-1 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                            field.state.value === 'PRESCRIPTION'
                              ? 'bg-blue-600 text-white shadow-sm border border-blue-700'
                              : 'text-slate-500 hover:bg-white border border-transparent'
                          }`}
                        >
                          Prescription (Rx)
                        </button>
                        <button
                          type="button"
                          onClick={() => field.handleChange('OTC')}
                          className={`flex-1 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                            field.state.value === 'OTC'
                              ? 'bg-amber-500 text-white shadow-sm border border-amber-600'
                              : 'text-slate-500 hover:bg-white border border-transparent'
                          }`}
                        >
                          Over-the-Counter
                        </button>
                        <button
                          type="button"
                          onClick={() => field.handleChange('SUPPLEMENT')}
                          className={`flex-1 py-2.5 rounded-lg text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all cursor-pointer ${
                            field.state.value === 'SUPPLEMENT'
                              ? 'bg-emerald-500 text-white shadow-sm border border-emerald-600'
                              : 'text-slate-500 hover:bg-white border border-transparent'
                          }`}
                        >
                          Supplement
                        </button>
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>

              {/* Conditional Vet Details */}
              <form.Subscribe selector={(state) => state.values.order_type}>
                {(orderType) =>
                  orderType === 'PRESCRIPTION' ? (
                    <>
                      <form.Field
                        name="prescribing_vet_name"
                        validators={{
                          onChange: ({ value }) => (!value ? 'Vet name is required for Rx' : undefined),
                        }}
                      >
                        {(field) => (
                          <FormInput
                            field={field as any}
                            label="Prescribing Veterinarian"
                            required
                            placeholder="e.g. Dr. Sarah Jenkins"
                          />
                        )}
                      </form.Field>
                      <form.Field name="prescribing_clinic">
                        {(field) => (
                          <FormInput
                            field={field as any}
                            label="Clinic / Practice Name"
                            placeholder="e.g. City Exotics Clinic"
                          />
                        )}
                      </form.Field>
                    </>
                  ) : null
                }
              </form.Subscribe>
            </div>

            {/* Drug Information & Dosage */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
              <form.Field
                name="drug_name"
                validators={{ onChange: ({ value }) => (!value ? 'Drug name is required' : undefined) }}
              >
                {(field) => (
                  <FormInput
                    field={field as any}
                    label="Drug Name / Formulation"
                    required
                    placeholder="e.g. Meloxicam"
                  />
                )}
              </form.Field>
              <form.Field name="concentration">
                {(field) => (
                  <FormInput
                    field={field as any}
                    label="Concentration (Optional)"
                    placeholder="e.g. 1.5mg/ml"
                  />
                )}
              </form.Field>
              <form.Field
                name="dosage"
                validators={{ onChange: ({ value }) => (!value ? 'Dosage is required' : undefined) }}
              >
                {(field) => (
                  <FormInput
                    field={field as any}
                    label="Dosage Amount"
                    required
                    placeholder="e.g. 0.3ml or 1 tablet"
                  />
                )}
              </form.Field>
              <form.Field name="route">
                {(field) => (
                  <FormSelect
                    field={field as any}
                    label="Route of Administration"
                    required
                    options={[
                      { value: 'PO', label: 'Oral (PO)' },
                      { value: 'IM', label: 'Intramuscular (IM)' },
                      { value: 'SC', label: 'Subcutaneous (SC)' },
                      { value: 'IV', label: 'Intravenous (IV)' },
                      { value: 'TOPICAL', label: 'Topical / Skin' },
                      { value: 'OPHTH', label: 'Eye Drops (Ophth)' },
                      { value: 'NEB', label: 'Inhaled / Nebulizer (NEB)' },
                    ]}
                  />
                )}
              </form.Field>
              
              <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
                <form.Field name="frequency">
                  {(field) => (
                    <FormSelect
                      field={field as any}
                      label="Frequency"
                      required
                      options={[
                        { value: 'SID', label: 'Once Daily (SID)' },
                        { value: 'BID', label: 'Twice Daily (BID)' },
                        { value: 'TID', label: 'Three Times Daily (TID)' },
                        { value: 'QID', label: 'Four Times Daily (QID)' },
                        { value: 'EOD', label: 'Every Other Day (EOD)' },
                        { value: 'STAT', label: 'Immediate Single Dose (STAT)' },
                        { value: 'PRN', label: 'As Needed (PRN)' },
                        { value: 'WEEKLY', label: 'Once Weekly' },
                        { value: 'MONTHLY', label: 'Once Monthly' },
                      ]}
                    />
                  )}
                </form.Field>
                
                {/* RESTORED PRN TOGGLE */}
                <form.Field name="is_prn">
                  {(field) => (
                    <div className="pt-5">
                      <label 
                        className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl cursor-pointer hover:bg-amber-100/70 transition-colors"
                        onClick={() => field.handleChange(!field.state.value)}
                      >
                        <input
                          type="checkbox"
                          checked={field.state.value}
                          onChange={(e) => field.handleChange(e.target.checked)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 text-amber-600 bg-white border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <span className="text-xs font-black text-amber-800 uppercase tracking-widest">
                          Mark as PRN (As Needed)
                        </span>
                      </label>
                    </div>
                  )}
                </form.Field>
              </div>
            </div>

            {/* Timelines and Instructions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-6 border-t border-slate-100">
              <form.Field
                name="start_date"
                validators={{ onChange: ({ value }) => (!value ? 'Start date is required' : undefined) }}
              >
                {(field) => <FormInput field={field as any} label="Start Date" type="date" required />}
              </form.Field>
              <form.Field name="end_date">
                {(field) => (
                  <FormInput
                    field={field as any}
                    label="End Date (Leave blank for ongoing)"
                    type="date"
                  />
                )}
              </form.Field>
              <div className="md:col-span-2">
                <form.Field name="indication">
                  {(field) => (
                    <FormInput
                      field={field as any}
                      label="Clinical Indication / Diagnosis"
                      placeholder="e.g. Bumblefoot treatment"
                    />
                  )}
                </form.Field>
              </div>
              <div className="md:col-span-2">
                <form.Field name="special_instructions">
                  {(field) => (
                    <FormInput
                      field={field as any}
                      label="Special Instructions for Keepers"
                      type="textarea"
                      placeholder="e.g. Hide medication in day-old chick"
                    />
                  )}
                </form.Field>
              </div>
            </div>
            
            <div className="flex items-start gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-600">
              <Info size={16} className="text-slate-400 shrink-0 mt-0.5" />
              <p className="leading-relaxed">
                Submitting this form immediately adds it to the active Digital MAR queue. You will be recorded as the authorizing internal staff member.
              </p>
            </div>
            
          </form>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 flex justify-between items-center bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
          >
            Cancel
          </button>
          
          <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
            {([canSubmit, isSubmitting]) => (
              <button
                type="submit"
                form="rx-mutation-form"
                disabled={!canSubmit || (isSubmitting as boolean) || saveMutation.isPending}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(37,99,235,0.2)] active:scale-95 cursor-pointer"
              >
                {isSubmitting || saveMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <CalendarClock size={16} />
                )}
                <span>
                  {isSubmitting || saveMutation.isPending
                    ? 'Processing...'
                    : initialData?.id
                    ? 'Update Order'
                    : 'Authorize Order'}
                </span>
              </button>
            )}
          </form.Subscribe>
        </div>
      </div>
    </div>
  );
}