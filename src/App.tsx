import { Fragment, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheck,
  Info,
  ListPlus,
  NotebookPen,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Settings2,
  Sun,
  Trash2,
  Undo2,
  X,
} from 'lucide-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';

const publicAsset = (filename: string) => `${import.meta.env.BASE_URL}${filename}`;

type MarkerId =
  | 'sc'
  | 'hdc'
  | 'dc'
  | 'tr'
  | 'slst'
  | 'ch'
  | 'sc-inc'
  | 'dc-inc'
  | 'sc-dec'
  | 'dc-dec'
  | 'blo-sc'
  | 'flo-sc'
  | 'blo-hdc'
  | 'flo-hdc'
  | 'blo-dc'
  | 'flo-dc'
  | 'skip'
  | 'sc2tog'
  | 'hdc2tog'
  | 'dc2tog'
  | 'inv-dec'
  | 'fptr'
  | 'bptr'
  | 'fpsc'
  | 'bpsc'
  | 'fphdc'
  | 'bphdc'
  | 'esc'
  | 'ehdc'
  | 'edc'
  | 'puff'
  | 'bobble'
  | 'popcorn'
  | 'cluster'
  | 'shell'
  | 'spike'
  | 'fpdc'
  | 'bpdc'
  | 'mr';

type Counts = Partial<Record<MarkerId, number>>;
type PatternStep = {
  markerId: MarkerId;
  repeat: number;
  label?: string;
};
type CrochetRound = {
  id: string;
  name: string;
  target: number;
  instruction: string;
  counts: Counts;
  patternSteps: PatternStep[];
  patternRepeats: number;
  progress: number;
};
type TrackerState = {
  rounds: CrochetRound[];
  activeId: string | null;
};

type ScreenWakeLock = { release: () => Promise<void> };
type WakeLockNavigator = Navigator & {
  wakeLock?: { request: (type: 'screen') => Promise<ScreenWakeLock> };
};

const markerOptions: { id: MarkerId; label: string; short: string }[] = [
  { id: 'sc', label: 'Single crochet', short: 'SC' },
  { id: 'hdc', label: 'Half double crochet', short: 'HDC' },
  { id: 'dc', label: 'Double crochet', short: 'DC' },
  { id: 'tr', label: 'Treble crochet', short: 'TR' },
  { id: 'slst', label: 'Slip stitch', short: 'SL ST' },
  { id: 'ch', label: 'Chain', short: 'CH' },
  { id: 'sc-inc', label: 'Single crochet increase', short: 'SC INC' },
  { id: 'dc-inc', label: 'Double crochet increase', short: 'DC INC' },
  { id: 'sc-dec', label: 'Single crochet decrease', short: 'SC DEC' },
  { id: 'dc-dec', label: 'Double crochet decrease', short: 'DC DEC' },
  { id: 'blo-sc', label: 'Back loop only single crochet', short: 'BLO SC' },
  { id: 'flo-sc', label: 'Front loop only single crochet', short: 'FLO SC' },
  { id: 'blo-hdc', label: 'Back loop only half double crochet', short: 'BLO HDC' },
  { id: 'flo-hdc', label: 'Front loop only half double crochet', short: 'FLO HDC' },
  { id: 'blo-dc', label: 'Back loop only double crochet', short: 'BLO DC' },
  { id: 'flo-dc', label: 'Front loop only double crochet', short: 'FLO DC' },
  { id: 'skip', label: 'Skip next stitch', short: 'SKIP' },
  { id: 'sc2tog', label: 'Single crochet 2 together', short: 'SC2TOG' },
  { id: 'hdc2tog', label: 'Half double crochet 2 together', short: 'HDC2TOG' },
  { id: 'dc2tog', label: 'Double crochet 2 together', short: 'DC2TOG' },
  { id: 'inv-dec', label: 'Invisible decrease', short: 'INV DEC' },
  { id: 'fpsc', label: 'Front post single crochet', short: 'FPSC' },
  { id: 'bpsc', label: 'Back post single crochet', short: 'BPSC' },
  { id: 'fphdc', label: 'Front post half double crochet', short: 'FPHDC' },
  { id: 'bphdc', label: 'Back post half double crochet', short: 'BPHDC' },
  { id: 'fpdc', label: 'Front post double crochet', short: 'FPDC' },
  { id: 'bpdc', label: 'Back post double crochet', short: 'BPDC' },
  { id: 'fptr', label: 'Front post treble crochet', short: 'FPTR' },
  { id: 'bptr', label: 'Back post treble crochet', short: 'BPTR' },
  { id: 'esc', label: 'Extended single crochet', short: 'ESC' },
  { id: 'ehdc', label: 'Extended half double crochet', short: 'EHDC' },
  { id: 'edc', label: 'Extended double crochet', short: 'EDC' },
  { id: 'puff', label: 'Puff stitch', short: 'PUFF' },
  { id: 'bobble', label: 'Bobble stitch', short: 'BOBBLE' },
  { id: 'popcorn', label: 'Popcorn stitch', short: 'POPCORN' },
  { id: 'cluster', label: 'Cluster stitch', short: 'CLUSTER' },
  { id: 'shell', label: 'Shell stitch', short: 'SHELL' },
  { id: 'spike', label: 'Spike stitch', short: 'SPIKE' },
  { id: 'mr', label: 'Magic ring', short: 'MR' },
];

const storageKey = 'crochet-counter-notebook-v1';
const newId = () => `round-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function markerFor(id: MarkerId) {
  return markerOptions.find((marker) => marker.id === id) ?? markerOptions[0];
}

function normalizeRound(round: CrochetRound): CrochetRound {
  const legacyMarkerIds: Record<string, MarkerId> = { inc: 'sc-inc', dec: 'sc-dec' };
  const counts = Object.entries(round.counts ?? {}).reduce<Counts>((next, [id, count]) => {
    const markerId = legacyMarkerIds[id] ?? (id as MarkerId);
    next[markerId] = (next[markerId] ?? 0) + (count ?? 0);
    return next;
  }, {});
  return {
    ...round,
    counts,
    patternSteps: (round.patternSteps ?? []).map((step) => ({
      ...step,
      markerId: legacyMarkerIds[step.markerId] ?? step.markerId,
    })),
  };
}

function stepLabelFor(step: PatternStep | null | undefined) {
  if (!step) return '';
  return step.label?.trim() || markerFor(step.markerId).label;
}

function countFor(round: CrochetRound) {
  return Object.values(round.counts).reduce((sum, count) => sum + (count ?? 0), 0);
}

function patternLengthFor(round: CrochetRound) {
  return round.patternSteps.reduce((sum, step) => sum + Math.max(1, step.repeat), 0);
}

function sequenceTotalFor(round: CrochetRound) {
  return patternLengthFor(round) * Math.max(1, round.patternRepeats);
}

function currentPatternMarker(round: CrochetRound, offset = 0): MarkerId | null {
  return currentPatternStep(round, offset)?.markerId ?? null;
}

function currentPatternStep(round: CrochetRound, offset = 0): PatternStep | null {
  const patternLength = patternLengthFor(round);
  if (!patternLength) return null;
  let position = (round.progress + offset) % patternLength;
  if (position < 0) position += patternLength;
  for (const step of round.patternSteps) {
    const repeat = Math.max(1, step.repeat);
    if (position < repeat) return step;
    position -= repeat;
  }
  return round.patternSteps[0] ?? null;
}

function patternPositionFor(round: CrochetRound) {
  const patternLength = patternLengthFor(round);
  if (!patternLength || round.progress >= sequenceTotalFor(round)) return null;
  const repeat = Math.floor(round.progress / patternLength) + 1;
  const step = (round.progress % patternLength) + 1;
  return { repeat, step, stepsInRepeat: patternLength };
}

function patternLabelFor(round: CrochetRound) {
  return round.patternSteps
    .map((step) => `${stepLabelFor(step)}${step.repeat > 1 ? ` × ${step.repeat}` : ''}`)
    .join('  →  ');
}

function totalFor(round: CrochetRound) {
  return round.patternSteps.length ? sequenceTotalFor(round) : round.target;
}

function percentFor(round: CrochetRound) {
  return Math.min(100, Math.round((countFor(round) / Math.max(totalFor(round), 1)) * 100));
}

function emptyState(): TrackerState {
  const firstRound: CrochetRound = {
    id: newId(),
    name: 'Round 1',
    target: 12,
    instruction: '',
    counts: {},
    patternSteps: [],
    patternRepeats: 1,
    progress: 0,
  };
  return {
    activeId: firstRound.id,
    rounds: [firstRound],
  };
}

function isLegacyDemoNotebook(state: TrackerState, projectName?: string) {
  return projectName === 'Meadowlight cardigan' && state.rounds.some((round) => round.id === 'round-2');
}

function AppButton({
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; className?: string }) {
  return (
    <button
      type="button"
      className={`touch-action pressable inline-flex items-center justify-center gap-2 rounded-xl ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  eyebrow,
  onClose,
  children,
}: {
  title: string;
  eyebrow: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(36,52,71,.32)] p-3 backdrop-blur-[3px] sm:items-center" role="presentation">
      <div className="float-in w-full max-w-lg rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 shadow-[0_24px_80px_rgba(47,39,29,.2)] sm:p-7" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mb-6 flex items-start justify-between gap-5">
          <div>
            <p className="mb-1 text-[11px] font-bold uppercase tracking-[.18em] text-[hsl(var(--primary))]">{eyebrow}</p>
            <h2 className="font-display text-3xl text-[hsl(var(--foreground))]">{title}</h2>
          </div>
          <AppButton onClick={onClose} aria-label="Close dialog" data-testid="button-close-dialog" className="h-11 w-11 rounded-full border border-[hsl(var(--border))] text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))]">
            <X size={18} />
          </AppButton>
        </div>
        {children}
      </div>
    </div>
  );
}

function Home() {
  const [state, setState] = useState<TrackerState>(emptyState);
  const [selectedMarker, setSelectedMarker] = useState<MarkerId>('sc');
  const [projectName, setProjectName] = useState('My crochet project');
  const [patternNotes, setPatternNotes] = useState('');
  const [past, setPast] = useState<TrackerState[]>([]);
  const [future, setFuture] = useState<TrackerState[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [modal, setModal] = useState<'project' | 'round' | null>(null);
  const [editingRound, setEditingRound] = useState<CrochetRound | null>(null);
  const [showMarkerList, setShowMarkerList] = useState(false);
  const [completionRoundId, setCompletionRoundId] = useState<string | null>(null);
  const [showFreshNotebookDialog, setShowFreshNotebookDialog] = useState(false);
  const [showUsageGuide, setShowUsageGuide] = useState(false);
  const [roundAction, setRoundAction] = useState<'reset' | 'delete' | null>(null);
  const [keepScreenAwake, setKeepScreenAwake] = useState(false);
  const wakeLockRef = useRef<ScreenWakeLock | null>(null);

  useEffect(() => () => {
    void wakeLockRef.current?.release();
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as { state?: TrackerState; projectName?: string; patternNotes?: string };
        if (parsed.state?.rounds && !isLegacyDemoNotebook(parsed.state, parsed.projectName)) {
          const rounds = parsed.state.rounds.map((round) => normalizeRound({
            ...round,
            patternSteps: round.patternSteps ?? [],
            patternRepeats: round.patternRepeats ?? 1,
            progress: round.progress ?? 0,
          }));
          setState({ ...parsed.state, rounds });
        }
        if (!isLegacyDemoNotebook(parsed.state ?? { rounds: [], activeId: null }, parsed.projectName)) {
          if (typeof parsed.projectName === 'string') setProjectName(parsed.projectName);
          if (typeof parsed.patternNotes === 'string') setPatternNotes(parsed.patternNotes);
        }
      }
    } catch {
      // A malformed notebook should never prevent the counter from opening.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(storageKey, JSON.stringify({ state, projectName, patternNotes }));
  }, [hydrated, state, projectName, patternNotes]);

  const activeRound = useMemo(
    () => state.rounds.find((round) => round.id === state.activeId) ?? state.rounds[0] ?? null,
    [state],
  );
  const activeCount = activeRound ? countFor(activeRound) : 0;
  const activeTotal = activeRound ? totalFor(activeRound) : 0;
  const activePercent = activeRound ? percentFor(activeRound) : 0;
  const isRoundComplete = activeRound ? activeCount >= activeTotal : false;
  const nextStep = activeRound ? currentPatternStep(activeRound) : null;
  const nextMarker = markerFor(nextStep?.markerId ?? selectedMarker);
  const nextStepLabel = isRoundComplete ? 'Round complete' : stepLabelFor(nextStep) || nextMarker.label;
  const lastStep = activeRound && activeCount > 0 ? currentPatternStep(activeRound, -1) : null;
  const lastStepLabel = stepLabelFor(lastStep);
  const patternPosition = activeRound ? patternPositionFor(activeRound) : null;
  const activeMarkerCount = activeRound?.counts[nextMarker.id] ?? 0;
  const completedRounds = state.rounds.filter((round) => countFor(round) >= totalFor(round)).length;
  const isNewNotebook = state.rounds.length === 1 && !activeRound?.instruction && !activeRound?.patternSteps.length && activeCount === 0;

  const commit = (next: TrackerState) => {
    setPast((items) => [...items.slice(-39), state]);
    setState(next);
    setFuture([]);
  };

  const updateRound = (roundId: string, updater: (round: CrochetRound) => CrochetRound) => {
    commit({ ...state, rounds: state.rounds.map((round) => (round.id === roundId ? updater(round) : round)) });
  };

  const changeCount = (amount: number) => {
    if (!activeRound) return;
    const hasPattern = activeRound.patternSteps.length > 0;
    if (amount > 0 && activeCount >= activeTotal) return;
    const markerId = hasPattern ? currentPatternMarker(activeRound, amount > 0 ? 0 : -1) ?? selectedMarker : selectedMarker;
    const nextCount = Math.max(0, (activeRound.counts[markerId] ?? 0) + amount);
    if (amount < 0 && hasPattern && activeRound.progress === 0) return;
    updateRound(activeRound.id, (round) => ({
      ...round,
      counts: { ...round.counts, [markerId]: nextCount },
      progress: hasPattern ? Math.max(0, Math.min(activeTotal, round.progress + amount)) : round.progress,
    }));
    if (amount > 0 && activeCount + 1 >= activeTotal) setCompletionRoundId(activeRound.id);
  };

  const selectRound = (id: string) => {
    if (id !== state.activeId) commit({ ...state, activeId: id });
  };

  const undo = () => {
    const previous = past[past.length - 1];
    if (!previous) return;
    setPast((items) => items.slice(0, -1));
    setFuture((items) => [state, ...items]);
    setState(previous);
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((items) => items.slice(1));
    setPast((items) => [...items, state]);
    setState(next);
  };

  const resetRound = () => {
    if (!activeRound) return;
    updateRound(activeRound.id, (round) => ({ ...round, counts: {}, progress: 0 }));
    setRoundAction(null);
  };

  const startNextRound = () => {
    const completedIndex = state.rounds.findIndex((round) => round.id === completionRoundId);
    const nextRound = completedIndex >= 0 ? state.rounds[completedIndex + 1] : null;
    setCompletionRoundId(null);
    if (!nextRound) {
      setEditingRound(null);
      setModal('round');
      return;
    }
    commit({ ...state, activeId: nextRound.id });
    if (!nextRound.patternSteps.length) {
      setEditingRound(nextRound);
      setModal('round');
    }
  };

  const toggleKeepScreenAwake = async () => {
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) return;
    if (wakeLockRef.current) {
      await wakeLockRef.current.release();
      wakeLockRef.current = null;
      setKeepScreenAwake(false);
      return;
    }
    try {
      wakeLockRef.current = await wakeLock.request('screen');
      setKeepScreenAwake(true);
    } catch {
      setKeepScreenAwake(false);
    }
  };

  const removeRound = () => {
    if (!activeRound || state.rounds.length === 1) return;
    const remaining = state.rounds.filter((round) => round.id !== activeRound.id);
    commit({ rounds: remaining, activeId: remaining[0]?.id ?? null });
    setRoundAction(null);
  };

  const startFresh = () => {
    const next = emptyState();
    commit(next);
    setProjectName('My crochet project');
    setPatternNotes('');
    setShowFreshNotebookDialog(false);
  };

  const saveProject = (name: string, notes: string) => {
    setProjectName(name.trim() || 'My crochet project');
    setPatternNotes(notes.trim());
    setModal(null);
  };

  const saveRound = (name: string, target: number, instruction: string, patternSteps: PatternStep[], patternRepeats: number) => {
    const cleanName = name.trim() || `Round ${state.rounds.length + 1}`;
    const cleanSteps = patternSteps
      .map((step) => ({
        markerId: step.markerId,
        repeat: Math.max(1, Math.round(step.repeat) || 1),
        label: step.label?.trim() || undefined,
      }))
      .filter((step) => markerOptions.some((marker) => marker.id === step.markerId));
    const cleanRepeats = Math.max(1, Math.round(patternRepeats) || 1);
    const cleanTarget = cleanSteps.length ? cleanSteps.reduce((sum, step) => sum + step.repeat, 0) * cleanRepeats : Math.max(1, Math.round(target) || 1);
    if (editingRound) {
      updateRound(editingRound.id, (round) => ({
        ...round,
        name: cleanName,
        target: cleanTarget,
        instruction: instruction.trim(),
        patternSteps: cleanSteps,
        patternRepeats: cleanRepeats,
        progress: cleanSteps.length ? Math.min(round.progress, cleanTarget) : round.progress,
      }));
    } else {
      const round = { id: newId(), name: cleanName, target: cleanTarget, instruction: instruction.trim(), counts: {}, patternSteps: cleanSteps, patternRepeats: cleanRepeats, progress: 0 };
      commit({ rounds: [...state.rounds, round], activeId: round.id });
    }
    setEditingRound(null);
    setModal(null);
  };

  return (
    <div className="paper-grain min-h-[100dvh] bg-[hsl(var(--background))] text-[hsl(var(--foreground))]">
      <div className="mx-auto min-h-[100dvh] max-w-[1500px] lg:grid lg:grid-cols-[310px_minmax(0,1fr)]">
        <aside className="border-b border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] lg:min-h-[100dvh] lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between px-3 pb-2 pt-3 sm:px-7 sm:pb-3 sm:pt-5 lg:block lg:px-7 lg:pb-7">
            <div className="flex items-center gap-3">
              <img src={publicAsset('the-yarn-side-monogram.png')} alt="THE YARN SIDE" className="h-10 w-10 rounded-full border border-[hsl(var(--border))] object-cover lg:hidden" />
              <img src={publicAsset('the-yarn-side-logo.png')} alt="THE YARN SIDE — May the yarn be with you." className="hidden h-auto w-[240px] object-contain lg:block" />
              <div className="lg:hidden">
                <p className="font-display text-xl font-bold leading-none">Crochet Counter</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">THE YARN SIDE</p>
              </div>
            </div>
            <AppButton onClick={() => setModal('project')} data-testid="button-edit-project" aria-label="Edit project details" className="h-11 w-11 rounded-full text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--background))] lg:absolute lg:right-6 lg:top-6">
              <Settings2 size={19} />
            </AppButton>
          </div>

          <div className="hidden px-7 pb-7 lg:block">
            <button type="button" onClick={() => setModal('project')} data-testid="button-project-details" className="group w-full text-left">
              <p className="mb-1 text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Current project</p>
              <p data-testid="text-project-name" className="line-clamp-2 font-display text-[28px] leading-[1.05] text-[hsl(var(--foreground))]">{projectName}</p>
              <p data-testid="text-project-notes" className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-[hsl(var(--muted-foreground))]">{patternNotes || 'Add a little note about this make.'}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[hsl(var(--primary))] opacity-0 transition-opacity group-hover:opacity-100"><Pencil size={13} /> Edit details</span>
            </button>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto px-3 pb-3 sm:px-7 sm:pb-5 lg:block lg:space-y-2 lg:overflow-visible lg:px-5">
            <div className="hidden items-center justify-between px-2 pb-2 lg:flex">
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Your rounds</p>
              <span data-testid="text-completed-rounds" className="text-xs font-bold text-[hsl(var(--muted-foreground))]">{completedRounds}/{state.rounds.length}</span>
            </div>
            {state.rounds.map((round, index) => {
              const done = countFor(round) >= round.target;
              const active = round.id === activeRound?.id;
              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => selectRound(round.id)}
                  data-testid={`button-select-round-${round.id}`}
                  className={`min-w-[150px] rounded-2xl border p-3 text-left transition-all sm:min-w-[174px] lg:min-w-0 ${active ? 'border-[hsl(var(--primary))] bg-[hsl(var(--background))] shadow-[0_7px_18px_rgba(67,51,38,.07)]' : 'border-transparent hover:border-[hsl(var(--sidebar-border))] hover:bg-[hsl(var(--background)/.48)]'}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`relative h-10 w-10 shrink-0 rounded-full ${done ? 'bg-[hsl(var(--secondary))]' : 'bg-[hsl(var(--muted))]'}`} style={{ background: done ? undefined : `conic-gradient(hsl(var(--primary)) ${percentFor(round)}%, hsl(var(--muted)) 0)` }}>
                      <div className="absolute inset-[3px] flex items-center justify-center rounded-full bg-[hsl(var(--sidebar))]">
                        {done ? <CircleCheck size={18} className="text-[hsl(var(--secondary-foreground))]" /> : <span className="text-[11px] font-bold text-[hsl(var(--foreground))]">{percentFor(round)}%</span>}
                      </div>
                    </div>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{round.name || `Round ${index + 1}`}</span>
                      <span className="mt-0.5 block text-xs text-[hsl(var(--muted-foreground))]">{countFor(round)} of {totalFor(round)} steps</span>
                    </span>
                    {active && <ChevronRight size={16} className="shrink-0 text-[hsl(var(--primary))]" />}
                  </div>
                </button>
              );
            })}
            <AppButton onClick={() => { setEditingRound(null); setModal('round'); }} data-testid="button-add-round" className="min-h-[64px] min-w-[150px] border border-dashed border-[hsl(var(--sidebar-border))] px-4 text-sm font-bold text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:bg-[hsl(var(--background)/.5)] sm:min-w-[174px] lg:w-full lg:justify-start lg:px-4">
              <ListPlus size={18} /> Add a round
            </AppButton>
          </div>

          <div className="hidden border-t border-[hsl(var(--sidebar-border))] px-7 py-6 lg:block">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 rounded-full bg-[hsl(var(--accent)/.45)] p-2 text-[hsl(var(--foreground))]"><Info size={15} /></div>
              <p className="text-[12px] leading-relaxed text-[hsl(var(--muted-foreground))]">Tap the big stitch when your hook completes a stitch. If your hands get ahead, undo is always close by.</p>
            </div>
            <AppButton onClick={() => setShowFreshNotebookDialog(true)} data-testid="button-start-fresh" className="mt-5 h-10 w-full border border-[hsl(var(--sidebar-border))] text-xs font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--background))]">Start a fresh notebook</AppButton>
          </div>
        </aside>

        <main className="min-w-0">
          <header className="flex items-center justify-between gap-3 px-3 pb-3 pt-3 sm:px-8 sm:pb-5 sm:pt-5 lg:px-12 lg:pb-6 lg:pt-9">
            <div className="lg:hidden">
              <p className="text-[10px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">Current project</p>
              <p data-testid="text-mobile-project-name" className="mt-1 max-w-[96px] truncate font-display text-xl sm:max-w-[225px] sm:text-2xl">{projectName}</p>
            </div>
            <div className="hidden lg:block">
              <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[hsl(var(--muted-foreground))]">THE YARN SIDE</p>
              <h1 className="mt-1 font-display text-[32px] leading-tight">Made one loop at a time.</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <AppButton onClick={() => setShowUsageGuide(true)} data-testid="button-usage-guide" aria-label="How to use Crochet Counter" className="h-11 w-11 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:border-[hsl(var(--primary))] hover:text-[hsl(var(--primary))]"><Info size={18} /></AppButton>
              {typeof navigator !== 'undefined' && Boolean((navigator as WakeLockNavigator).wakeLock) && <AppButton onClick={toggleKeepScreenAwake} data-testid="button-keep-screen-awake" aria-pressed={keepScreenAwake} aria-label={keepScreenAwake ? 'Allow screen to sleep' : 'Keep screen awake'} className={`hidden h-11 rounded-full border px-3 text-xs font-bold sm:inline-flex ${keepScreenAwake ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--primary))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]'}`}><Sun size={17} /> Awake</AppButton>}
              <AppButton onClick={undo} disabled={!past.length} data-testid="button-undo" aria-label="Undo last action" className="h-11 w-11 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] enabled:hover:border-[hsl(var(--primary))] enabled:hover:text-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-35"><Undo2 size={18} /></AppButton>
              <AppButton onClick={redo} disabled={!future.length} data-testid="button-redo" aria-label="Redo last action" className="h-11 w-11 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] enabled:hover:border-[hsl(var(--primary))] enabled:hover:text-[hsl(var(--primary))] disabled:cursor-not-allowed disabled:opacity-35"><Redo2 size={18} /></AppButton>
              <AppButton onClick={() => setModal('project')} data-testid="button-mobile-edit-project" aria-label="Edit project details" className="h-11 w-11 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))] lg:hidden"><Settings2 size={18} /></AppButton>
            </div>
          </header>

          <div className="px-3 pb-8 sm:px-8 sm:pb-10 lg:px-12 lg:pb-14">
            {isNewNotebook && (
              <div className="rise-in mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[hsl(var(--accent)/.55)] bg-[hsl(var(--accent)/.17)] px-4 py-3 text-sm text-[hsl(var(--foreground))]">
                <span><strong className="font-bold">Start with Round 1.</strong> Add your stitch sequence, then tap the large stitch button as you work.</span>
                <AppButton onClick={() => setShowUsageGuide(true)} data-testid="button-open-usage-guide" className="h-9 rounded-lg px-3 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card)/.65)]">How to use</AppButton>
              </div>
            )}

            {activeRound ? (
              <>
                <section className="rise-in rounded-[1.75rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-4 soft-shadow sm:p-7 lg:p-9">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-[hsl(var(--muted))] px-3 py-1 text-[11px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Counting now</span>
                        {activePercent >= 100 && <span data-testid="status-round-complete" className="inline-flex items-center gap-1 rounded-full bg-[hsl(var(--secondary)/.24)] px-3 py-1 text-[11px] font-bold uppercase tracking-[.1em] text-[hsl(var(--secondary-foreground))]"><Check size={13} /> Complete</span>}
                      </div>
                      <h2 data-testid="text-active-round-name" className="mt-3 font-display text-3xl leading-none sm:text-5xl">{activeRound.name}</h2>
                      <p data-testid="text-round-instruction" className="mt-3 max-w-xl break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{activeRound.instruction || 'Add a stitch sequence so the next move stays close.'}</p>
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-1">
                      <AppButton onClick={() => { setEditingRound(activeRound); setModal('round'); }} data-testid="button-edit-round" aria-label="Edit current round" className="h-11 w-11 rounded-full text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><Pencil size={17} /></AppButton>
                      <AppButton onClick={() => setRoundAction('reset')} data-testid="button-reset-round" aria-label="Reset current round" className="h-11 rounded-full px-3 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--foreground))]"><RotateCcw size={17} /> Reset</AppButton>
                      <AppButton onClick={() => setRoundAction('delete')} disabled={state.rounds.length === 1} data-testid="button-delete-round" aria-label="Delete current round" className="h-11 w-11 rounded-full text-[hsl(var(--muted-foreground))] enabled:hover:bg-[hsl(var(--destructive)/.12)] enabled:hover:text-[hsl(var(--destructive))] disabled:opacity-25"><Trash2 size={17} /></AppButton>
                    </div>
                  </div>

                  <div data-testid="mobile-round-progress" className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.55)] p-3 lg:hidden">
                    <div className="flex items-end justify-between gap-4">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Round progress</p>
                        <p className="mt-1 font-display text-3xl leading-none">{activeCount}<span className="font-sans text-base text-[hsl(var(--muted-foreground))]"> / {activeTotal}</span></p>
                      </div>
                      <span className="font-display text-3xl leading-none text-[hsl(var(--primary))]">{activePercent}%</span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                      <div className="h-full rounded-full bg-[hsl(var(--primary))] transition-[width] duration-300 ease-out" style={{ width: `${activePercent}%` }} />
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">{activePercent >= 100 ? 'Beautiful. This round is tucked in.' : `${Math.max(activeTotal - activeCount, 0)} pattern steps left in this round.`}</p>
                  </div>

                  <div className="mt-5 grid gap-5 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_265px] lg:items-center lg:gap-12">
                    <div className="flex flex-col items-center">
                      <div className="mb-3 w-full max-w-[380px] rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.58)] px-3 py-2 text-center sm:mb-4 sm:px-4 sm:py-3">
                        <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Last completed</p>
                        <p data-testid="text-counter-last-step" className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-bold leading-snug">{lastStepLabel || 'Nothing yet'}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => changeCount(1)}
                        disabled={isRoundComplete}
                        data-testid="button-count-stitch"
                        aria-label={`Mark ${nextStepLabel} as complete. Current count ${activeCount}`}
                        className="counter-touch group relative flex aspect-square w-[min(56vw,220px)] max-w-[380px] items-center justify-center rounded-full border-[9px] border-[hsl(var(--primary)/.18)] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] shadow-[0_14px_0_hsl(var(--accent)),0_22px_30px_rgba(102,57,45,.18)] transition-all duration-150 hover:brightness-[1.03] active:translate-y-2 active:shadow-[0_7px_0_hsl(var(--accent)),0_12px_18px_rgba(102,57,45,.15)] sm:w-[min(58vw,380px)] sm:border-[11px] sm:shadow-[0_20px_0_hsl(var(--accent)),0_28px_38px_rgba(102,57,45,.18)] disabled:cursor-default disabled:brightness-90"
                      >
                        <span className="absolute inset-3 rounded-full border border-dashed border-[hsl(var(--primary-foreground)/.3)]" />
                        <span className="relative text-center">
                          <span data-testid="text-current-marker-short" className="block text-[13px] font-bold uppercase tracking-[.2em] opacity-75">{nextMarker.short}</span>
                          <span data-testid="text-current-marker-label" className="mt-2 block max-w-[175px] break-words [overflow-wrap:anywhere] font-display text-3xl leading-[.92] sm:mt-3 sm:max-w-[225px] sm:text-5xl">{nextStepLabel}</span>
                          <span className="mt-3 block text-[10px] font-bold uppercase tracking-[.14em] opacity-75 sm:mt-5 sm:text-xs sm:tracking-[.16em]">{isRoundComplete ? 'ready for the next round' : 'next pattern step'}</span>
                        </span>
                      </button>
                      <div className="mt-5 flex flex-wrap items-center justify-center gap-3 sm:mt-9">
                        <AppButton onClick={() => changeCount(-1)} disabled={activeRound.patternSteps.length ? activeRound.progress === 0 : activeMarkerCount === 0} data-testid="button-decrement-stitch" aria-label="Go back one pattern step" className="h-12 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] px-4 text-sm font-bold text-[hsl(var(--foreground))] enabled:hover:border-[hsl(var(--primary))] disabled:opacity-35"><Undo2 size={17} /> Back</AppButton>
                        <p className="min-w-[150px] text-center text-xs text-[hsl(var(--muted-foreground))]"><strong className="block text-sm text-[hsl(var(--foreground))]">{activeCount} of {activeTotal}</strong> pattern steps</p>
                        <AppButton onClick={() => changeCount(1)} disabled={isRoundComplete} data-testid="button-increment-stitch" aria-label="Add one pattern step" className="h-12 w-12 rounded-full border border-[hsl(var(--border))] bg-[hsl(var(--card))] text-[hsl(var(--primary))] enabled:hover:border-[hsl(var(--primary))] disabled:opacity-35"><Plus size={19} /></AppButton>
                      </div>
                      {isRoundComplete ? (
                        <AppButton onClick={() => setCompletionRoundId(activeRound.id)} data-testid="button-continue-next-round" className="mt-5 h-11 bg-[hsl(var(--primary))] px-4 text-sm font-bold text-[hsl(var(--primary-foreground))] shadow-[0_3px_0_hsl(var(--accent))]">Continue to next round <ChevronRight size={17} /></AppButton>
                      ) : (
                        <div className="mt-4 w-full max-w-[380px] rounded-xl bg-[hsl(var(--secondary)/.16)] px-3 py-2 text-center sm:mt-5 sm:px-4 sm:py-3">
                          <p className="text-[10px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Do next</p>
                          <p data-testid="text-counter-next-step" className="mt-1 break-words [overflow-wrap:anywhere] text-sm font-bold leading-snug">{nextStepLabel}</p>
                          <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Tap only after you finish this full instruction.</p>
                        </div>
                      )}
                    </div>

                    <div className="hidden lg:block lg:border-l lg:border-[hsl(var(--border))] lg:pl-10">
                      <div className="flex items-end justify-between gap-4">
                        <div>
                          <p className="text-[11px] font-bold uppercase tracking-[.16em] text-[hsl(var(--muted-foreground))]">Round progress</p>
                           <p data-testid="text-round-count" className="mt-2 font-display text-4xl">{activeCount}<span className="font-sans text-lg text-[hsl(var(--muted-foreground))]"> / {activeTotal}</span></p>
                        </div>
                        <span data-testid="text-round-percent" className="font-display text-3xl text-[hsl(var(--primary))]">{activePercent}%</span>
                      </div>
                      <div className="mt-4 h-3 overflow-hidden rounded-full bg-[hsl(var(--muted))]">
                        <div data-testid="progress-round" className="h-full rounded-full bg-[hsl(var(--primary))] transition-[width] duration-300 ease-out" style={{ width: `${activePercent}%` }} />
                      </div>
                       <p className="mt-3 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">{activePercent >= 100 ? 'Beautiful. This round is tucked in.' : `${Math.max(activeTotal - activeCount, 0)} pattern steps left in this round.`}</p>
                      <div className="mt-5 rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background)/.45)] p-4">
                        <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[hsl(var(--muted-foreground))]">Your place</p>
                        <p data-testid="text-last-completed-step" className="mt-2 text-sm leading-relaxed"><span className="font-bold">Last completed:</span> {lastStepLabel || 'Nothing yet'}</p>
                        <p data-testid="text-next-step" className="mt-1 text-sm leading-relaxed"><span className="font-bold">Do next:</span> {isRoundComplete ? 'Start the next round when you are ready.' : nextStepLabel}</p>
                        {patternPosition && <p data-testid="text-pattern-position" className="mt-2 text-xs font-bold text-[hsl(var(--primary))]">Repeat {patternPosition.repeat} of {activeRound.patternRepeats} · Step {patternPosition.step} of {patternPosition.stepsInRepeat}</p>}
                        <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">This stopping point is saved automatically on this device.</p>
                      </div>
                      <div className="mt-8 rounded-2xl bg-[hsl(var(--muted)/.6)] p-4">
                        <div className="flex items-center justify-between">
                           <p className="text-xs font-bold uppercase tracking-[.13em] text-[hsl(var(--muted-foreground))]">Pattern rhythm</p>
                          <AppButton onClick={() => { setEditingRound(activeRound); setModal('round'); }} data-testid="button-edit-recipe" className="h-8 rounded-lg px-2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"><Pencil size={14} /></AppButton>
                        </div>
                         {activeRound.patternSteps.length > 0 && <p data-testid="text-pattern-summary" className="mt-2 break-words [overflow-wrap:anywhere] text-sm font-bold leading-relaxed text-[hsl(var(--primary))]">{patternLabelFor(activeRound)} <span className="font-normal text-[hsl(var(--muted-foreground))]">× {activeRound.patternRepeats} repeats</span></p>}
                         {activeRound.instruction && <p className="mt-2 break-words [overflow-wrap:anywhere] text-sm leading-relaxed text-[hsl(var(--foreground))]">{activeRound.instruction}</p>}
                         {!activeRound.patternSteps.length && !activeRound.instruction && <p className="mt-2 text-sm leading-relaxed text-[hsl(var(--foreground))]">No stitch sequence yet. Add one to see the next stitch automatically.</p>}
                      </div>
                    </div>
                  </div>
                </section>

                <section className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,.72fr)]">
                  <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                         <h3 className="font-display text-2xl">{activeRound.patternSteps.length ? 'Stitch sequence' : 'Choose your stitch'}</h3>
                         <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{activeRound.patternSteps.length ? 'Each tap advances to the next stitch automatically.' : 'Add a sequence to stop guessing which stitch comes next.'}</p>
                      </div>
                       <AppButton onClick={() => { setEditingRound(activeRound); setModal('round'); }} data-testid="button-edit-pattern" className="h-10 rounded-lg border border-[hsl(var(--border))] px-3 text-xs font-bold text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--muted))] hover:text-[hsl(var(--primary))]">
                         <Pencil size={14} /> {activeRound.patternSteps.length ? 'Edit sequence' : 'Add sequence'}
                      </AppButton>
                    </div>
                     {activeRound.patternSteps.length ? (
                       <div className="mt-5">
                         <div className="flex flex-wrap items-center gap-2">
                           {activeRound.patternSteps.map((step, index) => (
                             <Fragment key={`${step.markerId}-${index}`}>
                               {index > 0 && <ChevronRight size={15} className="text-[hsl(var(--muted-foreground))]" />}
                               <span className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${currentPatternStep(activeRound) === step ? 'border-[hsl(var(--primary))] bg-[hsl(var(--primary)/.1)] text-[hsl(var(--foreground))]' : 'border-[hsl(var(--border))] bg-[hsl(var(--background)/.35)] text-[hsl(var(--muted-foreground))]'}`}>
                                 <span className="text-[hsl(var(--primary))]">{markerFor(step.markerId).short}</span>
                                 <span className="break-words [overflow-wrap:anywhere]">{stepLabelFor(step)}</span>
                                 {step.repeat > 1 && <span>× {step.repeat}</span>}
                               </span>
                             </Fragment>
                           ))}
                         </div>
                         <p className="mt-4 text-xs text-[hsl(var(--muted-foreground))]">This pattern repeats <strong className="text-[hsl(var(--foreground))]">{activeRound.patternRepeats} times</strong>. The highlighted stitch is next.</p>
                       </div>
                     ) : (
                       <p className="mt-5 rounded-xl border border-dashed border-[hsl(var(--border))] px-4 py-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">This round is in manual mode. Add the stitch order so the counter can guide you.</p>
                     )}
                  </div>
                  <div className="rounded-[1.5rem] border border-[hsl(var(--border))] bg-[hsl(var(--card))] p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-display text-2xl">Actions in this round</h3>
                        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">Each count is one completed pattern action.</p>
                      </div>
                      <span data-testid="text-total-round-stitches" className="font-display text-2xl text-[hsl(var(--primary))]">{activeCount}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {Object.entries(activeRound.counts).filter(([, count]) => (count ?? 0) > 0).map(([id, count]) => {
                        const marker = markerFor(id as MarkerId);
                        return <span key={id} data-testid={`text-marker-count-${id}`} className="inline-flex items-center gap-2 rounded-full bg-[hsl(var(--muted))] px-3 py-2 text-xs font-bold"><span className="text-[hsl(var(--primary))]">{marker.short}</span>{count}</span>;
                      })}
                      {activeCount === 0 && <p data-testid="text-empty-counts" className="rounded-xl border border-dashed border-[hsl(var(--border))] px-3 py-4 text-sm text-[hsl(var(--muted-foreground))]">Your stitch tally will appear here.</p>}
                    </div>
                  </div>
                </section>
              </>
            ) : (
              <div className="rise-in flex min-h-[60vh] items-center justify-center rounded-[1.75rem] border border-dashed border-[hsl(var(--border))] bg-[hsl(var(--card)/.5)] p-8 text-center">
                <div>
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[hsl(var(--accent)/.35)]"><NotebookPen size={27} /></div>
                  <h2 className="mt-5 font-display text-4xl">A blank page, ready.</h2>
                  <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Add your first round and give your hands somewhere kind to keep count.</p>
                  <AppButton onClick={() => { setEditingRound(null); setModal('round'); }} data-testid="button-add-first-round" className="mt-6 h-12 bg-[hsl(var(--primary))] px-5 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]"><Plus size={18} /> Add first round</AppButton>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {modal === 'project' && <ProjectModal name={projectName} notes={patternNotes} onClose={() => setModal(null)} onSave={saveProject} />}
      {modal === 'round' && <RoundModal round={editingRound} onClose={() => { setModal(null); setEditingRound(null); }} onSave={saveRound} />}
      {completionRoundId && <RoundCompleteModal rounds={state.rounds} completedRoundId={completionRoundId} onClose={() => setCompletionRoundId(null)} onStartNext={startNextRound} />}
      {showFreshNotebookDialog && <FreshNotebookModal onClose={() => setShowFreshNotebookDialog(false)} onConfirm={startFresh} />}
      {showUsageGuide && <UsageGuideModal onClose={() => setShowUsageGuide(false)} />}
      {roundAction && activeRound && <RoundActionModal action={roundAction} roundName={activeRound.name} onClose={() => setRoundAction(null)} onConfirm={roundAction === 'reset' ? resetRound : removeRound} />}
    </div>
  );
}

function RoundActionModal({
  action,
  roundName,
  onClose,
  onConfirm,
}: {
  action: 'reset' | 'delete';
  roundName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const isReset = action === 'reset';
  return (
    <Modal title={isReset ? `Reset ${roundName}?` : `Delete ${roundName}?`} eyebrow={isReset ? 'Start this round again' : 'Remove this round'} onClose={onClose}>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        {isReset ? 'All completed pattern steps in this round will return to zero.' : 'This round and its progress will be removed from this notebook.'}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <AppButton onClick={onClose} data-testid="button-cancel-round-action" className="h-12 border border-[hsl(var(--border))] px-4 font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">Cancel</AppButton>
        <AppButton onClick={onConfirm} data-testid={`button-confirm-${action}-round`} className="h-12 bg-[hsl(var(--primary))] px-4 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]">{isReset ? 'Reset round' : 'Delete round'}</AppButton>
      </div>
    </Modal>
  );
}

function FreshNotebookModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <Modal title="Start a fresh notebook?" eyebrow="New beginning" onClose={onClose}>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">Your current rounds, counts, and project notes will be replaced with one empty round.</p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <AppButton onClick={onClose} data-testid="button-cancel-start-fresh" className="h-12 border border-[hsl(var(--border))] px-4 font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">Keep current notebook</AppButton>
        <AppButton onClick={onConfirm} data-testid="button-confirm-start-fresh" className="h-12 bg-[hsl(var(--primary))] px-4 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]">Start fresh</AppButton>
      </div>
    </Modal>
  );
}

function UsageGuideModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="How to use" eyebrow="Crochet Counter" onClose={onClose}>
      <ol className="space-y-4 text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        <li><strong className="text-[hsl(var(--foreground))]">1. Set up Round 1.</strong> Use the pencil to add the round name, your exact pattern instructions, and the stitch sequence.</li>
        <li><strong className="text-[hsl(var(--foreground))]">2. Add each full action.</strong> Include details such as “single crochet increase,” “BLO single crochet,” or “skip next stitch,” so the main button always says exactly what comes next.</li>
        <li><strong className="text-[hsl(var(--foreground))]">3. Tap after you finish.</strong> The large stitch button advances one pattern step. The previous and next labels help you confirm your place.</li>
        <li><strong className="text-[hsl(var(--foreground))]">4. Correct mistakes easily.</strong> Use Back or Undo for the last action, and Reset only when you want to begin the entire round again.</li>
        <li><strong className="text-[hsl(var(--foreground))]">5. Continue round by round.</strong> When a round is complete, confirm whether you are ready to start the next one. Your progress saves automatically in this browser.</li>
      </ol>
      <AppButton onClick={onClose} data-testid="button-close-usage-guide" className="mt-6 h-12 w-full bg-[hsl(var(--primary))] px-4 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]">Got it</AppButton>
    </Modal>
  );
}

function RoundCompleteModal({
  rounds,
  completedRoundId,
  onClose,
  onStartNext,
}: {
  rounds: CrochetRound[];
  completedRoundId: string;
  onClose: () => void;
  onStartNext: () => void;
}) {
  const completedIndex = rounds.findIndex((round) => round.id === completedRoundId);
  const nextRound = completedIndex >= 0 ? rounds[completedIndex + 1] : null;
  const nextRoundHasPattern = Boolean(nextRound?.patternSteps.length);
  const nextRoundName = nextRound?.name || `Round ${rounds.length + 1}`;
  return (
    <Modal title="Round complete!" eyebrow="Nice work" onClose={onClose}>
      <p className="text-sm leading-relaxed text-[hsl(var(--muted-foreground))]">
        Ready to start <strong className="text-[hsl(var(--foreground))]">{nextRoundName}</strong>?
        {nextRound && !nextRoundHasPattern && ' Its pattern has not been added yet.'}
      </p>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <AppButton onClick={onClose} className="h-12 border border-[hsl(var(--border))] px-4 font-bold text-[hsl(var(--foreground))] hover:bg-[hsl(var(--muted))]">Stay on this round</AppButton>
        <AppButton onClick={onStartNext} data-testid="button-start-next-round" className="h-12 bg-[hsl(var(--primary))] px-4 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]">
          {nextRound ? (nextRoundHasPattern ? `Start ${nextRoundName}` : `Add ${nextRoundName} pattern`) : 'Add next round'}
        </AppButton>
      </div>
    </Modal>
  );
}

function ProjectModal({ name, notes, onClose, onSave }: { name: string; notes: string; onClose: () => void; onSave: (name: string, notes: string) => void }) {
  const [draftName, setDraftName] = useState(name);
  const [draftNotes, setDraftNotes] = useState(notes);
  return (
    <Modal title="Project details" eyebrow="Your notebook" onClose={onClose}>
      <div className="space-y-5">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Project name</span>
          <input value={draftName} onChange={(event) => setDraftName(event.target.value)} data-testid="input-project-name" autoFocus className="h-14 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/.6)] px-4 text-base outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]" placeholder="A name for this make" />
        </label>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Pattern notes</span>
          <textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} data-testid="input-pattern-notes" rows={4} className="w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/.6)] px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]" placeholder="Yarn, hook size, a reminder for later..." />
        </label>
        <AppButton onClick={() => onSave(draftName, draftNotes)} data-testid="button-save-project" className="h-13 w-full bg-[hsl(var(--primary))] px-5 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]"><Check size={18} /> Save details</AppButton>
      </div>
    </Modal>
  );
}

function RoundModal({ round, onClose, onSave }: { round: CrochetRound | null; onClose: () => void; onSave: (name: string, target: number, instruction: string, patternSteps: PatternStep[], patternRepeats: number) => void }) {
  const [name, setName] = useState(round?.name ?? '');
  const [target, setTarget] = useState(String(round?.target ?? 12));
  const [instruction, setInstruction] = useState(round?.instruction ?? '');
  const [steps, setSteps] = useState<PatternStep[]>(
    round?.patternSteps?.length ? round.patternSteps : [{ markerId: 'sc', repeat: 1 }],
  );
  const [sequenceRepeats, setSequenceRepeats] = useState(String(round?.patternRepeats ?? 1));
  const sequenceLength = steps.reduce((sum, step) => sum + Math.max(1, step.repeat), 0);
  const calculatedTotal = sequenceLength * Math.max(1, Number(sequenceRepeats) || 1);

  const updateStep = (index: number, patch: Partial<PatternStep>) => {
    setSteps((items) => items.map((step, stepIndex) => (stepIndex === index ? { ...step, ...patch } : step)));
  };

  return (
    <Modal title={round ? 'Edit this round' : 'Add a round'} eyebrow="Build the stitch order" onClose={onClose}>
      <div className="max-h-[min(78vh,720px)] space-y-5 overflow-y-auto pr-1">
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Round name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} data-testid="input-round-name" autoFocus className="h-14 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/.6)] px-4 text-base outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]" placeholder="Round 4" />
        </label>
        <div className="rounded-2xl border border-[hsl(var(--primary)/.3)] bg-[hsl(var(--primary)/.06)] p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--primary))]">Stitch order</p>
              <p className="mt-1 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">Add the stitches in the exact order you work them.</p>
            </div>
            <span data-testid="text-calculated-total" className="shrink-0 font-display text-2xl text-[hsl(var(--primary))]">{calculatedTotal}</span>
          </div>
          <div className="mt-4 space-y-2">
            {steps.map((step, index) => (
              <div key={`${step.markerId}-${index}`} className="rounded-xl border border-[hsl(var(--border))] p-2">
                <div className="flex items-center gap-2">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[hsl(var(--card))] text-xs font-bold text-[hsl(var(--muted-foreground))]">{index + 1}</span>
                  <select
                    value={step.markerId}
                    onChange={(event) => updateStep(index, { markerId: event.target.value as MarkerId })}
                    data-testid={`select-pattern-marker-${index}`}
                    className="h-12 min-w-0 flex-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3 text-sm font-bold outline-none focus:border-[hsl(var(--primary))]"
                  >
                    {markerOptions.map((marker) => <option key={marker.id} value={marker.id}>{marker.short} — {marker.label}</option>)}
                  </select>
                  <label className="flex h-12 w-[76px] shrink-0 items-center gap-1 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-3">
                    <span className="text-xs text-[hsl(var(--muted-foreground))]">×</span>
                    <input type="number" min="1" value={step.repeat} onChange={(event) => updateStep(index, { repeat: Math.max(1, Number(event.target.value) || 1) })} aria-label={`Repeat step ${index + 1}`} className="w-full bg-transparent text-sm font-bold outline-none" />
                  </label>
                  <AppButton onClick={() => setSteps((items) => items.filter((_, stepIndex) => stepIndex !== index))} disabled={steps.length === 1} aria-label={`Remove stitch ${index + 1}`} className="h-10 w-10 shrink-0 rounded-lg text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--destructive)/.1)] hover:text-[hsl(var(--destructive))]"><X size={16} /></AppButton>
                </div>
                <input value={step.label ?? ''} onChange={(event) => updateStep(index, { label: event.target.value })} aria-label={`Exact instruction for step ${index + 1}`} placeholder={`Exact instruction (optional): ${markerFor(step.markerId).label}`} className="mt-2 h-10 w-full rounded-lg border border-[hsl(var(--input))] bg-[hsl(var(--background)/.6)] px-3 text-xs outline-none focus:border-[hsl(var(--primary))]" />
              </div>
            ))}
          </div>
          <AppButton onClick={() => setSteps((items) => [...items, { markerId: 'sc', repeat: 1 }])} data-testid="button-add-pattern-step" className="mt-3 h-10 rounded-lg border border-dashed border-[hsl(var(--primary)/.45)] px-3 text-xs font-bold text-[hsl(var(--primary))] hover:bg-[hsl(var(--card)/.7)]"><Plus size={15} /> Add stitch to order</AppButton>
          <label className="mt-4 block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Repeat this order</span>
            <div className="flex items-center gap-3">
              <input type="number" min="1" value={sequenceRepeats} onChange={(event) => setSequenceRepeats(event.target.value)} data-testid="input-pattern-repeats" className="h-12 w-28 rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--card))] px-4 text-base font-bold outline-none focus:border-[hsl(var(--primary))]" />
              <span className="text-sm text-[hsl(var(--muted-foreground))]">times · {calculatedTotal} total stitches</span>
            </div>
          </label>
          <p className="mt-3 rounded-xl bg-[hsl(var(--card)/.7)] px-3 py-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]"><strong className="text-[hsl(var(--foreground))]">Preview:</strong> {steps.length ? patternLabelFor({ ...(round ?? { id: '', name: '', target: 1, instruction: '', counts: {}, patternSteps: [], patternRepeats: 1, progress: 0 }), patternSteps: steps }) : 'No sequence yet'}</p>
        </div>
        <label className="block">
          <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Pattern note <span className="font-normal normal-case tracking-normal">(optional)</span></span>
          <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} data-testid="input-round-instruction" rows={3} className="w-full resize-none rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/.6)] px-4 py-3 text-sm leading-relaxed outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]" placeholder="For example: repeat around, join with slip stitch..." />
        </label>
        {steps.length === 0 && (
          <label className="block">
            <span className="mb-2 block text-xs font-bold uppercase tracking-[.12em] text-[hsl(var(--muted-foreground))]">Manual target stitches</span>
            <input type="number" min="1" value={target} onChange={(event) => setTarget(event.target.value)} data-testid="input-round-target" className="h-14 w-full rounded-xl border border-[hsl(var(--input))] bg-[hsl(var(--background)/.6)] px-4 text-base outline-none transition-colors focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary)/.15)]" />
          </label>
        )}
        <AppButton onClick={() => onSave(name, Number(target), instruction, steps, Number(sequenceRepeats))} data-testid="button-save-round" className="h-13 w-full bg-[hsl(var(--primary))] px-5 font-bold text-[hsl(var(--primary-foreground))] shadow-[0_4px_0_hsl(var(--accent))]"><Check size={18} /> {round ? 'Save round' : 'Add round'}</AppButton>
      </div>
    </Modal>
  );
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
