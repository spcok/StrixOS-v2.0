export type IUCNStatusCode =
  | 'EX'
  | 'EW'
  | 'CR'
  | 'EN'
  | 'VU'
  | 'NT'
  | 'LC'
  | 'DD'
  | 'NE';

interface IUCNMeta {
  code: IUCNStatusCode;
  label: string;
  color: string;
  bg: string;
  border: string;
  dot: string;
}

const STATUS_MAP: Record<IUCNStatusCode, IUCNMeta> = {
  EX: {
    code: 'EX',
    label: 'Extinct',
    color: 'text-slate-100',
    bg: 'bg-slate-900',
    border: 'border-slate-950',
    dot: 'bg-slate-300',
  },
  EW: {
    code: 'EW',
    label: 'Extinct in Wild',
    color: 'text-slate-100',
    bg: 'bg-slate-800',
    border: 'border-slate-900',
    dot: 'bg-purple-400',
  },
  CR: {
    code: 'CR',
    label: 'Critically Endangered',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
  },
  EN: {
    code: 'EN',
    label: 'Endangered',
    color: 'text-orange-700',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
    dot: 'bg-orange-500',
  },
  VU: {
    code: 'VU',
    label: 'Vulnerable',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
  },
  NT: {
    code: 'NT',
    label: 'Near Threatened',
    color: 'text-lime-700',
    bg: 'bg-lime-50',
    border: 'border-lime-200',
    dot: 'bg-lime-500',
  },
  LC: {
    code: 'LC',
    label: 'Least Concern',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
  },
  DD: {
    code: 'DD',
    label: 'Data Deficient',
    color: 'text-slate-600',
    bg: 'bg-slate-100',
    border: 'border-slate-200',
    dot: 'bg-slate-400',
  },
  NE: {
    code: 'NE',
    label: 'Not Evaluated',
    color: 'text-slate-500',
    bg: 'bg-slate-50',
    border: 'border-slate-200',
    dot: 'bg-slate-300',
  },
};

export interface IUCNBadgeProps {
  status?: string | null;
  className?: string;
}

function normalizeIUCNStatus(status?: string | null): IUCNStatusCode {
  if (!status) return 'NE';
  const clean = status.trim().toUpperCase();

  if (clean in STATUS_MAP) return clean as IUCNStatusCode;

  if (clean.includes('CRITICALLY')) return 'CR';
  if (
    clean.includes('EXTINCT IN THE WILD') ||
    clean.includes('EXTINCT IN WILD')
  )
    return 'EW';
  if (clean.includes('EXTINCT')) return 'EX';
  if (clean.includes('ENDANGERED')) return 'EN';
  if (clean.includes('VULNERABLE')) return 'VU';
  if (clean.includes('NEAR THREATENED')) return 'NT';
  if (clean.includes('LEAST CONCERN')) return 'LC';
  if (clean.includes('DATA DEFICIENT')) return 'DD';
  if (clean.includes('NOT EVALUATED')) return 'NE';

  return 'NE';
}

export function IUCNBadge({ status, className = '' }: IUCNBadgeProps) {
  const code = normalizeIUCNStatus(status);
  const config = STATUS_MAP[code];

  return (
    <span
      title={`IUCN Red List Status: ${config.label} (${config.code})`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wider border rounded-xl shadow-2xs transition-colors whitespace-nowrap ${config.bg} ${config.color} ${config.border} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot} shrink-0`} />
      <span>{config.label}</span>
    </span>
  );
}

export default IUCNBadge;