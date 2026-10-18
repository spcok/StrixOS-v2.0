import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getExpandedRowModel,
  useReactTable,
  type SortingState,
  type ExpandedState,
} from '@tanstack/react-table';
import {
  Search,
  Plus,
  ArrowUpDown,
  Loader2,
  Scale,
  ChevronRight,
  ChevronDown,
  Users,
  User,
  MapPin,
  ChevronLeft,
} from 'lucide-react';
import type {
  Animal,
  FeedLog,
  WeightLog,
  TemperatureLog,
  FeedingSchedule,
} from '../../types';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import {
  getLocalDateString,
  formatWeightDisplay,
  formatQuantityDisplay,
  formatShortDate,
  formatDisplayTime,
} from '../../lib/utils';
import AnimalFormModal from '../animals/AnimalFormModal';
import { AnimalProfile } from '../animals/AnimalProfile';
import { MobProfile } from '../animals/MobProfile';
import { FeedModal } from '../husbandry/FeedModal';

export interface DashboardAnimalRow extends Animal {
  preferred_weight_unit?: string | null;
  today_weight?: WeightLog;
  today_temp?: TemperatureLog;
  today_feed: FeedLog[];
  last_feed?: FeedLog;
  next_feed?: FeedingSchedule;
  subRows?: DashboardAnimalRow[];
}

const EMPTY_ANIMALS: Animal[] = [];
const EMPTY_FEEDS: FeedLog[] = [];
const EMPTY_WEIGHTS: WeightLog[] = [];
const EMPTY_TEMPS: TemperatureLog[] = [];
const EMPTY_SCHEDULES: FeedingSchedule[] = [];

function useScreenSize() {
  const [screen, setScreen] = useState({
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    isMobile: typeof window !== 'undefined' && window.innerWidth < 768,
    isTablet:
      typeof window !== 'undefined' &&
      window.innerWidth >= 768 &&
      window.innerWidth < 1024,
    isDesktop: typeof window !== 'undefined' && window.innerWidth >= 1024,
  });

  useEffect(() => {
    const handleResize = () => {
      setScreen({
        width: window.innerWidth,
        isMobile: window.innerWidth < 768,
        isTablet: window.innerWidth >= 768 && window.innerWidth < 1024,
        isDesktop: window.innerWidth >= 1024,
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return screen;
}

const columnHelper = createColumnHelper<DashboardAnimalRow>();

export default function Dashboard() {
  const screen = useScreenSize();
  const { hasPermission } = useAuth();

  const [activeTab, setActiveTab] = useState<string>('EXOTIC');
  const [globalFilter, setGlobalFilter] = useState('');
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'name', desc: false },
  ]);
  const [expanded, setExpanded] = useState<ExpandedState>({});

  const [isCreateAnimalModalOpen, setIsCreateAnimalModalOpen] = useState(false);
  const [selectedAnimalId, setSelectedAnimalId] = useState<string | null>(null);

  const [feedActionAnimalId, setFeedActionAnimalId] = useState<string | null>(
    null
  );
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [feedModalSchedule, setFeedModalSchedule] =
    useState<FeedingSchedule | null>(null);

  const [activeDate, setActiveDate] = useState<string>(() =>
    getLocalDateString()
  );
  const [inputDate, setInputDate] = useState<string>(() =>
    getLocalDateString()
  );

  // 1. All Animals Query
  const { data: allAnimals = EMPTY_ANIMALS, isLoading: loadingAnimals } =
    useQuery({
      queryKey: ['animals', 'dashboard'],
      queryFn: async () => {
        const { data, error } = await supabase
          .from('animals')
          .select('*')
          .eq('is_deleted', false)
          .order('name');
        if (error) throw error;
        return (data || []) as Animal[];
      },
      staleTime: 0,
      gcTime: 1209600000,
      networkMode: 'offlineFirst',
      meta: { persist: true },
    });

  // Auto-select first available category tab if EXOTIC is empty on initial load
  useEffect(() => {
    if (allAnimals.length > 0 && activeTab !== 'ARCHIVED') {
      const hasActiveCategory = allAnimals.some(
        (a) => a.category === activeTab && a.status !== 'ARCHIVED'
      );
      if (!hasActiveCategory) {
        const firstAvailable = allAnimals.find(
          (a) => a.status !== 'ARCHIVED' && a.category
        )?.category;
        if (firstAvailable) {
          setActiveTab(firstAvailable);
        }
      }
    }
  }, [allAnimals, activeTab]);

  // 2. Today's Feeds
  const { data: todayFeeds = EMPTY_FEEDS, isLoading: loadingFeeds } = useQuery({
    queryKey: ['feeds', activeDate],
    queryFn: async () => {
      const start = new Date(`${activeDate}T00:00:00`).toISOString();
      const end = new Date(`${activeDate}T23:59:59.999`).toISOString();
      const { data } = await supabase
        .from('feed_logs')
        .select('*')
        .eq('is_deleted', false)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: false });
      return (data || []) as FeedLog[];
    },
    staleTime: 0,
    gcTime: 1209600000,
    networkMode: 'offlineFirst',
    meta: { persist: true },
  });

  // 3. Today's Weights
  const { data: todayWeights = EMPTY_WEIGHTS, isLoading: loadingWeights } =
    useQuery({
      queryKey: ['weights', activeDate],
      queryFn: async () => {
        const start = new Date(`${activeDate}T00:00:00`).toISOString();
        const end = new Date(`${activeDate}T23:59:59.999`).toISOString();
        const { data } = await supabase
          .from('weight_logs')
          .select('*')
          .eq('is_deleted', false)
          .gte('recorded_at', start)
          .lte('recorded_at', end)
          .order('recorded_at', { ascending: false });
        return (data || []) as WeightLog[];
      },
      staleTime: 0,
      gcTime: 1209600000,
      networkMode: 'offlineFirst',
      meta: { persist: true },
    });

  // 4. Today's Temperatures
  const { data: todayTemps = EMPTY_TEMPS, isLoading: loadingTemps } = useQuery({
    queryKey: ['temperatures', activeDate],
    queryFn: async () => {
      const start = new Date(`${activeDate}T00:00:00`).toISOString();
      const end = new Date(`${activeDate}T23:59:59.999`).toISOString();
      const { data } = await supabase
        .from('temperature_logs')
        .select('*')
        .eq('is_deleted', false)
        .gte('recorded_at', start)
        .lte('recorded_at', end)
        .order('recorded_at', { ascending: false });
      return (data || []) as TemperatureLog[];
    },
    staleTime: 0,
    gcTime: 1209600000,
    networkMode: 'offlineFirst',
    meta: { persist: true },
  });

  // 5. Latest Historical Feed per Animal (via SQL View)
  const { data: historicalFeeds = EMPTY_FEEDS } = useQuery({
    queryKey: ['feeds_historical_latest'],
    queryFn: async () => {
      const { data } = await supabase.from('latest_animal_feeds').select('*');
      return (data || []) as FeedLog[];
    },
    staleTime: 0,
    gcTime: 1209600000,
    networkMode: 'offlineFirst',
    meta: { persist: true },
  });

  // 6. Next Pending Scheduled Feeds (Direct Supabase Query — replaces scheduledFeedingService)
  const { data: nextFeeds = EMPTY_SCHEDULES } = useQuery({
    queryKey: ['dashboard', 'next_feeds', activeTab],
    queryFn: async () => {
      const { data } = await supabase
        .from('feeding_schedules')
        .select('*')
        .eq('is_deleted', false)
        .eq('status', 'PENDING')
        .not('scheduled_date', 'is', null)
        .order('scheduled_date', { ascending: true });
      return (data || []) as FeedingSchedule[];
    },
    enabled: activeTab === 'EXOTIC',
    staleTime: 0,
    gcTime: 1209600000,
    networkMode: 'offlineFirst',
    meta: { persist: true },
    refetchOnWindowFocus: true,
  });

  const loadingLogs = loadingFeeds || loadingWeights || loadingTemps;
  const selectedAnimal = useMemo(
    () =>
      selectedAnimalId
        ? allAnimals.find((a) => a.id === selectedAnimalId) || null
        : null,
    [allAnimals, selectedAnimalId]
  );

  const updateDate = (newDate: string) => {
    if (!newDate) return;
    setActiveDate(newDate);
    setInputDate(newDate);
  };

  const shiftDate = (days: number) => {
    const parts = activeDate.split('-');
    if (parts.length !== 3) return;
    const [y, m, d] = parts.map(Number);
    const dateObj = new Date(y, m - 1, d);
    dateObj.setDate(dateObj.getDate() + days);
    updateDate(getLocalDateString(dateObj));
  };

  const hierarchicalData = useMemo<DashboardAnimalRow[]>(() => {
    const weightMap = new Map<string, WeightLog>();
    todayWeights.forEach((w) => {
      if (!weightMap.has(w.animal_id)) weightMap.set(w.animal_id, w);
    });

    const tempMap = new Map<string, TemperatureLog>();
    todayTemps.forEach((t) => {
      if (!tempMap.has(t.animal_id)) tempMap.set(t.animal_id, t);
    });

    const feedMap = new Map<string, FeedLog[]>();
    todayFeeds.forEach((f) => {
      const existing = feedMap.get(f.animal_id);
      if (existing) {
        existing.push(f);
      } else {
        feedMap.set(f.animal_id, [f]);
      }
    });

    const lastFeedMap = new Map<string, FeedLog>();
    historicalFeeds.forEach((f) => {
      if (!lastFeedMap.has(f.animal_id)) lastFeedMap.set(f.animal_id, f);
    });

    // Since nextFeeds is ordered by scheduled_date ASC, the first match per animal is their next due feed
    const nextFeedMap = new Map<string, FeedingSchedule>();
    nextFeeds.forEach((f) => {
      if (!nextFeedMap.has(f.animal_id)) nextFeedMap.set(f.animal_id, f);
    });

    let baseData: DashboardAnimalRow[] = allAnimals.map((a) => ({
      ...a,
      today_weight: weightMap.get(a.id),
      today_temp: tempMap.get(a.id),
      today_feed: feedMap.get(a.id) || [],
      last_feed: lastFeedMap.get(a.id),
      next_feed: nextFeedMap.get(a.id),
    }));

    if (activeTab === 'ARCHIVED') {
      baseData = baseData.filter((a) => a.status === 'ARCHIVED');
    } else {
      baseData = baseData.filter(
        (a) => a.category === activeTab && a.status !== 'ARCHIVED'
      );
    }

    const groups = baseData.filter((a) => a.record_type === 'GROUP');
    const individuals = baseData.filter((a) => a.record_type !== 'GROUP');

    groups.forEach((group) => {
      group.subRows = individuals.filter(
        (indiv) => indiv.parent_group_id === group.id
      );
    });

    const standaloneIndividuals = individuals.filter(
      (indiv) => !indiv.parent_group_id
    );
    return [...groups, ...standaloneIndividuals];
  }, [
    allAnimals,
    todayWeights,
    todayTemps,
    todayFeeds,
    historicalFeeds,
    nextFeeds,
    activeTab,
  ]);

  const columns = useMemo(() => {
    const cols = [
      columnHelper.accessor('name', {
        id: 'name',
        header: 'Name',
        cell: (info) => {
          const animal = info.row.original;
          const isGroup = animal.record_type === 'GROUP';
          const isIndivWithGroup =
            animal.record_type === 'INDIVIDUAL' &&
            Boolean(animal.parent_group_id);
          const photoUrl = animal.profile_image_url;

          return (
            <div className="flex items-center gap-2 lg:gap-3 py-0.5 w-full">
              <div
                className={`relative hidden lg:block ${
                  isIndivWithGroup ? 'ml-6' : ''
                }`}
              >
                {photoUrl ? (
                  <img
                    src={photoUrl}
                    className="w-8 h-8 lg:w-10 lg:h-10 rounded-full object-cover shrink-0 shadow-xs border border-slate-200 mt-0.5"
                    alt={animal.name}
                  />
                ) : (
                  <div
                    className={`p-2 lg:p-2.5 rounded-full shrink-0 shadow-xs mt-0.5 ${
                      isGroup
                        ? 'bg-blue-50 text-blue-600 border border-blue-100'
                        : 'bg-slate-50 text-slate-400 border border-slate-200'
                    }`}
                  >
                    {isGroup ? (
                      <Users size={15} />
                    ) : (
                      <User size={15} />
                    )}
                  </div>
                )}
                {isGroup && (
                  <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center border-2 border-white shadow-xs">
                    <Users size={9} className="text-white" />
                  </div>
                )}
              </div>

              <div
                className={`flex flex-col min-w-0 flex-1 ${
                  isIndivWithGroup ? 'ml-2 lg:ml-0' : ''
                }`}
              >
                <div className="flex items-center gap-1">
                  {isGroup && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        info.row.toggleExpanded();
                      }}
                      className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 shrink-0 transition-colors cursor-pointer"
                    >
                      {info.row.getIsExpanded() ? (
                        <ChevronDown size={15} />
                      ) : (
                        <ChevronRight size={15} />
                      )}
                    </button>
                  )}
                  <span
                    className="font-bold text-slate-900 text-xs lg:text-sm truncate w-full hover:underline cursor-pointer"
                    title={animal.name}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedAnimalId(animal.id);
                    }}
                  >
                    {animal.name}
                  </span>
                </div>
                {animal.ring_number && (
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1 mt-0.5 truncate">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-300 hidden lg:inline-block" />
                    {animal.ring_number}
                  </span>
                )}
              </div>
            </div>
          );
        },
      }),
    ];

    if (!screen.isMobile) {
      cols.push(
        columnHelper.accessor('species', {
          id: 'species',
          header: 'Species',
          cell: (info) => (
            <div className="flex flex-col justify-center min-w-0 py-0.5">
              <span
                className="text-xs font-bold text-slate-700 leading-tight truncate"
                title={info.getValue() || undefined}
              >
                {info.getValue() || 'Unknown'}
              </span>
            </div>
          ),
        })
      );
    }

    cols.push(
      columnHelper.accessor('location', {
        id: 'location',
        header: 'Location',
        cell: (info) => (
          <div className="flex items-center justify-center gap-1.5 py-0.5 min-w-0 w-full">
            <MapPin
              size={12}
              className="text-slate-400 shrink-0 hidden lg:block"
            />
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider leading-tight text-center truncate">
              {info.getValue() || 'Unassigned'}
            </span>
          </div>
        ),
      }),
      columnHelper.accessor('today_weight', {
        id: 'today_weight',
        header: 'Weight',
        cell: (info) => {
          const w = info.getValue();
          const animal = info.row.original;

          if (!w) {
            return (
              <span className="text-slate-300 text-xs font-medium py-0.5 block w-full text-center">
                -
              </span>
            );
          }

          const preferredUnit =
            animal.preferred_weight_unit || animal.weight_unit || 'g';

          return (
            <div className="flex items-center justify-center gap-1.5 py-0.5 w-full">
              <Scale
                size={12}
                className="text-emerald-500 shrink-0 hidden lg:block"
              />
              <span className="text-xs font-bold text-slate-700">
                {formatWeightDisplay(w.weight_grams, preferredUnit)}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('today_feed', {
        id: 'today_feed',
        header: "Today's Feed",
        cell: (info) => {
          const feeds = info.getValue() || [];
          if (feeds.length === 0) {
            return (
              <span className="text-slate-300 text-xs font-medium py-0.5 block w-full text-center">
                -
              </span>
            );
          }

          return (
            <div className="flex flex-col gap-1 w-full text-center">
              {feeds.map((f, i) => {
                const qtyUnit = formatQuantityDisplay(f.quantity, f.unit);
                const timeStr = formatDisplayTime(f.recorded_at);
                const displayString = `${qtyUnit}${
                  f.food_item || 'Diet'
                } @ ${timeStr}`;

                return (
                  <span
                    key={f.id || i}
                    className="text-xs font-bold text-slate-700 wrap-break-word whitespace-normal w-full block"
                    title={displayString}
                  >
                    {displayString}
                  </span>
                );
              })}
            </div>
          );
        },
      }),
      columnHelper.accessor('last_feed', {
        id: 'last_feed',
        header: 'Last Feed',
        cell: (info) => {
          const lastMeal = info.getValue();
          if (!lastMeal) {
            return (
              <span className="text-slate-300 text-xs font-medium py-0.5 block w-full text-center">
                No History
              </span>
            );
          }

          const dateStr = formatShortDate(lastMeal.recorded_at);
          const timeStr = formatDisplayTime(lastMeal.recorded_at);
          const qtyUnit = formatQuantityDisplay(lastMeal.quantity, lastMeal.unit);
          const displayString = `${qtyUnit}${
            lastMeal.food_item || 'Diet'
          } @ ${dateStr} ${timeStr}`;

          return (
            <div className="w-full text-center">
              <span
                className="text-xs font-bold text-slate-700 wrap-break-word whitespace-normal w-full block"
                title={displayString}
              >
                {displayString}
              </span>
            </div>
          );
        },
      }),
      columnHelper.accessor('next_feed', {
        id: 'next_feed',
        header: 'Next Feed',
        cell: (info) => {
          const nextFeed = info.getValue();
          if (!nextFeed || !nextFeed.scheduled_date) {
            return (
              <span className="text-slate-300 text-xs font-medium py-0.5 block w-full text-center">
                -
              </span>
            );
          }

          const todayStr = getLocalDateString();
          const cleanSchedDate = nextFeed.scheduled_date.split('T')[0];
          const isOverdue = cleanSchedDate < todayStr;
          const isToday = cleanSchedDate === todayStr;

          const [y, m, d] = cleanSchedDate.split('-').map(Number);
          const safeDate = new Date(y, m - 1, d);
          const dateStr = formatShortDate(cleanSchedDate);
          const hasTime = nextFeed.scheduled_date.includes('T');
          const timeStr = hasTime
            ? ` ${formatDisplayTime(nextFeed.scheduled_date)}`
            : '';

          const qtyUnit = formatQuantityDisplay(
            nextFeed.quantity,
            nextFeed.quantity_unit
          );
          const displayString = `${qtyUnit}${
            nextFeed.food_type || 'Diet'
          } @ ${dateStr}${timeStr}`;

          if (isOverdue) {
            const diffTime = Math.abs(
              new Date(todayStr).getTime() - safeDate.getTime()
            );
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFeedActionAnimalId(info.row.original.id);
                  setFeedModalSchedule(nextFeed);
                  setIsFeedModalOpen(true);
                }}
                className="bg-rose-600 text-white animate-pulse border-2 border-rose-900 px-2 lg:px-3 py-1.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xs w-full max-w-[170px] mx-auto flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer"
              >
                <span
                  className="text-xs font-bold leading-tight wrap-break-word whitespace-normal w-full"
                  title={displayString}
                >
                  {displayString}
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-rose-100">
                  MISSED &bull; {diffDays}D LATE
                </span>
              </button>
            );
          }

          if (isToday) {
            return (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFeedActionAnimalId(info.row.original.id);
                  setFeedModalSchedule(nextFeed);
                  setIsFeedModalOpen(true);
                }}
                className="bg-emerald-400 text-slate-950 border-2 border-emerald-600 px-2 lg:px-3 py-1.5 rounded-xl hover:scale-105 active:scale-95 transition-all shadow-xs w-full max-w-[170px] mx-auto flex flex-col items-center justify-center text-center gap-0.5 cursor-pointer"
              >
                <span
                  className="text-xs font-bold leading-tight wrap-break-word whitespace-normal w-full"
                  title={displayString}
                >
                  {displayString}
                </span>
                <span className="text-[10px] font-bold tracking-wider uppercase text-emerald-900">
                  TODAY
                </span>
              </button>
            );
          }

          return (
            <div className="bg-slate-800 text-white px-2 lg:px-3 py-1.5 lg:py-2 rounded-xl opacity-90 w-full max-w-[170px] mx-auto flex items-center justify-center text-center">
              <span
                className="text-xs font-bold leading-tight wrap-break-word whitespace-normal w-full text-slate-100"
                title={displayString}
              >
                {displayString}
              </span>
            </div>
          );
        },
      })
    );

    return cols;
  }, [screen.isMobile, screen.isTablet]);

  const columnVisibility = useMemo(() => {
    return {
      next_feed: activeTab === 'EXOTIC',
      location: !(activeTab === 'EXOTIC' && !screen.isDesktop),
    };
  }, [activeTab, screen.isDesktop]);

  const table = useReactTable({
    data: hierarchicalData,
    columns,
    state: { globalFilter, sorting, expanded, columnVisibility },
    autoResetExpanded: false,
    onGlobalFilterChange: setGlobalFilter,
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getSubRows: (row) => row.subRows,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
  });

  const categories = useMemo(() => {
    const dbCategories = Array.from(
      new Set(allAnimals.map((a) => a.category).filter(Boolean))
    ) as string[];
    return dbCategories.length > 0
      ? dbCategories.sort()
      : ['OWL', 'RAPTOR', 'MAMMAL', 'EXOTIC'];
  }, [allAnimals]);

  const tabs = [...categories, 'ARCHIVED'];

  const tableGridCols = table
    .getVisibleLeafColumns()
    .map((c) => {
      if (c.id === 'name')
        return screen.isMobile
          ? 'minmax(95px, 1.2fr)'
          : screen.isTablet
          ? 'minmax(115px, 1.2fr)'
          : 'minmax(130px, 1.1fr)';
      if (c.id === 'species')
        return screen.isMobile || screen.isTablet
          ? 'minmax(75px, 0.8fr)'
          : 'minmax(95px, 0.8fr)';
      if (c.id === 'location')
        return screen.isMobile || screen.isTablet
          ? 'minmax(65px, 0.8fr)'
          : 'minmax(95px, 0.8fr)';
      if (c.id === 'today_weight')
        return screen.isMobile
          ? 'minmax(65px, 0.6fr)'
          : screen.isTablet
          ? 'minmax(75px, 0.6fr)'
          : 'minmax(100px, 0.8fr)';
      if (c.id === 'today_feed')
        return screen.isMobile || screen.isTablet
          ? 'minmax(115px, 1.2fr)'
          : 'minmax(160px, 1.5fr)';
      if (c.id === 'last_feed')
        return screen.isMobile || screen.isTablet
          ? 'minmax(120px, 1.2fr)'
          : 'minmax(170px, 1.5fr)';
      if (c.id === 'next_feed')
        return screen.isMobile
          ? 'minmax(115px, 1.2fr)'
          : screen.isTablet
          ? 'minmax(115px, 1.1fr)'
          : 'minmax(150px, 1.2fr)';
      return '1fr';
    })
    .join(' ');

  return (
    <div className="h-[calc(100dvh-6.5rem)] flex flex-col space-y-3 lg:space-y-4">
      {/* Level 1 Header: Title & Add Animal Action */}
      <div className="flex justify-between items-center w-full portrait:flex landscape:hidden lg:landscape:flex">
        <div className="shrink-0 pr-4">
          <h1 className="text-xl lg:text-2xl font-black text-slate-900 tracking-tight">
            Dashboard
          </h1>
        </div>
        {hasPermission(['animals:edit', 'animals:manage']) && (
          <button
            type="button"
            onClick={() => setIsCreateAnimalModalOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white px-3.5 lg:px-4 py-2 lg:py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-xs active:scale-95 shrink-0 cursor-pointer"
          >
            <Plus size={15} />
            <span>Add Animal</span>
          </button>
        )}
      </div>

      {/* Level 2 Toolbar: Search + Date Navigator */}
      <div className="flex flex-col sm:flex-row gap-2 lg:gap-3 w-full bg-slate-50/90 p-2 lg:p-3 rounded-2xl border border-slate-200 shadow-inner portrait:flex landscape:hidden lg:landscape:flex">
        <div className="relative w-full lg:w-96 shrink-0">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={16}
          />
          <input
            type="text"
            placeholder="Search collections..."
            value={globalFilter ?? ''}
            onChange={(e) => setGlobalFilter(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs lg:text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all shadow-xs placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center justify-between bg-white rounded-xl p-1 border border-slate-200 shadow-xs w-full lg:w-auto">
          <button
            type="button"
            onClick={() => shiftDate(-1)}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-95 cursor-pointer"
            title="Previous Day"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="flex-1 lg:flex-none relative flex justify-center border-l border-r border-slate-100 px-2 min-w-[130px]">
            <input
              type="date"
              value={inputDate}
              onChange={(e) => {
                setInputDate(e.target.value);
                if (e.target.value) updateDate(e.target.value);
              }}
              className="bg-transparent border-none text-xs font-bold text-slate-700 focus:outline-none focus:ring-0 py-1 cursor-pointer w-full text-center"
            />
          </div>
          <button
            type="button"
            onClick={() => shiftDate(1)}
            className="p-1.5 hover:bg-slate-50 rounded-lg text-slate-500 hover:text-slate-800 transition-all active:scale-95 cursor-pointer"
            title="Next Day"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="grid grid-cols-4 lg:flex lg:gap-2 w-full shrink-0 gap-1.5">
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-2 lg:px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider whitespace-nowrap lg:whitespace-normal transition-all shadow-xs cursor-pointer ${
              activeTab === tab
                ? tab === 'ARCHIVED'
                  ? 'bg-rose-600 text-white border border-rose-700'
                  : 'bg-slate-900 text-white border border-slate-800'
                : 'bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-slate-200'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Level 3: Data Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs flex flex-col flex-1 min-h-0 overflow-hidden relative mt-1">
        {(loadingAnimals || loadingLogs) && (
          <div className="absolute inset-0 bg-white/60 backdrop-blur-xs z-10 flex items-center justify-center">
            <div className="bg-white p-4 rounded-2xl shadow-xl flex items-center gap-3 border border-slate-100">
              <Loader2 className="animate-spin text-emerald-500" size={22} />
              <span className="text-sm font-bold text-slate-700">
                Syncing telemetry...
              </span>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-auto custom-scrollbar relative w-full">
          <div className="min-w-[460px] xl:min-w-[800px] w-full">
            {/* Sticky Table Header */}
            <div
              className="grid border-b border-slate-200 bg-slate-50/95 text-xs font-bold text-slate-500 uppercase tracking-wider sticky top-0 z-20 backdrop-blur-md"
              style={{ gridTemplateColumns: tableGridCols }}
            >
              {table.getHeaderGroups().map((headerGroup) => (
                <React.Fragment key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const isCentered = [
                      'location',
                      'today_weight',
                      'today_feed',
                      'last_feed',
                      'next_feed',
                    ].includes(header.column.id);
                    const sortedState = header.column.getIsSorted();
                    return (
                      <div
                        key={header.id}
                        className={`px-2 lg:px-4 py-2.5 lg:py-3 flex items-center gap-1.5 cursor-pointer hover:bg-slate-200/50 transition-colors ${
                          isCentered
                            ? 'justify-center text-center'
                            : 'justify-start text-left'
                        }`}
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                        {sortedState === 'asc' && (
                          <ArrowUpDown size={13} className="text-emerald-500" />
                        )}
                        {sortedState === 'desc' && (
                          <ArrowUpDown
                            size={13}
                            className="text-emerald-500 rotate-180"
                          />
                        )}
                      </div>
                    );
                  })}
                </React.Fragment>
              ))}
            </div>

            {/* Table Body Rows */}
            <div className="divide-y divide-slate-100 bg-white">
              {table.getRowModel().rows.length === 0 &&
              !(loadingAnimals || loadingLogs) ? (
                <div className="p-8 lg:p-12 text-center text-slate-500 flex flex-col items-center">
                  <div className="w-12 h-12 lg:w-14 lg:h-14 bg-slate-50 rounded-2xl flex items-center justify-center mb-3 border border-slate-200 shadow-xs">
                    <Search size={22} className="text-slate-400" />
                  </div>
                  <p className="font-bold text-slate-800 mb-1 text-sm">
                    No collections found
                  </p>
                  <p className="text-xs text-slate-500">
                    Adjust your search or category filters, or click &ldquo;Add
                    Animal&rdquo; to register your first specimen.
                  </p>
                </div>
              ) : (
                table.getRowModel().rows.map((row) => {
                  const isGroupHeader = row.original.record_type === 'GROUP';
                  const isExpanded = row.getIsExpanded();

                  return (
                    <div
                      key={row.id}
                      className={`grid border-b border-slate-100 hover:bg-slate-50 transition-colors group cursor-pointer ${
                        isExpanded ? 'bg-emerald-50/30' : 'bg-white'
                      } ${isGroupHeader ? 'bg-slate-50' : ''}`}
                      style={{ gridTemplateColumns: tableGridCols }}
                      onClick={() => {
                        if (!isGroupHeader) {
                          setSelectedAnimalId(row.original.id);
                        }
                      }}
                    >
                      {row.getVisibleCells().map((cell) => {
                        const isCentered = [
                          'location',
                          'today_weight',
                          'today_feed',
                          'last_feed',
                          'next_feed',
                        ].includes(cell.column.id);
                        return (
                          <div
                            key={cell.id}
                            className={`px-2 lg:px-4 py-2 flex items-center min-w-0 ${
                              isCentered
                                ? 'justify-center text-center'
                                : 'justify-start text-left'
                            }`}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext()
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Connected Modals */}
      {isCreateAnimalModalOpen && (
        <AnimalFormModal
          isOpen={isCreateAnimalModalOpen}
          onClose={() => setIsCreateAnimalModalOpen(false)}
        />
      )}

      {selectedAnimal && selectedAnimal.record_type === 'INDIVIDUAL' && (
        <AnimalProfile
          onClose={() => setSelectedAnimalId(null)}
          animal={selectedAnimal}
        />
      )}

      {selectedAnimal && selectedAnimal.record_type === 'GROUP' && (
        <MobProfile
          onClose={() => setSelectedAnimalId(null)}
          mob={selectedAnimal}
          members={allAnimals.filter(
            (a) => a.parent_group_id === selectedAnimal.id
          )}
        />
      )}

      {isFeedModalOpen && feedActionAnimalId && (
        <FeedModal
          isOpen={isFeedModalOpen}
          onClose={() => {
            setIsFeedModalOpen(false);
            setFeedActionAnimalId(null);
            setFeedModalSchedule(null);
          }}
          animalId={feedActionAnimalId}
          scheduledFeed={feedModalSchedule}
        />
      )}
    </div>
  );
}