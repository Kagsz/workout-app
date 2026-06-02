import React, { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import appBanner from "./assets/appbanner1.png";

// ===== TYPES =====

type Role = "admin" | "member";
type Screen = "members" | "memberOverview" | "adminPrograms" | "builder" | "input" | "programs" | "routines" | "routine" | "graph";
type BuilderSource = "memberOverview" | "adminPrograms";
type BlockType = "paired" | "single";
type GraphAxis = "date" | "session";

type Exercise = {
  id: string;
  name: string;
  target: string;
  metric: string;
};

type Block = {
  id: string;
  type: BlockType;
  title: string;
  duration: string;
  notes: string;
  exercises: Exercise[];
};

type Routine = {
  id: string;
  label: string;
  blocks: Block[];
};

type Program = {
  id: string;
  name: string;
  startedAt: string;
  status: "active" | "paused" | "closed";
  routines: Routine[];
  notes?: string;
  memberId?: string;
};

type Member = {
  id: string;
  clientId: string;
  name: string;
  programClosed?: boolean;
  archived?: boolean;
};

type SessionExerciseInput = {
  exerciseId: string;
  exerciseName: string;
  weight: string;
  performance: string;
  setsCompleted: string;
  target?: string;
  metric?: string;
};

type SessionBlockInput = {
  blockId: string;
  blockTitle: string;
  entries: SessionExerciseInput[];
};

type SessionDraft = {
  programId: string;
  routineId: string;
  memberId: string;
  date: string;
  sessionNumber: string;
  blocks: SessionBlockInput[];
};

type SavedSession = SessionDraft & {
  id: string;
  createdAt: string;
};

type GraphPoint = {
  x: string | number;
  y: number;
  weight: string;
  sessionId: string;
  sessionNumber: number;
  date: string;
  performance: string;
  duration: string;
  exerciseName: string;
  target: string;
  metric: string;
  blockType: BlockType;
  slot: 1 | 2;
};

type GraphSeries = {
  exerciseId: string;
  exerciseName: string;
  points: GraphPoint[];
};


type ChartPoint = GraphPoint & {
  chartX: number;
  xLabel: string;
};

type PositionedSeries = GraphSeries & {
  slot: 1 | 2;
  shape: "circle" | "square" | "triangle" | "diamond";
  dash?: string;
  stroke: string;
  isChangedMidRoutine: boolean;
  points: ChartPoint[];
};


const WEIGHT_COLOR_BANDS = [
  ["#2563eb", "#06b6d4", "#22c55e", "#eab308", "#f97316", "#ef4444"],
  ["#7c3aed", "#3b82f6", "#14b8a6", "#84cc16", "#f59e0b", "#ec4899"],
  ["#0f766e", "#16a34a", "#ca8a04", "#ea580c", "#dc2626", "#9333ea"],
  ["#1d4ed8", "#0891b2", "#65a30d", "#d97706", "#db2777", "#7c3aed"],
] as const;

const getStableWeightColor = (weight: string) => {
  const normalized = normalizeWeightInput(weight).toUpperCase();

  if (!normalized || normalized === "BW" || normalized === "B") return "#9ca3af";

  const numericWeight = Number(normalized);
  if (Number.isFinite(numericWeight)) {
    const steppedIndex = Math.max(0, Math.round(numericWeight / 2.5));
    const bandSize = WEIGHT_COLOR_BANDS[0].length;
    const bandIndex = Math.floor(steppedIndex / bandSize) % WEIGHT_COLOR_BANDS.length;
    const colorIndex = steppedIndex % bandSize;
    return WEIGHT_COLOR_BANDS[bandIndex][colorIndex];
  }

  let hash = 0;
  for (let index = 0; index < normalized.length; index += 1) {
    hash = (hash * 31 + normalized.charCodeAt(index)) >>> 0;
  }

  const flatPalette = WEIGHT_COLOR_BANDS.flat();
  return flatPalette[hash % flatPalette.length];
};

const buildTrianglePath = (cx: number, cy: number, size: number) => {
  const half = size / 2;
  const height = size * 0.9;
  return `${cx},${cy - height / 2} ${cx - half},${cy + height / 2} ${cx + half},${cy + height / 2}`;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const formatTargetLabel = (target: string, metric: string) => {
  const trimmedTarget = String(target || "").trim();
  const trimmedMetric = String(metric || "").trim();

  if (!trimmedTarget) return "—";
  if (!trimmedMetric) return trimmedTarget;

  const metricPattern = new RegExp(`\\b${escapeRegExp(trimmedMetric)}\\b`, "i");
  return metricPattern.test(trimmedTarget) ? trimmedTarget : `${trimmedTarget} ${trimmedMetric}`.trim();
};


function ExerciseDot({
  cx,
  cy,
  payload,
  shape,
}: {
  cx?: number;
  cy?: number;
  payload?: GraphPoint | ChartPoint;
  shape: "circle" | "square" | "triangle" | "diamond";
}) {
  if (cx == null || cy == null || !payload) return null;

  const fill = getStableWeightColor(payload.weight);
  const stroke = fill;
  const size = shape === "diamond" ? 10 : 8;
  const strokeWidth = 1.5;

  if (shape === "square") {
    return <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
  }

  if (shape === "triangle") {
    return <polygon points={buildTrianglePath(cx, cy, size)} fill={fill} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
  }

  if (shape === "diamond") {
    return <polygon points={`${cx},${cy - size / 2} ${cx + size / 2},${cy} ${cx},${cy + size / 2} ${cx - size / 2},${cy}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
  }

  return <circle cx={cx} cy={cy} r={size / 2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />;
}

function GraphTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: GraphPoint }>;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  const durationValue = String(point.duration || "").trim();
  const durationNumber = Number(durationValue);
  const durationLabel = durationValue
    ? `${durationValue} minute${Number.isFinite(durationNumber) && durationNumber === 1 ? "" : "s"}`
    : "—";

  const targetContext =
    point.blockType === "single"
      ? `${durationLabel} for ${point.target || point.metric || "output"}`
      : `Target: ${formatTargetLabel(point.target, point.metric)}`;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-zinc-900">{point.exerciseName}</div>
      <div className="mt-1 text-zinc-700">{targetContext}</div>
    </div>
  );
}

function getSmartTooltipPosition(activePoint: ChartPoint | null, chartWidth: number) {
  const topCenter = { x: Math.max(72, chartWidth / 2 - 92), y: 8 };
  if (!activePoint) return topCenter;

  const hoveredX = Number(activePoint.chartX ?? activePoint.x ?? 0);
  if (hoveredX >= 3.5 && hoveredX <= 5.5) {
    return hoveredX < 4.5 ? { x: chartWidth - 214, y: 8 } : { x: 24, y: 8 };
  }

  return topCenter;
}


const PAIRED_SAME_Y_TOTAL_OFFSET = 0.26;

const getYAxisTickDy = (value: number) => {
  if (value === 7) return 2;
  if (value === 6) return 1;
  if (value === 1) return -1;
  return 0;
};

function GraphYAxisTick({
  x,
  y,
  payload,
}: {
  x?: number;
  y?: number;
  payload?: { value?: number | string };
}) {
  if (x == null || y == null || payload?.value == null) return null;

  const numericValue = Number(payload.value);
  const dy = Number.isFinite(numericValue) ? getYAxisTickDy(numericValue) : 0;

  return (
    <text x={x} y={y} dy={dy} textAnchor="end" fill="#71717a" fontSize={10}>
      {payload.value}
    </text>
  );
}


const GRAPH_UI_LOCK_CSS = `
  .graph-ui-lock,
  .graph-ui-lock * {
    -webkit-tap-highlight-color: transparent;
    -webkit-touch-callout: none;
  }

  .graph-ui-lock,
  .graph-ui-lock svg,
  .graph-ui-lock text,
  .graph-ui-lock tspan,
  .graph-ui-lock .graph-select-none,
  .graph-ui-lock .graph-select-none *,
  .graph-ui-lock .recharts-wrapper,
  .graph-ui-lock .recharts-wrapper *,
  .graph-ui-lock .recharts-surface,
  .graph-ui-lock .recharts-surface *,
  .graph-ui-lock .recharts-cartesian-axis,
  .graph-ui-lock .recharts-cartesian-axis *,
  .graph-ui-lock .recharts-cartesian-grid,
  .graph-ui-lock .recharts-cartesian-grid *,
  .graph-ui-lock .recharts-label,
  .graph-ui-lock .recharts-label *,
  .graph-ui-lock .recharts-tooltip-wrapper {
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
  }

  .graph-ui-lock .recharts-line-curve,
  .graph-ui-lock .recharts-curve.recharts-line-curve,
  .graph-ui-lock .recharts-cartesian-axis,
  .graph-ui-lock .recharts-cartesian-axis *,
  .graph-ui-lock .recharts-cartesian-grid,
  .graph-ui-lock .recharts-cartesian-grid *,
  .graph-ui-lock .recharts-label,
  .graph-ui-lock .recharts-label *,
  .graph-ui-lock .recharts-reference-line,
  .graph-ui-lock .recharts-reference-line * {
    pointer-events: none !important;
  }

  .graph-ui-lock .recharts-tooltip-wrapper {
    pointer-events: none;
  }

  .graph-ui-lock .recharts-active-dot,
  .graph-ui-lock .recharts-dot,
  .graph-ui-lock [data-graph-dot="true"] {
    pointer-events: auto !important;
  }

  .graph-ui-lock *:focus {
    outline: none !important;
  }
`;

const getProgramBlockCount = (program: Program | null | undefined) =>
  program?.routines.reduce((total, routine) => total + routine.blocks.length, 0) || 0;

// ===== HELPERS =====

const uid = () => Math.random().toString(36).slice(2, 9);

const normalizeWeightInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (/^(b|bw|body\s*weight)$/i.test(trimmed)) return "BW";

  const numeric = extractFirstNumber(trimmed);
  return numeric || "";
};

const createExercise = (): Exercise => ({
  id: uid(),
  name: "Exercise",
  target: "",
  metric: "reps",
});

const createBlock = (type: BlockType): Block => ({
  id: uid(),
  type,
  title: type === "paired" ? "Paired Block" : "Single Block",
  duration: type === "paired" ? "10" : "3",
  notes: "",
  exercises: type === "paired" ? [createExercise(), createExercise()] : [createExercise()],
});

const createRoutine = (index: number): Routine => ({
  id: uid(),
  label: `Day ${index + 1}`,
  blocks: [createBlock("paired")],
});

const createSessionDraft = (programId: string, routine: Routine, memberId: string): SessionDraft => ({
  programId,
  routineId: routine.id,
  memberId,
  date: "",
  sessionNumber: "",
  blocks: routine.blocks.map((block) => ({
    blockId: block.id,
    blockTitle: block.title,
    entries: block.exercises.map((exercise) => ({
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      weight: "",
      performance: "",
      setsCompleted: "",
      target: exercise.target,
      metric: exercise.metric,
    })),
  })),
});


const STORAGE_KEYS = {
  members: "workout-app-members-v1",
  programs: "workout-app-programs-v1",
  savedSessions: "workout-app-saved-sessions-v1",
  seeded: "workout-app-seeded-program1-v1",
  seededProgram2: "workout-app-seeded-program2-v1",
  seededProgram3: "workout-app-seeded-program3-v1",
};

const ROUTINE_IDS = {
  day1: "routine-day-1",
  day2: "routine-day-2",
  day3: "routine-day-3",
  day4: "routine-day-4",
};

const BLOCK_IDS = {
  day1A: "block-day1-a",
  day1Single1: "block-day1-single-1",
  day1B: "block-day1-b",
  day1Single2: "block-day1-single-2",
  day1C: "block-day1-c",
  day2A: "block-day2-a",
  day2Single1: "block-day2-single-1",
  day2B: "block-day2-b",
  day2Single2: "block-day2-single-2",
  day2C: "block-day2-c",
  day3A: "block-day3-a",
  day3Single1: "block-day3-single-1",
  day3B: "block-day3-b",
  day3Single2: "block-day3-single-2",
  day3C: "block-day3-c",
  day4A: "block-day4-a",
  day4Single1: "block-day4-single-1",
  day4B: "block-day4-b",
  day4Single2: "block-day4-single-2",
  day4C: "block-day4-c",
};

const EXERCISE_IDS = {
  skydivers: "exercise-skydivers",
  gobletSquat: "exercise-goblet-squat",
  bike: "exercise-bike",
  oneArmRow: "exercise-one-arm-db-row",
  benchShoulderTaps: "exercise-bench-shoulder-taps",
  runWalk: "exercise-run-walk",
  oneLegRdl: "exercise-one-leg-rdl",
  farmersCarry: "exercise-farmers-carry",
  dbRdl: "exercise-db-rdl",
  plankMarch: "exercise-plank-march",
  rower1: "exercise-rower-1",
  reverseLunge: "exercise-goblet-reverse-lunge",
  dbBench: "exercise-db-bench-press",
  rower2: "exercise-rower-2",
  bentOverRow: "exercise-db-bent-over-row",
  bearToPushup: "exercise-bear-to-pushup",
  p2TempoCsOneArmDbRow: "exercise-p2-tempo-cs-one-arm-db-row",
  p2TempoPlateReachSquat: "exercise-p2-tempo-plate-reach-squat",
  p2TempoOneLegRdlIsoHandPass: "exercise-p2-tempo-one-leg-rdl-iso-hand-pass",
  p2TempoDbBicepCurls: "exercise-p2-tempo-db-bicep-curls",
  p2InclineDbBench: "exercise-p2-1-arm-inc-db-bench-press",
  p2TempoCsAltOhReach: "exercise-p2-tempo-cs-alt-oh-reach",
  p2ContraSplitSquat: "exercise-p2-contra-split-squat",
  p2MbSlams: "exercise-p2-mb-slams",
  p2Kbdl: "exercise-p2-kbdl",
  p2PauseFarmerMarch: "exercise-p2-pause-1-arm-farmers-march",
  p2Day3Rower: "exercise-p2-rower-day3",
  p2BallGbEccHc: "exercise-p2-ball-gb-ecc-hc",
  p2DeadbugLegsOnly: "exercise-p2-deadbug-legs-only",
  p2Day3FarmersCarry: "exercise-p2-farmers-carry-day3",
  p2Day4MbSlams: "exercise-p2-mb-slams-day4",
  p2BearMtClimbers: "exercise-p2-bear-mt-climbers",
  p2ContraStepUps: "exercise-p2-contra-step-ups",
  p2OneArmDbRowDay4: "exercise-p2-one-arm-db-row-day4",
  p2OneArmSkullcrusher: "exercise-p2-one-arm-skullcrusher",
};
const PROGRAM_1_IMPORT_TEMPLATE = "Program 1 \nDay 1: July 25, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - BW \nExercise 2: Goblet Squat - 20 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: 4 sets completed of each exercise \n\nSingle block \nExercise: \nBike Time: 3m \nTarget: Calories \nSession Data: 18 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 20 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW\nTarget reps exercise 1: 5 \nTarget reps exercise 2: 5 \nSession Data: 4 sets completed of each \n\nSingle block \nExercise: Run/walk \nTime: 3m \nTarget: Laps \nSession Data: 3 \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 25 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: 3 sets completed of each\n\nProgram 1 \nDay 2: July 28th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 20 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 8 \nSession data: \nExercise 1: 4 sets completed\nExercise 2: 3 sets completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 30  \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - BW \nExercise 2: DB Bench Press - 15 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: 5 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes\nTarget: Calories \nSession Data: 34 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 15 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10\nTarget reps exercise 2: 5 \nSession Data: 3 sets of each completed\n\nProgram 1 \nDay 3: July 30th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 3 lbs \nExercise 2: Goblet Squat - 22 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: 4 sets of each completed \n\nSingle block \nExercise: Bike \nTime: 3 \nTarget: Calories \nSession Data: 26 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 22 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: 4 sets of each completed \n\nSingle block \nExercise: Run/walk \nTime: 3 \nTarget: Laps \nSession Data: 3 \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 30 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: 5 sets of each completed\n\nProgram 1 \nDay 4: July 31st, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 20 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: \nExercise 1: 4 sets complete \nExercise 2: 3 sets complete \n\nSingle block \nExercise: Rower \nTime: 3 \nTarget: Calories \nSession Data: 38 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - BW \nExercise 2: DB Bench Press - 17 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: \nExercise 1: 5 sets completed \nExercise 2: 4 sets completed \n\nSingle block \nExercise: Rower \nTime: 3 \nTarget: Calories \nSession Data: 36  \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 15 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: 5 sets of each completed\n\nProgram 1\nDay 5: August 1st, 2025\n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 3 lbs \nExercise 2: Goblet Squat - 25 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data:\nExercise 1: 5 sets completed\nExercise 2: 4 sets completed \n\nSingle block \nExercise: Bike \nTime: 3 \nTarget: Calories \nSession Data: 28\n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 25 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: \nExercise 1: 6 sets completed \nExercise 2: 5 sets completed \n\nSingle block \nExercise: Run/walk \nTime: 3 \nTarget: Laps \nSession Data: 4 \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 35 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: \nExercise 1: 4 sets completed\nExercise 2: 2 sets completed\n\n\nProgram 1 \nDay 6: August 2nd, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 17 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: \nExercise 1: 7 sets completed \nExercise 2: 6 sets completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 41 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - 15 lbs \nExercise 2: DB Bench Press - 20 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: 4 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 34 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 17 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: \nExercise 1: 6 sets completed \nExercise 2: 5 sets completed\n\nProgram 1 \nDay 7: August 4th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 3 lbs \nExercise 2: Goblet Squat - 25 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: 6 sets of each completed \n\nSingle block \nExercise: Bike \nTime: 3 minutes \nTarget: Calories \nSession Data: 28.9 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 25 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: 6 sets of each completed \n\nSingle block \nExercise: Run/walk \nTime: 3 minutes \nTarget: Laps \nSession Data: 4  \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 35 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: 5 sets of each completed\n\n\nProgram 1 \nDay 8: August 5th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 17 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: \nExercise 1: 7 sets \nExercise 2: 6 sets \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 45 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - 15 lbs \nExercise 2: DB Bench Press - 27 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: 4 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 44 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 17 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: 5 sets of each completed\n\nProgram 1 \nDay 9: August 7th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 5 lbs \nExercise 2: Goblet Squat - 27 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: \nExercise 1: 4 sets completed \nExercise 2: 3 sets completed \n\nSingle block \nExercise: Bike \nTime: 3 minutes \nTarget: Calories \nSession Data: 31 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 27 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: 5 sets of each completed \n\nSingle block \nExercise: Run/walk \nTime: 3 minutes \nTarget: Laps \nSession Data: 4  \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 35 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: 4 sets completed of each\n\n\nProgram 1 \nDay 10: August 8th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 17 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: \nExercise 1: 7 sets completed \nExercise 2: 6 sets completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 50 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - 17 lbs \nExercise 2: DB Bench Press - 30 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: 4 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 45 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 17 lbs \nExercise 2: Bear to Pushup - bw \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: 6 sets of each completed\n\nProgram 1 \nDay 11: August 11th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 5 lbs \nExercise 2: Goblet Squat - 27 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: 5 sets of each completed \n\nSingle block \nExercise: Bike \nTime: 3 minutes \nTarget: Calories \nSession Data: 31 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 27 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: 5 sets of each completed \n\nSingle block \nExercise: Run/walk \nTime: 3 minutes \nTarget: Laps \nSession Data: 4  \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 40 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: \nExercise 1: 4 sets completed \nExercise 2: 3 sets completed\n\n\nProgram 1 \nDay 12: August 12th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 20 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: 6 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 51 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - 20 lbs \nExercise 2: DB Bench Press - 30 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: 4 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 44 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 20 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: 5 sets of each completed\n\nProgram 1 \nDay 13: August 13th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 5 lbs \nExercise 2: Goblet Squat - 30 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: 5 sets of each completed \n\nSingle block \nExercise: Bike \nTime: 3 minutes \nTarget: Calories \nSession Data: 32 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 30 lbs \nExercise 2: PAUSE Bench Shoulder Taps \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: \nExercise 1: 5 sets completed \nExercise 2: 4 sets completed \n\nSingle block \nExercise: Run/walk \nTime: 3 minutes \nTarget: Laps \nSession Data: 4  \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 40 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: 3 sets of each completed\n\nProgram 1\nDay 14: August 14th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 25 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: \nExercise 1: 8 sets completed\nExercise 2: 7 sets completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 51 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - 20 lbs \nExercise 2: DB Bench Press - 30 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: \nExercise 1: 5 sets completed \nExercise 2: 4 sets completed\n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 45 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 20 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: \nExercise 1: 6 sets completed\nExercise 2: 5 sets completed\n\nProgram 1 \nDay 15: August 15th, 2025 \n\nPaired Block A - time 10 minutes \nExercise 1: PAUSE CS Skydivers - 5 lbs \nExercise 2: Goblet Squat - 30 lbs \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 10 \nSession data: 5 sets completed for each \n\nSingle block \nExercise: Bike \nTime: 3 minutes \nTarget: Calories \nSession Data: 34 \n\nPaired Block B - time 10 minutes \nExercise 1: PAUSE 1 Arm DB Row - 30 lbs \nExercise 2: PAUSE Bench Shoulder Taps - BW \nTarget reps exercise: 5 \nTarget reps exercise: 5 \nSession Data: 5 sets completed of each \n\nSingle block \nExercise: Run/walk \nTime: 3 minutes \nTarget: Laps \nSession Data: 4.5  \n\nPaired Block C - time 10 minutes \nExercise 1: TEMPO BW 1 Leg RDL - BW \nExercise 2: Farmer's Carry - 40 lbs \nTarget reps exercise 1: 5 \nTarget reps exercise 2: 50 yards \nSession Data: \nExercise 1: 4 sets completed \nExercise 2: 3 sets completed\n\n\nProgram 1 \nDay 16: August 16th, 2025 \nPaired Block A - time 10 minutes \nExercise 1: DB RDL - 27 lbs \nExercise 2: Plank March - BW \nTarget reps exercise 1: 8 \nTarget reps exercise 2: 4 \nSession data: 6 sets completed of each \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 52 \n\nPaired Block B - time 10 minutes \nExercise 1: Goblet Reverse Lunge - 20 lbs \nExercise 2: DB Bench Press - 35 lbs \nTarget reps exercise: 8 \nTarget reps exercise: 8 \nSession Data: 4 sets of each completed \n\nSingle block \nExercise: Rower \nTime: 3 minutes \nTarget: Calories \nSession Data: 47 \n\nPaired Block C - time 10 minutes \nExercise 1: DB Bent Over Row - 20 lbs \nExercise 2: Bear to Pushup - BW \nTarget reps exercise 1: 10 \nTarget reps exercise 2: 5 \nSession Data: 6 sets of each complete";

const RELAY_TEMPLATE_TEXT = `Program:

Session #:
Date:
Routine: Day 1 / Day 2

Paired Block A
Time (minutes):

Exercise 1:
Weight:
Target:
Sets Complete:

Exercise 2:
Weight:
Target:
Sets Complete:

Single Block
Exercise:
Time:
Target:
Performance:

Paired Block B
Time (minutes):

Exercise 1:
Weight:
Target:
Sets Complete:

Exercise 2:
Weight:
Target:
Sets Complete:

Single Block
Exercise:
Time:
Target:
Performance:

Paired Block C
Time (minutes):

Exercise 1:
Weight:
Target:
Sets Complete:

Exercise 2:
Weight:
Target:
Sets Complete:
`;

const PROGRAM_2_RELAY_TEMPLATE = "Program: 2\n\nSession #: 1\nDate: August 19, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 22\nTarget: 10\nSets Complete: 5\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 10\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 36.8\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 5\nTarget: 5\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 40\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 12\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nProgram: 2\n\nSession #: 5\nDate: August 23, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 22\nTarget: 10\nSets Complete: 3\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 10\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 38.3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 5\nTarget: 5\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 40\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 12\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nProgram: 2\n\nSession #: 9\nDate: August 28, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 22\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 10\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 40\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 5\nTarget: 5\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 3\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 15\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nProgram: 2\n\nSession #: 13\nDate: September 2, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 25\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 20\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 38\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 7.5\nTarget: 5\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 3\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 15\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nProgram: 2\n\nSession #: 17\nDate: September 9, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 25\nTarget: 10 \nSets Complete: 4\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 20\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 38\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 25\nTarget: 5\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 3\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 17\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nProgram: 2\n\nSession #: 21\nDate: September 16, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 27\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 25\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 35\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 10\nTarget: 5\nSets Complete: 3\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 2\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 17\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nProgram: 2\n\nSession #: 25\nDate: September 23, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 30\nTarget: 10\nSets Complete: 3\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 25\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 34\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 10\nTarget: 5\nSets Complete: 3\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 17\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nProgram: 2\n\nSession #: 29\nDate: September 29, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: TEMPO CS 1 Arm DB Row\nWeight: 30\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO Plate Reach Squat\nWeight: 25\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3 \nTarget: 30/30 Calories\nPerformance: 36.8\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: TEMPO 1 Leg RDL Iso Hand Pass\nWeight: 10\nTarget: 5\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 50\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TEMPO DB Bicep Curls\nWeight: 20\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nProgram: 2\n\nSession #: 2\nDate: August 20, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press \nWeight: 25\nTarget: 10\nSets Complete: 5\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 15\nTarget: 8\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 50\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 40\nTarget: 8\nSets Complete: 5\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 40\nTarget: 4\nSets Complete: 5\n\nProgram: 2\n\nSession #: 6\nDate: August 24, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press \nWeight: 27\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 15\nTarget: 8\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 53\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 44\nTarget: 8\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 10\nDate: August 29, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press\nWeight: 30\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.25\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 15\nTarget: 8\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 62 \n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 44\nTarget: 8\nSets Complete: 5\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 14\nDate: September 3, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press\nWeight: 30\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 15\nTarget: 8\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 71\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 44\nTarget: 8\nSets Complete: 5\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 18\nDate: September 10, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press\nWeight: 30\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.25\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 15\nTarget: 8\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 66\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 50\nTarget: 8\nSets Complete: 5\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 22\nDate: September 17, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1:  1 Arm Inc. DB Bench Press\nWeight: 35\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.75\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 17\nTarget: 8\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 68\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 60\nTarget: 8\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 50\nTarget: 4\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 26\nDate: September 24, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press\nWeight: 35\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.75\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 17\nTarget: 8\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 70\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 60\nTarget: 8\nSets Complete: 5\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 50\nTarget: 4\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 30\nDate: September 30, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: 1 Arm Inc. DB Bench Press\nWeight: 35\nTarget: 10\nSets Complete: 4\n\nExercise 2: TEMPO CS Alt. OH Reach\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.9\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Split Squat\nWeight: 17\nTarget: 8\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 72\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 70\nTarget: 8\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 55\nTarget: 4\nSets Complete: 3\n\nProgram: 2\n\nSession #: 3\nDate: August 21, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 27\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Bent Over Row\nWeight: 17\nTarget: 12 down by 1\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 52\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 40\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 7\nDate: August 25, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 27\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Bent Over Row\nWeight: 20\nTarget: 12 down by 1\nSets Complete: 5\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 52\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 5\n\nExercise 2: Plank March\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 40\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 3\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 11\nDate: August 31, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 27\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Bent Over Row\nWeight: 20\nTarget: 12 down by 1\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 49\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nExercise 2: Plank March\nWeight: BW\nTarget: 5\nSets Complete: 3\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 40\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 3\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 15\nDate: September 4, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 27\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Bent Over Row\nWeight: 20\nTarget: 12 down by 1\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 50\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: Plank March\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 40\nTime (minutes): 3\nTarget: 50 yards \nPerformance: 5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 19\nDate: September 13, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 35\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Bent Over Row\nWeight: 20\nTarget: 12 down by 1\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 50\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: Deadbug - legs only\nWeight: BW\nTarget: 6\nSets Complete: 3\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 23\nDate: September 19, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 40\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Bent Over Row\nWeight: 22\nTarget: 12 down by 1\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 48\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nExercise 2: Deadbug - legs only\nWeight: BW\nTarget: 6\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 27\nDate: September 25, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 45\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Bent Over Row\nWeight: 22\nTarget: 12 down by 1\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 48\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: Deadbug - legs only\nWeight: BW\nTarget: 6\nSets Complete: 3\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 45\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 5\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 31\nDate: October 1, 2025\nRoutine: Day 3 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: Goblet Squat\nWeight: 45\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Bent Over Row\nWeight: 25\nTarget: 12 down by 1\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 30/30 Calories\nPerformance: 47\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Ball GB Ecc. HC\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: Deadbug - legs only\nWeight: BW\nTarget: 6\nSets Complete: 4\n\nSingle Block \nExercise: Farmer's Carry\nWeight: 50\nTime (minutes): 3\nTarget: 50 yards\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: PAUSE CS Skydivers\nWeight: 7.5\nTarget: 10\nSets Complete: 5\n\nExercise 2: PAUSE Shoulder Taps\nWeight: BW\nTarget: 5\nSets Complete: 4\n\nProgram: 2\n\nSession #: 4\nDate: August 22, 2025\nRoutine: Day 4 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 25\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 46\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 25\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.25\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 7.5\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 40\nTarget: 4\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 8\nDate: August 27, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 27\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 62\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 27\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 15\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 40\nTarget: 4\nSets Complete: 3\n\n\nProgram: 2\n\nSession #: 12\nDate: September 1, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 30\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 6\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 70\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: 5\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 30\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 15\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 40\nTarget: 4\nSets Complete: 4\n\n\nProgram: 2\n\nSession #: 16\nDate: September 8, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 30\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 6\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 76\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: 10\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 30\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 3\n\n\nProgram: 2\n\nSession #: 20\nDate: September 15, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 30\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 79 \n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: 12\nTarget: 8\nSets Complete: 3\n\nExercise 2: 1 Arm DB Row\nWeight: 30\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 17\nTarget: 10\nSets Complete: 3\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 3\n\n\nProgram: 2\n\nSession #: 24\nDate: September 22, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 35\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 79\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: 12\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 30\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 5\n\n\nProgram: 2\n\nSession #: 28\nDate: September 26, 2025\nRoutine: Day 4 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 35\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 6\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 82\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: 12\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 30\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.75\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 45\nTarget: 4\nSets Complete: 3\n\n\nProgram: 2\n\nSession #: 32\nDate: October 2, 2025\nRoutine: Day 4 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 35\nTarget: 10\nSets Complete: 6\n\nExercise 2: Bear Mt. Climbers\nWeight: BW\nTarget: 5\nSets Complete: 5\n\nSingle Block \nExercise: MB Slams\nTime (minutes): 3\nTarget: Reps\nPerformance: 84\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: Contra. Step Ups\nWeight: 12\nTarget: 8\nSets Complete: 4\n\nExercise 2: 1 Arm DB Row\nWeight: 30\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Walk/run\nTime (minutes): 3\nTarget: Laps\nPerformance: 4.5\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: 1 Arm Skullcrusher\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nExercise 2: PAUSE 1 Arm Farmer's March\nWeight: 50\nTarget: 4\nSets Complete: 3";

const normalizeWeightLabel = (value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (/^(b|bw|body\s*weight)$/i.test(trimmed)) return "BW";

  const numeric = extractFirstNumber(trimmed);
  return numeric || "";
};

const extractFirstNumber = (value: string) => {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? match[0] : "";
};

const splitImportedSections = (chunk: string, heading: "paired" | "single") => {
  const regex =
    heading === "paired"
      ? /(Paired Block [A-Z][\s\S]*?)(?=\n\s*(?:Single block|Paired Block [A-Z])|$)/gi
      : /(Single block[\s\S]*?)(?=\n\s*(?:Paired Block [A-Z]|Single block)|$)/gi;

  return Array.from(chunk.matchAll(regex)).map((match) => match[1].trim());
};

const parseExerciseLine = (line: string) => {
  const match = line.match(/^Exercise\s*(\d+)?:\s*(.*)$/i);
  if (!match) return { name: "", weight: "" };

  const rawValue = match[2].trim();
  const dividerIndex = rawValue.lastIndexOf(" - ");

  if (dividerIndex === -1) {
    return {
      name: rawValue,
      weight: "",
    };
  }

  return {
    name: rawValue.slice(0, dividerIndex).trim(),
    weight: normalizeWeightLabel(rawValue.slice(dividerIndex + 3)),
  };
};

const parsePairSessionData = (value: string) => {
  const exercise1 = value.match(/Exercise\s*1:\s*(\d+(?:\.\d+)?)/i);
  const exercise2 = value.match(/Exercise\s*2:\s*(\d+(?:\.\d+)?)/i);

  if (exercise1 || exercise2) {
    return {
      exercise1: exercise1?.[1] || "",
      exercise2: exercise2?.[1] || "",
    };
  }

  const shared = extractFirstNumber(value);
  if (!shared) {
    return { exercise1: "", exercise2: "" };
  }

  if (/each|for each|of each/i.test(value)) {
    return {
      exercise1: shared,
      exercise2: shared,
    };
  }

  return {
    exercise1: shared,
    exercise2: shared,
  };
};

const parseSingleBlocks = (chunk: string) => {
  return splitImportedSections(chunk, "single").map((section) => {
    const lines = section
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    let exerciseName = "";
    let time = "";
    let target = "";
    let performance = "";

    lines.forEach((line, index) => {
      const exerciseMatch = line.match(/^Exercise:\s*(.*)$/i);
      const timeMatch = line.match(/^Time:\s*(.*)$/i);
      const targetMatch = line.match(/^Target:\s*(.*)$/i);
      const sessionMatch = line.match(/^Session Data:\s*(.*)$/i);
      const combinedExerciseTimeMatch = line.match(/^(.*?)\s+Time:\s*(.*)$/i);

      if (exerciseMatch) {
        exerciseName = exerciseMatch[1].trim();
        return;
      }

      if (!exerciseName && combinedExerciseTimeMatch && !/^Single block$/i.test(line)) {
        exerciseName = combinedExerciseTimeMatch[1].trim();
        time = extractFirstNumber(combinedExerciseTimeMatch[2].trim()) || combinedExerciseTimeMatch[2].trim();
        return;
      }

      if (timeMatch) {
        time = extractFirstNumber(timeMatch[1].trim()) || timeMatch[1].trim();
        return;
      }

      if (targetMatch) {
        target = targetMatch[1].trim();
        return;
      }

      if (sessionMatch) {
        performance = extractFirstNumber(sessionMatch[1].trim());
        return;
      }

      if (!exerciseName && lines[index - 1]?.match(/^Exercise:\s*$/i)) {
        const inferred = line.match(/^(.*?)\s+Time:\s*(.*)$/i);
        if (inferred) {
          exerciseName = inferred[1].trim();
          time = extractFirstNumber(inferred[2].trim()) || inferred[2].trim();
        } else {
          exerciseName = line.trim();
        }
      }
    });

    return {
      exerciseName,
      time,
      target,
      performance,
    };
  });
};

const parsePairedBlocks = (chunk: string) => {
  return splitImportedSections(chunk, "paired").map((section) => {
    const lines = section
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);

    const header = lines[0] || "";
    const blockKey = header.match(/Paired Block\s+([A-Z])/i)?.[1]?.trim() || "";
    const time = extractFirstNumber(header) || "";

    const exerciseLines = lines.filter((line) => /^Exercise\s*[12]:/i.test(line));
    const targets = lines
      .filter((line) => /^Target/i.test(line))
      .map((line) => line.split(":").slice(1).join(":").trim());

    const sessionDataIndex = lines.findIndex((line) => /^Session Data:/i.test(line));
    const sessionDataLines =
      sessionDataIndex >= 0
        ? [
            lines[sessionDataIndex].replace(/^Session Data:\s*/i, "").trim(),
            ...lines.slice(sessionDataIndex + 1),
          ].filter(Boolean)
        : [];

    const exercise1 = parseExerciseLine(exerciseLines[0] || "");
    const exercise2 = parseExerciseLine(exerciseLines[1] || "");

    return {
      blockKey,
      time,
      exercise1Name: exercise1.name,
      exercise1Weight: exercise1.weight,
      exercise2Name: exercise2.name,
      exercise2Weight: exercise2.weight,
      target1: targets[0] || "",
      target2: targets[1] || targets[0] || "",
      sessionData: parsePairSessionData(sessionDataLines.join(" ")),
    };
  });
};
const PROGRAM_3_RELAY_TEMPLATE = "Program: 3\n\nSession #: 1\nDate: October 7, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 25\nTarget: 10\nSets Complete: 3\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 30.3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 3\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 2.55\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 70\nTarget: 5 up by 1\nSets Complete: 8\n\nExercise 2: Goblet Squat\nWeight: 45\nTarget: 5 up by 1\nSets Complete: 8\n\n\nSession #: 5\nDate: October 18, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 25\nTarget: 10\nSets Complete: 3\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 2\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 22.2\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 4\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 3.01\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 80\nTarget: 5 up by 1\nSets Complete: 8\n\nExercise 2: Goblet Squat\nWeight: 45\nTarget: 5 up by 1\nSets Complete: 7\n\n\nSession #: 9\nDate: October 29, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 25\nTarget: 10\nSets Complete: 4\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 20.8\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 4\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 3.13\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 80\nTarget: 5 up by 1\nSets Complete: 9\n\nExercise 2: Goblet Squat\nWeight: 50\nTarget: 5 up by 1\nSets Complete: 8\n\n\nSession #: 13\nDate: November 5, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 25\nTarget: 10\nSets Complete: 4\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 25.6\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 3\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 3.00\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 80\nTarget: 5 up by 1\nSets Complete: 9\n\nExercise 2: Goblet Squat\nWeight: 50\nTarget: 5 up by 1\nSets Complete: 9\n\n\nSession #: 17\nDate: November 14, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 25\nTarget: 10\nSets Complete: 4\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 30.3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 4\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 2.50\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 80\nTarget: 5 up by 1\nSets Complete: 9\n\nExercise 2: Goblet Squat\nWeight: 55\nTarget: 5 up by 1\nSets Complete: 9\n\n\nSession #: 21\nDate: November 30, 2025\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 25\nTarget: 10\nSets Complete: 3\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 34.7\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 3\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 2\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 2.48\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 80\nTarget: 5 up by 1\nSets Complete: 9\n\nExercise 2: Goblet Squat\nWeight: 55\nTarget: 5 up by 1\nSets Complete: 9\n\n\nSession #: 25\nDate: January 14, 2026\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 27\nTarget: 10\nSets Complete: 4\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 24.5\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 3\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 3.29\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 80\nTarget: 5 up by 1\nSets Complete: 9\n\nExercise 2: Goblet Squat\nWeight: 50\nTarget: 5 up by 1\nSets Complete: 8\n\n\nSession #: 29\nDate: February 1, 2026\nRoutine: Day 1\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE CS DB Row\nWeight: 27\nTarget: 10\nSets Complete: 4\n\nExercise 2: SL Alt. TGU\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Bike\nTime (minutes): 3\nTarget: Calories\nPerformance: 27.6\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: ECC. DB Bench Press\nWeight: 35\nTarget: 8\nSets Complete: 3\n\nExercise 2: ECC. SL Situps\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Rower\nTime (minutes): 3\nTarget: 50 Calories\nPerformance: 3.00\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: KBDL\nWeight: 88\nTarget: 5 up by 1\nSets Complete: 9\n\nExercise 2: Goblet Squat\nWeight: 55\nTarget: 5 up by 1\nSets Complete: 9\n\nProgram: 3\n\nSession #: 2\nDate: October 8, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 20\nTarget: 5\nSets Complete: 4\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 20\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .05\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 20\nTarget: 20\nSets Complete: 4\n\nExercise 2: 1 Arm Farmer's March\nWeight: 50\nTarget: 10\nSets Complete:3\n\n\nSession #: 6\nDate: October 22, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 20\nTarget: 5\nSets Complete: 4\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 22\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .07\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 20\nTarget: 20\nSets Complete: 3\n\nExercise 2: 1 Arm Farmer's March\nWeight: 50 \nTarget: 10\nSets Complete: 3\n\n\nSession #: 10\nDate: October 30, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 20\nTarget: 5\nSets Complete: 4\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 22\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .09\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 2\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 20\nTarget: 20\nSets Complete: 4\n\nExercise 2: 1 Arm Farmer's March\nWeight: 50\nTarget: 10\nSets Complete: 3\n\n\nSession #: 14\nDate: November 7, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 22\nTarget: 5\nSets Complete: 4\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 22\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .09\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 20\nTarget: 20\nSets Complete: 3\n\nExercise 2: 1 Arm Farmer's March\nWeight: 50 \nTarget: 10\nSets Complete: 3\n\n\nSession #: 18\nDate: November 19, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 22\nTarget: 5\nSets Complete: 4\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 22\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .09\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 20\nTarget: 20\nSets Complete: 4\n\nExercise 2: 1 Arm Farmer's March\nWeight: 50\nTarget: 10\nSets Complete: 3\n\n\nSession #: 22\nDate: December 3, 2025\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 22\nTarget: 5\nSets Complete: 4\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 22\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .11\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 22\nTarget: 20\nSets Complete: 3\n\nExercise 2: 1 Arm Farmer's March\nWeight: 55\nTarget: 10\nSets Complete: 3\n\n\nSession #: 26\nDate: January 18, 2026\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 25\nTarget: 5\nSets Complete: 3\n\nExercise 2: Alt. DB Bicep Curls\nWeight: 30\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .09\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 3\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 22\nTarget: 20\nSets Complete: 4\n\nExercise 2: 1 Arm Farmer's March\nWeight: 55\nTarget: 10\nSets Complete: 3\n\n\nSession #: 30\nDate: February 4, 2026\nRoutine: Day 2 \n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: PAUSE FFE Contra. Split Squat\nWeight: 25\nTarget: 5\nSets Complete:3 \n\nExercise 2: Alt. DB Bicep Curls\nWeight: 30\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R8 Distance\nPerformance: .10\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: PAUSE FOB Glute Bridge\nWeight: BW\nTarget: 15\nSets Complete: 4\n\nExercise 2: Bear to Pushup\nWeight: BW\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slam \nTime (minutes): 3\nTarget: 30/30\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Tricep Pushdown\nWeight: 25\nTarget: 20\nSets Complete: 4\n\nExercise 2: 1 Arm Farmer's March\nWeight: 55\nTarget: 10\nSets Complete: 3\n\nProgram: 3\n\nSession #: 3\nDate: October 9, 2025\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 40\nTarget: 8\nSets Complete: 4\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 35\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 25\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 2\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .23\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 40\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Pullover\nWeight: 12\nTarget: 12 down by 1 \nSets Complete: 4\n\n\nSession #: 7\nDate: October 24, 2025\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 40\nTarget: 8\nSets Complete: 4\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 3\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 38\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 25\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 2\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .24\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 40 \nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Pullover\nWeight: 12\nTarget: 12 down by 1 \nSets Complete: 4\n\n\nSession #: 11\nDate: October 31, 2025\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 40\nTarget: 8\nSets Complete: 3\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 2\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 39\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 25\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 2\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .25\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 50\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Pullover\nWeight: 12\nTarget: 12 down by 1 \nSets Complete: 4\n\n\nSession #: 15\nDate: November 10, 2025\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 40\nTarget: 8\nSets Complete: 5\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 4\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 39\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 25\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .24\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 50\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Pullover\nWeight: 12\nTarget: 12 down by 1 \nSets Complete: 4\n\n\nSession #: 19\nDate: November 23, 2025\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 45\nTarget: 8\nSets Complete: 5\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 5\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 38\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 27\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .23\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 60\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Pullover\nWeight: 15\nTarget: 12 down by 1 \nSets Complete: 4\n\n\nSession #: 23\nDate: December 7, 2025\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 45\nTarget: 8\nSets Complete: 5\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 5\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 39\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 27\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .26\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 60\nTarget: 12 down by 1\nSets Complete: 6\n\nExercise 2: DB Pullover\nWeight: 15\nTarget: 12 down by 1 \nSets Complete: 5\n\n\nSession #: 27\nDate: January 23, 2026\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 45\nTarget: 8\nSets Complete: 5\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 5\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 32\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 27\nTarget: 6\nSets Complete: 3\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .25\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 70\nTarget: 12 down by 1\nSets Complete: 4\n\nExercise 2: DB Pullover\nWeight: 15\nTarget: 12 down by 1 \nSets Complete: 3\n\n\nSession #: 31\nDate: February 8, 2026\nRoutine: Day 3\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: DB RDL\nWeight: 45\nTarget: 8\nSets Complete: 5\n\nExercise 2: HE Pushups- ECC, Only\nWeight: BW\nTarget: 8\nSets Complete: 5\n\nSingle Block \nExercise: Skiier\nTime (minutes): 3\nTarget: Calories\nPerformance: 40\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: 1 Arm DB Rack Squat\nWeight: 30\nTarget: 6\nSets Complete: 4\n\nExercise 2: MB Deadbug - Legs Only\nWeight: 10\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: Skillmill\nTime (minutes): 3\nTarget: R3 Distance\nPerformance: .25\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: Bar Bent Over Row\nWeight: 70\nTarget: 12 down by 1\nSets Complete: 5\n\nExercise 2: DB Pullover\nWeight: 17\nTarget: 12 down by 1 \nSets Complete: 5\n\nProgram: 3\n\nSession #: 4\nDate: October 11, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 50\nTarget: 5\nSets Complete: 5\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 2\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 15\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 15\nTarget: 10\nSets Complete: 5\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 7.5\nTarget: 6\nSets Complete: 3\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 25\nTarget: 6\nSets Complete: 3\n\n\nSession #: 8\nDate: October 25, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 50\nTarget: 5\nSets Complete: 5\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 15\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 15\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 7.5\nTarget: 6\nSets Complete: 3\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 25\nTarget: 6\nSets Complete: 4\n\n\nSession #: 12\nDate: November 3, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 50\nTarget: 5\nSets Complete: 5\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 17\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 7.5\nTarget: 6\nSets Complete: 4\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 25\nTarget: 6\nSets Complete:4\n\n\nSession #: 16\nDate: November 12, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 50\nTarget: 5\nSets Complete: 4\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 2.5\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 20\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 10\nTarget: 6\nSets Complete: 4\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 25\nTarget: 6\nSets Complete: 4\n\n\nSession #: 20\nDate: November 26, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 50\nTarget: 5\nSets Complete: 5\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 25\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 10\nTarget: 6\nSets Complete: 4\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 27\nTarget: 6\nSets Complete: 4\n\n\nSession #: 24\nDate: December 10, 2025\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 50\nTarget: 5\nSets Complete: 5\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 5\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 2.5\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 25\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 17\nTarget: 10\nSets Complete: 5\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 10\nTarget: 6\nSets Complete: 5\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 30\nTarget: 6\nSets Complete: 5\n\n\nSession #: 28\nDate: January 28, 2026\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 55\nTarget: 5\nSets Complete: 5\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 25\nTarget: 5\nSets Complete: 4\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 10\nTarget: 6\nSets Complete: 4\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 30\nTarget: 6\nSets Complete: 4\n\n\nSession #: 32\nDate: February 11, 2026\nRoutine: Day 4\n\nPaired Block A \nTime (minutes): 10\n\nExercise 1: ECC. Sumo Squat\nWeight: 55\nTarget: 5\nSets Complete: 4\n\nExercise 2: PAUSE Seated Bent Over Rev. Fly\nWeight: 5\nTarget: 10\nSets Complete: 3\n\nSingle Block \nExercise: MB Slams/Wideout Squats\nTime (minutes): 3\nTarget: 15/5\nPerformance: 3\n\nPaired Block B \nTime (minutes): 10\n\nExercise 1: DB 1 Leg RDL\nWeight: 25\nTarget: 5\nSets Complete: 5\n\nExercise 2: \u00bd Kn. Seesaw OHP\nWeight: 17\nTarget: 10\nSets Complete: 4\n\nSingle Block \nExercise: MB Alt Rot Slam\nTime (minutes): 3\nTarget: 40/20\nPerformance: NA\n\nPaired Block C \nTime (minutes): 10\n\nExercise 1: TGU - elbow\nWeight: 10\nTarget: 6\nSets Complete: 6\n\nExercise 2: PAUSE Goblet Rotational March\nWeight: 30\nTarget: 6\nSets Complete: 5";

const createProgramOne = (): Program => ({
  id: "program-1",
  name: "Program 1",
  startedAt: "2025-07-25",
  status: "active",
  routines: [
    {
      id: ROUTINE_IDS.day1,
      label: "Day 1",
      blocks: [
        {
          id: BLOCK_IDS.day1A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.skydivers, name: "PAUSE CS Skydivers", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.gobletSquat, name: "Goblet Squat", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day1Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.bike, name: "Bike", target: "Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day1B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.oneArmRow, name: "PAUSE 1 Arm DB Row", target: "5", metric: "reps" },
            { id: EXERCISE_IDS.benchShoulderTaps, name: "PAUSE Bench Shoulder Taps", target: "5", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day1Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.runWalk, name: "Run/walk", target: "Laps", metric: "laps" }],
        },
        {
          id: BLOCK_IDS.day1C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.oneLegRdl, name: "TEMPO BW 1 Leg RDL", target: "5", metric: "reps" },
            { id: EXERCISE_IDS.farmersCarry, name: "Farmer's Carry", target: "50", metric: "yards" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day2,
      label: "Day 2",
      blocks: [
        {
          id: BLOCK_IDS.day2A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.dbRdl, name: "DB RDL", target: "8", metric: "reps" },
            { id: EXERCISE_IDS.plankMarch, name: "Plank March", target: "4", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day2Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.rower1, name: "Rower", target: "Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day2B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.reverseLunge, name: "Goblet Reverse Lunge", target: "8", metric: "reps" },
            { id: EXERCISE_IDS.dbBench, name: "DB Bench Press", target: "8", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day2Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.rower2, name: "Rower", target: "Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day2C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.bentOverRow, name: "DB Bent Over Row", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.bearToPushup, name: "Bear to Pushup", target: "5", metric: "reps" },
          ],
        },
      ],
    },
  ],
});


const createProgramTwo = (): Program => ({
  id: "program-2",
  name: "Program 2",
  startedAt: "2025-08-19",
  status: "active",
  routines: [
    {
      id: ROUTINE_IDS.day1,
      label: "Day 1",
      blocks: [
        {
          id: BLOCK_IDS.day1A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2TempoCsOneArmDbRow, name: "TEMPO CS 1 Arm DB Row", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.p2TempoPlateReachSquat, name: "TEMPO Plate Reach Squat", target: "5", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day1Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.bike, name: "Bike", target: "30/30 Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day1B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2TempoOneLegRdlIsoHandPass, name: "TEMPO 1 Leg RDL Iso Hand Pass", target: "5", metric: "reps" },
            { id: EXERCISE_IDS.plankMarch, name: "Plank March", target: "8", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day1Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.farmersCarry, name: "Farmer's Carry", target: "50 yards", metric: "yards" }],
        },
        {
          id: BLOCK_IDS.day1C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2TempoDbBicepCurls, name: "TEMPO DB Bicep Curls", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.benchShoulderTaps, name: "PAUSE Shoulder Taps", target: "5", metric: "reps" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day2,
      label: "Day 2",
      blocks: [
        {
          id: BLOCK_IDS.day2A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2InclineDbBench, name: "1 Arm Inc. DB Bench Press", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.p2TempoCsAltOhReach, name: "TEMPO CS Alt. OH Reach", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day2Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.runWalk, name: "Walk/run", target: "Laps", metric: "laps" }],
        },
        {
          id: BLOCK_IDS.day2B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2ContraSplitSquat, name: "Contra. Split Squat", target: "8", metric: "reps" },
            { id: EXERCISE_IDS.bearToPushup, name: "Bear to Pushup", target: "5", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day2Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.p2MbSlams, name: "MB Slams", target: "Reps", metric: "reps" }],
        },
        {
          id: BLOCK_IDS.day2C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2Kbdl, name: "KBDL", target: "8", metric: "reps" },
            { id: EXERCISE_IDS.p2PauseFarmerMarch, name: "PAUSE 1 Arm Farmer's March", target: "4", metric: "reps" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day3,
      label: "Day 3",
      blocks: [
        {
          id: BLOCK_IDS.day3A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.gobletSquat, name: "Goblet Squat", target: "12 down by 1", metric: "reps" },
            { id: EXERCISE_IDS.bentOverRow, name: "DB Bent Over Row", target: "12 down by 1", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day3Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.p2Day3Rower, name: "Rower", target: "30/30 Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day3B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2BallGbEccHc, name: "Ball GB Ecc. HC", target: "8", metric: "reps" },
            { id: EXERCISE_IDS.plankMarch, name: "Plank March", target: "5", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day3Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.p2Day3FarmersCarry, name: "Farmer's Carry", target: "50 yards", metric: "yards" }],
        },
        {
          id: BLOCK_IDS.day3C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.skydivers, name: "PAUSE CS Skydivers", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.benchShoulderTaps, name: "PAUSE Shoulder Taps", target: "5", metric: "reps" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day4,
      label: "Day 4",
      blocks: [
        {
          id: BLOCK_IDS.day4A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.dbRdl, name: "DB RDL", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.p2BearMtClimbers, name: "Bear Mt. Climbers", target: "5", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day4Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.p2Day4MbSlams, name: "MB Slams", target: "Reps", metric: "reps" }],
        },
        {
          id: BLOCK_IDS.day4B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2ContraStepUps, name: "Contra. Step Ups", target: "8", metric: "reps" },
            { id: EXERCISE_IDS.p2OneArmDbRowDay4, name: "1 Arm DB Row", target: "8", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day4Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: EXERCISE_IDS.runWalk, name: "Walk/run", target: "Laps", metric: "laps" }],
        },
        {
          id: BLOCK_IDS.day4C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: EXERCISE_IDS.p2OneArmSkullcrusher, name: "1 Arm Skullcrusher", target: "10", metric: "reps" },
            { id: EXERCISE_IDS.p2PauseFarmerMarch, name: "PAUSE 1 Arm Farmer's March", target: "4", metric: "reps" },
          ],
        },
      ],
    },
  ],
});

const createProgramThree = (): Program => ({
  id: "program-3",
  name: "Program 3",
  startedAt: "2025-10-07",
  status: "active",
  routines: [
    {
      id: ROUTINE_IDS.day1,
      label: "Day 1",
      blocks: [
        {
          id: BLOCK_IDS.day1A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-pause-cs-db-row", name: "PAUSE CS DB Row", target: "10", metric: "reps" },
            { id: "exercise-p3-sl-alt-tgu", name: "SL Alt. TGU", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day1Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-bike", name: "Bike", target: "Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day1B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-ecc-db-bench-press", name: "ECC. DB Bench Press", target: "8", metric: "reps" },
            { id: "exercise-p3-ecc-sl-situps", name: "ECC. SL Situps", target: "8", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day1Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-rower-50-calories", name: "Rower", target: "50 Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day1C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-kbdl", name: "KBDL", target: "5 up by 1", metric: "reps" },
            { id: "exercise-p3-goblet-squat", name: "Goblet Squat", target: "5 up by 1", metric: "reps" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day2,
      label: "Day 2",
      blocks: [
        {
          id: BLOCK_IDS.day2A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-pause-ffe-contra-split-squat", name: "PAUSE FFE Contra. Split Squat", target: "5", metric: "reps" },
            { id: "exercise-p3-alt-db-bicep-curls", name: "Alt. DB Bicep Curls", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day2Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-skillmill-r8", name: "Skillmill", target: "R8 Distance", metric: "distance" }],
        },
        {
          id: BLOCK_IDS.day2B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-pause-fob-glute-bridge", name: "PAUSE FOB Glute Bridge", target: "15", metric: "reps" },
            { id: "exercise-p3-bear-to-pushup", name: "Bear to Pushup", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day2Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-mb-slam", name: "MB Slam", target: "30/30", metric: "reps" }],
        },
        {
          id: BLOCK_IDS.day2C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-tricep-pushdown", name: "Tricep Pushdown", target: "20", metric: "reps" },
            { id: "exercise-p3-one-arm-farmers-march", name: "1 Arm Farmer's March", target: "10", metric: "reps" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day3,
      label: "Day 3",
      blocks: [
        {
          id: BLOCK_IDS.day3A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-db-rdl", name: "DB RDL", target: "8", metric: "reps" },
            { id: "exercise-p3-he-pushups-ecc-only", name: "HE Pushups- ECC, Only", target: "8", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day3Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-skiier", name: "Skiier", target: "Calories", metric: "calories" }],
        },
        {
          id: BLOCK_IDS.day3B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-one-arm-db-rack-squat", name: "1 Arm DB Rack Squat", target: "6", metric: "reps" },
            { id: "exercise-p3-mb-deadbug-legs-only", name: "MB Deadbug - Legs Only", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day3Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-skillmill-r3", name: "Skillmill", target: "R3 Distance", metric: "distance" }],
        },
        {
          id: BLOCK_IDS.day3C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-bar-bent-over-row", name: "Bar Bent Over Row", target: "12 down by 1", metric: "reps" },
            { id: "exercise-p3-db-pullover", name: "DB Pullover", target: "12 down by 1", metric: "reps" },
          ],
        },
      ],
    },
    {
      id: ROUTINE_IDS.day4,
      label: "Day 4",
      blocks: [
        {
          id: BLOCK_IDS.day4A,
          type: "paired",
          title: "Paired Block A",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-ecc-sumo-squat", name: "ECC. Sumo Squat", target: "5", metric: "reps" },
            { id: "exercise-p3-pause-seated-bent-over-rev-fly", name: "PAUSE Seated Bent Over Rev. Fly", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day4Single1,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-mb-slams-wideout-squats", name: "MB Slams/Wideout Squats", target: "15/5", metric: "rounds" }],
        },
        {
          id: BLOCK_IDS.day4B,
          type: "paired",
          title: "Paired Block B",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-db-one-leg-rdl", name: "DB 1 Leg RDL", target: "5", metric: "reps" },
            { id: "exercise-p3-half-kn-seesaw-ohp", name: "½ Kn. Seesaw OHP", target: "10", metric: "reps" },
          ],
        },
        {
          id: BLOCK_IDS.day4Single2,
          type: "single",
          title: "Single Block",
          duration: "3",
          notes: "",
          exercises: [{ id: "exercise-p3-mb-alt-rot-slam", name: "MB Alt Rot Slam", target: "40/20", metric: "reps" }],
        },
        {
          id: BLOCK_IDS.day4C,
          type: "paired",
          title: "Paired Block C",
          duration: "10",
          notes: "",
          exercises: [
            { id: "exercise-p3-tgu-elbow", name: "TGU - elbow", target: "6", metric: "reps" },
            { id: "exercise-p3-pause-goblet-rotational-march", name: "PAUSE Goblet Rotational March", target: "6", metric: "reps" },
          ],
        },
      ],
    },
  ],
});

function buildInitialPrograms(): Program[] {
  return [createProgramOne(), createProgramTwo(), createProgramThree()];
}

const mergeProgramsWithBase = (storedPrograms: Program[]) => {
  const basePrograms = buildInitialPrograms();
  const storedMap = new Map(storedPrograms.map((program) => [program.id, program]));

  return [
    ...basePrograms.map((program) => storedMap.get(program.id) || program),
    ...storedPrograms.filter((program) => !basePrograms.some((baseProgram) => baseProgram.id === program.id)),
  ];
};

const getRoutineIdForSessionNumber = (program: Program, sessionNumber: number) => {
  const routineCount = program.routines.length;

  if (routineCount <= 2) {
    return sessionNumber % 2 === 1 ? ROUTINE_IDS.day1 : ROUTINE_IDS.day2;
  }

  const index = ((sessionNumber - 1) % routineCount) + 1;
  return ROUTINE_IDS[`day${index}` as keyof typeof ROUTINE_IDS];
};

const getRoutineTemplateById = (program: Program, routineId: string) =>
  program.routines.find((routine) => routine.id === routineId) || program.routines[0];

const getRoutineTemplateByLabel = (program: Program, routineLabel: string) =>
  program.routines.find((routine) => routine.label.toLowerCase() === routineLabel.trim().toLowerCase()) || program.routines[0];
const normalizeImportedDate = (value: string) =>
  value
    .trim()
    .replace(/(\d+)(st|nd|rd|th)/gi, "$1")
    .replace(/\s+/g, " ");

const getSafeDateIsoString = (value: string) => {
  const normalized = normalizeImportedDate(value);
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? new Date(time).toISOString() : new Date().toISOString();
};

const getSafeDateTime = (value: string) => {
  const normalized = normalizeImportedDate(value);
  const time = new Date(normalized).getTime();
  return Number.isFinite(time) ? time : 0;
};

const buildImportedSession = (program: Program, memberId: string, sessionNumber: number, date: string, chunk: string): SavedSession | null => {
  const routineId = getRoutineIdForSessionNumber(program, sessionNumber);
  const routine = getRoutineTemplateById(program, routineId);
  const pairedBlocks = parsePairedBlocks(chunk);
  const singleBlocks = parseSingleBlocks(chunk);

  if (!routine) return null;

  let singleIndex = 0;

  const blocks: SessionBlockInput[] = routine.blocks.map((block) => {
    if (block.type === "paired") {
      const pairData = pairedBlocks.find((item) => `Paired Block ${item.blockKey}` === block.title);
      return {
        blockId: block.id,
        blockTitle: block.title,
        entries: block.exercises.map((exercise, exerciseIndex) => ({
          exerciseId: exercise.id,
          exerciseName: exercise.name,
          weight: pairData ? (exerciseIndex === 0 ? pairData.exercise1Weight : pairData.exercise2Weight) : "",
          performance: "",
          setsCompleted: pairData ? (exerciseIndex === 0 ? pairData.sessionData.exercise1 : pairData.sessionData.exercise2) : "",
        })),
      };
    }

    const singleData = singleBlocks[singleIndex++];
    return {
      blockId: block.id,
      blockTitle: block.title,
      entries: block.exercises.map((exercise) => ({
        exerciseId: exercise.id,
        exerciseName: exercise.name,
        weight: "",
        performance: singleData?.performance || "",
        setsCompleted: "",
      })),
    };
  });

  return {
    id: uid(),
    programId: program.id,
    routineId,
    memberId,
    date: normalizeImportedDate(date),
    sessionNumber: String(sessionNumber),
    blocks,
    createdAt: getSafeDateIsoString(date),
  };
};

const parseImportedSessions = (raw: string, program: Program, memberId: string) => {
  const sessionRegex = /Program\s+\d+\s*\nDay\s+(\d+):\s*([^\n]+)\s*\n([\s\S]*?)(?=(?:\nProgram\s+\d+\s*\nDay\s+\d+:)|$)/g;
  const sessions: SavedSession[] = [];

  for (const match of raw.matchAll(sessionRegex)) {
    const sessionNumber = Number(match[1]);
    const date = match[2].trim();
    const chunk = match[3].trim();
    const session = buildImportedSession(program, memberId, sessionNumber, date, chunk);
    if (session) sessions.push(session);
  }

  return sessions;
};



const normalizeExerciseKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const buildImportedExerciseId = (blockId: string, exerciseName: string, fallbackIndex: number) => {
  const normalizedName = normalizeExerciseKey(exerciseName);
  return `${blockId}-${normalizedName || `exercise-${fallbackIndex + 1}`}`;
};

const inferMetricFromTarget = (target: string, fallback = "reps") => {
  const normalized = String(target || "").trim().toLowerCase();

  if (!normalized) return fallback;
  if (normalized.includes("yard")) return "yards";
  if (normalized.includes("lap")) return "laps";
  if (normalized.includes("cal")) return "calories";
  if (normalized.includes("rep")) return "reps";
  return fallback;
};


type RelayParsedExercise = {
  name: string;
  weight: string;
  target: string;
  value: string;
};

type RelayParsedBlock = {
  type: BlockType;
  label?: string;
  exercises: RelayParsedExercise[];
};

const getRelayLineValue = (input: string, label: string) => {
  const lines = String(input || "").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(label)) {
      return trimmed.slice(label.length).trim();
    }
  }
  return "";
};

const parseRelaySessionChunk = (chunk: string): RelayParsedBlock[] => {
  const blockMatches =
    chunk.match(/(Paired Block [A-Z]|Single Block)[\s\S]*?(?=(Paired Block [A-Z]|Single Block|$))/g) || [];

  return blockMatches.map((block) => {
    if (block.includes("Paired Block")) {
      const label = block.match(/Paired Block\s+([A-Z])/i)?.[1]?.trim() || "";
      const ex1Section = block.match(/Exercise 1:[\s\S]*?(?=Exercise 2:|$)/)?.[0] || "";
      const ex2Section = block.match(/Exercise 2:[\s\S]*?$/)?.[0] || "";

      return {
        type: "paired" as const,
        label,
        exercises: [
          {
            name: getRelayLineValue(ex1Section, "Exercise 1:"),
            weight: normalizeWeightInput(getRelayLineValue(ex1Section, "Weight:")),
            target: getRelayLineValue(ex1Section, "Target:"),
            value: extractFirstNumber(getRelayLineValue(ex1Section, "Sets Complete:")),
          },
          {
            name: getRelayLineValue(ex2Section, "Exercise 2:"),
            weight: normalizeWeightInput(getRelayLineValue(ex2Section, "Weight:")),
            target: getRelayLineValue(ex2Section, "Target:"),
            value: extractFirstNumber(getRelayLineValue(ex2Section, "Sets Complete:")),
          },
        ],
      };
    }

    return {
      type: "single" as const,
      exercises: [
        {
          name: getRelayLineValue(block, "Exercise:"),
          weight: normalizeWeightInput(getRelayLineValue(block, "Weight:")),
          target: getRelayLineValue(block, "Target:"),
          value: extractFirstNumber(getRelayLineValue(block, "Performance:")),
        },
      ],
    };
  });
};

const parseRelayImportedSessions = (raw: string, program: Program, memberId: string) => {
  const sections = String(raw || "")
    .replace(/^\s*Program:\s*\d+\s*$/gim, "")
    .split(/(?=^\s*Session #:\s*\d+)/gm)
    .map((section) => section.trim())
    .filter((section) => section && /Session #:/i.test(section));

  const sessions: SavedSession[] = [];

  sections.forEach((section) => {
    const sessionNumber = Number(getRelayLineValue(section, "Session #:"));
    const date = getRelayLineValue(section, "Date:");
    const routineLabel = getRelayLineValue(section, "Routine:");
    const routine = getRoutineTemplateByLabel(program, routineLabel);

    if (!Number.isFinite(sessionNumber) || !date || !routine) return;

    const parsedBlocks = parseRelaySessionChunk(section);

    const blocks: SessionBlockInput[] = routine.blocks.map((templateBlock, blockIndex) => {
      const importedBlock = parsedBlocks[blockIndex];

      if (!importedBlock || importedBlock.type !== templateBlock.type) {
        return {
          blockId: templateBlock.id,
          blockTitle: templateBlock.title,
          entries: templateBlock.exercises.map((exercise) => ({
            exerciseId: exercise.id,
            exerciseName: exercise.name,
            weight: "",
            performance: "",
            setsCompleted: "",
            target: exercise.target,
            metric: exercise.metric,
          })),
        };
      }

      return {
        blockId: templateBlock.id,
        blockTitle: templateBlock.title,
        entries: templateBlock.exercises.map((exercise, exerciseIndex) => {
          const importedEntry = importedBlock.exercises[exerciseIndex];
          const exerciseName = importedEntry?.name || exercise.name;
          const target = importedEntry?.target || exercise.target;
          const metric = inferMetricFromTarget(target, exercise.metric);

          return {
            exerciseId:
              exerciseName === exercise.name
                ? exercise.id
                : buildImportedExerciseId(templateBlock.id, exerciseName, exerciseIndex),
            exerciseName,
            weight: importedEntry?.weight || "",
            performance: importedBlock.type === "single" ? importedEntry?.value || "" : "",
            setsCompleted: importedBlock.type === "paired" ? importedEntry?.value || "" : "",
            target,
            metric,
          };
        }),
      };
    });

    sessions.push({
      id: uid(),
      programId: program.id,
      routineId: routine.id,
      memberId,
      date: normalizeImportedDate(date),
      sessionNumber: String(sessionNumber),
      blocks,
      createdAt: getSafeDateIsoString(date),
    });
  });

  return sessions;
};

const parseAnyImportedSessions = (raw: string, program: Program, memberId: string) => {
  return /Session #:/i.test(raw) && /Routine:\s*Day\s*\d+/i.test(raw)
    ? parseRelayImportedSessions(raw, program, memberId)
    : parseImportedSessions(raw, program, memberId);
};


// ===== SMALL UI PARTS =====

function SectionCard({
  title,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-lg font-semibold text-zinc-900">{title}</div>
        {collapsible ? (
          <button
            onClick={() => setIsOpen((prev) => !prev)}
            className="rounded-lg border border-zinc-200 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50"
          >
            {isOpen ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>
      {(!collapsible || isOpen) && children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">{children}</div>;
}

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 ${props.className || ""}`} />;
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={`w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none focus:border-zinc-500 ${props.className || ""}`} />;
}

function SmallButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm font-medium text-zinc-800 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function PrimaryButton({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`rounded-xl bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function ToggleButton({ active, children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={`rounded-xl px-3 py-2 text-sm font-medium transition ${active ? "bg-zinc-900 text-white" : "border border-zinc-300 bg-white text-zinc-800 hover:bg-zinc-50"} ${props.className || ""}`}
    >
      {children}
    </button>
  );
}

function PathBar({ items }: { items: { label: string; onClick?: () => void }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-zinc-200 bg-white p-2 text-sm font-medium shadow-sm">
      {items.map((item, index) => (
        <button
          key={`${item.label}-${index}`}
          onClick={item.onClick}
          className={`flex items-center gap-2 rounded-xl px-3 py-2 transition ${item.onClick ? "bg-zinc-50 hover:bg-zinc-100 text-zinc-800" : "bg-zinc-900 text-white cursor-default"}`}
        >
          {item.label}
          {index < items.length - 1 && <span className="text-zinc-400">›</span>}
        </button>
      ))}
    </div>
  );
}


// ===== AI SUMMARY ARCHITECTURE =====

type AISummaryLabel = "Exceptional Growth" | "Moderate Growth" | "Stable Growth" | "Contextual Decline";
type AISummaryTone = "exceptional" | "positive" | "neutral" | "contextual" | "baseline";
type AISummaryReportAccuracy = "High" | "Moderate" | "Low";
type AISummaryMarkerKind =
  | "output_rise"
  | "output_decline"
  | "output_plateau"
  | "output_volatility"
  | "weight_progression"
  | "consecutive_weight_progression"
  | "retained_output_under_weight"
  | "synchronized_progression"
  | "constraint_present"
  | "rebound"
  | "late_dip"
  | "explosive_jump"
  | "strong_finish"
  | "low_data";

type AISummaryStoryIdentity =
  | "stacked_progression"
  | "synchronized_advancement"
  | "hidden_progression"
  | "constraint_progression"
  | "steady_growth"
  | "stable_retention"
  | "mixed_signals"
  | "sustained_decline"
  | "decline_with_context"
  | "baseline_read";

type AISummarySlotKind =
  | "opener"
  | "dominant_achievement"
  | "highlight"
  | "supporting_context"
  | "structural_explanation"
  | "closer";

type AISummaryMarker = {
  kind: AISummaryMarkerKind;
  text: string;
  strength: number;
  seriesName?: string;
};

type AISummaryAchievement = {
  id: string;
  title: string;
  detail: string;
  strength: number;
  labelImpact: "supports" | "promotes" | "carries";
  markerKinds: AISummaryMarkerKind[];
};

type AISummaryInterpretedAchievementKind =
  | "exceptional_fallback"
  | "explosive_continuity"
  | "dominant_baseline_separation"
  | "escalating_constrained_progression"
  | "tight_baseline_range"
  | "breakout_range"
  | "elevated_floor"
  | "retained_adaptation"
  | "hidden_progression"
  | "repeated_demand"
  | "retained_separation"
  | "tradeoff_recovery"
  | "controlled_progression"
  | "controlled_workflow"
  | "consistent_output_progression"
  | "sustained_performance"
  | "outlier_hiccup"
  | "balanced_volatility"
  | "constraint_floor"
  | "exercise_change_stability"
  | "exercise_change_context"
  | "discipline_support"
  | "constraint_payoff"
  | "weighted_conditioning"
  | "significant_weight_gain"
  | "substantial_weight_gain"
  | "substantial_weight_tradeoff"
  | "constraint_work_area"
  | "strong_output_ceiling"
  | "strong_output_floor"
  | "preserved_volatility"
  | "explosive_conditioning_climb"
  | "vertical_relaunch_conditioning"
  | "explosive_constrained_progression"
  | "true_consistency_check"
  | "contextual_decline"
  | "baseline_support";

type AISummaryInterpretedAchievement = {
  kind: AISummaryInterpretedAchievementKind;
  title: string;
  meaning: string;
  summarySentence: string;
  strength: number;
  labelImpact: "supports" | "promotes" | "carries";
  evidenceMarkerKinds: AISummaryMarkerKind[];
};

type AISummaryHighlight = {
  title: string;
  detail: string;
  strength: number;
};

type AISummarySeriesProfile = {
  exerciseName: string;
  points: GraphPoint[];
  exerciseNameVariants: string[];
  hasExerciseChange: boolean;
  startOutput: number;
  endOutput: number;
  peakOutput: number;
  lowOutput: number;
  outputDelta: number;
  outputRange: number;
  outputPercentChange: number;
  numericWeights: number[];
  uniqueNumericWeights: number[];
  weightIncreaseCount: number;
  consecutiveWeightIncreaseCount: number;
  totalWeightIncrease: number;
  hasWeightProgression: boolean;
  hasMaintainedOutputUnderWeight: boolean;
  hasLateDip: boolean;
  hasRebound: boolean;
  hasExplosiveJump: boolean;
  endsAtPeak: boolean;
  isFlatOrControlled: boolean;
};

type AISummaryScorecard = {
  mode: BlockType;
  seriesProfiles: AISummarySeriesProfile[];
  sessionCount: number;
  hasExerciseChange: boolean;
  dataConfidence: AISummaryReportAccuracy;
  startOutputAverage: number;
  endOutputAverage: number;
  outputDeltaAverage: number;
  outputRangeAverage: number;
  totalWeightIncreaseCount: number;
  maxConsecutiveWeightIncreaseCount: number;
  hasConstraints: boolean;
  constraintTags: string[];
  hasSynchronizedProgression: boolean;
  hasRetainedOutputUnderWeight: boolean;
  hasExplosiveJump: boolean;
  hasLateDip: boolean;
  hasRebound: boolean;
  markers: AISummaryMarker[];
};

type AISummaryClassification = {
  label: AISummaryLabel;
  confidence: number;
  reasons: AISummaryMarker[];
};

type AISummaryStory = {
  identity: AISummaryStoryIdentity;
  label: AISummaryLabel;
  tone: AISummaryTone;
  needsStructuralExplanation: boolean;
};

type AISummarySlotPlan = {
  allowSecondaryHighlight: boolean;
  secondaryHighlightMinStrength: number;
  allowFallbackHighlight: boolean;
  allowStructuralExplanation: boolean;
  allowCloser: boolean;
};

type AISummaryResolvedSlot = {
  kind: AISummarySlotKind;
  text: string;
  importance: number;
};

type WorkoutSummaryInsight = {
  id: string;
  label: AISummaryLabel;
  headline: string;
  summary: string;
  tone: AISummaryTone;
  reportAccuracy: AISummaryReportAccuracy;
  accuracyReason: string;
  achievements: AISummaryAchievement[];
  interpretedAchievements: AISummaryInterpretedAchievement[];
  highlights: AISummaryHighlight[];
  markers: AISummaryMarker[];
  slots: AISummaryResolvedSlot[];
};

const AI_SUMMARY_CONSTRAINT_PATTERNS = ["TEMPO", "PAUSE", "ECC"];

const getAISummaryUniqueValues = <T,>(values: T[]) => Array.from(new Set(values));

const getAISummaryPointTime = (point: GraphPoint) => {
  const dateTime = getSafeDateTime(point.date);
  return Number.isFinite(dateTime) && dateTime > 0 ? dateTime : point.sessionNumber;
};

const getAISummaryNumericWeight = (weight: string) => {
  const normalized = normalizeWeightInput(weight);
  if (!normalized || normalized === "BW") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

const getAISummarySeriesProfile = (series: GraphSeries): AISummarySeriesProfile | null => {
  const points = [...series.points].sort((a, b) => getAISummaryPointTime(a) - getAISummaryPointTime(b));
  if (points.length < 2) return null;

  const outputValues = points.map((point) => point.y).filter((value) => Number.isFinite(value));
  if (outputValues.length < 2) return null;

  const startOutput = outputValues[0];
  const endOutput = outputValues[outputValues.length - 1];
  const peakOutput = Math.max(...outputValues);
  const lowOutput = Math.min(...outputValues);
  const outputDelta = endOutput - startOutput;
  const outputRange = peakOutput - lowOutput;
  const outputPercentChange = Math.abs(startOutput) > 0 ? outputDelta / Math.abs(startOutput) : outputDelta;
  const numericWeights = points.map((point) => getAISummaryNumericWeight(point.weight)).filter((value): value is number => value != null);
  const uniqueNumericWeights = getAISummaryUniqueValues(numericWeights).sort((a, b) => a - b);
  const exerciseNameVariants = getAISummaryUniqueValues(points.map((point) => String(point.exerciseName || series.exerciseName).trim()).filter(Boolean));
  const hasExerciseChange = exerciseNameVariants.length > 1;

  let weightIncreaseCount = 0;
  let consecutiveWeightIncreaseCount = 0;
  let currentConsecutiveWeightIncreaseCount = 0;
  let previousWeight: number | null = null;

  numericWeights.forEach((weight) => {
    if (previousWeight != null && weight > previousWeight) {
      weightIncreaseCount += 1;
      currentConsecutiveWeightIncreaseCount += 1;
      consecutiveWeightIncreaseCount = Math.max(consecutiveWeightIncreaseCount, currentConsecutiveWeightIncreaseCount);
    } else if (previousWeight != null && weight < previousWeight) {
      currentConsecutiveWeightIncreaseCount = 0;
    }

    previousWeight = weight;
  });

  const firstWeight = numericWeights[0] ?? null;
  const lastWeight = numericWeights[numericWeights.length - 1] ?? null;
  const totalWeightIncrease = firstWeight != null && lastWeight != null ? lastWeight - firstWeight : 0;
  const hasWeightProgression = weightIncreaseCount > 0 || totalWeightIncrease > 0;
  const hasMaintainedOutputUnderWeight = hasWeightProgression && endOutput >= startOutput - 1;
  const finalThree = outputValues.slice(-3);
  const priorToFinalThree = outputValues.slice(0, Math.max(0, outputValues.length - 3));
  const priorAverage = priorToFinalThree.length
    ? priorToFinalThree.reduce((sum, value) => sum + value, 0) / priorToFinalThree.length
    : startOutput;
  const finalAverage = finalThree.length ? finalThree.reduce((sum, value) => sum + value, 0) / finalThree.length : endOutput;
  const hasLateDip = outputValues.length >= 5 && finalAverage < priorAverage - Math.max(1, outputRange * 0.25);
  const hasRebound = outputValues.some((value, index) => index > 0 && index < outputValues.length - 1 && value < outputValues[index - 1] - 0.5 && outputValues[index + 1] >= value + 0.5);
  const biggestJump = outputValues.reduce((maxJump, value, index) => {
    if (index === 0) return maxJump;
    return Math.max(maxJump, value - outputValues[index - 1]);
  }, 0);
  const hasExplosiveJump = biggestJump >= Math.max(4, Math.abs(startOutput) * 0.35);
  const endsAtPeak = endOutput === peakOutput;
  const isFlatOrControlled = outputRange <= Math.max(1.5, Math.abs(startOutput) * 0.25);

  return {
    exerciseName: series.exerciseName,
    points,
    exerciseNameVariants,
    hasExerciseChange,
    startOutput,
    endOutput,
    peakOutput,
    lowOutput,
    outputDelta,
    outputRange,
    outputPercentChange,
    numericWeights,
    uniqueNumericWeights,
    weightIncreaseCount,
    consecutiveWeightIncreaseCount,
    totalWeightIncrease,
    hasWeightProgression,
    hasMaintainedOutputUnderWeight,
    hasLateDip,
    hasRebound,
    hasExplosiveJump,
    endsAtPeak,
    isFlatOrControlled,
  };
};

const buildAISummaryScorecard = (graphData: GraphSeries[], blockType: BlockType): AISummaryScorecard | null => {
  const seriesProfiles = graphData.map(getAISummarySeriesProfile).filter((profile): profile is AISummarySeriesProfile => Boolean(profile));
  if (!seriesProfiles.length) return null;

  const allPoints = graphData.flatMap((series) => series.points);
  const sessionCount = getAISummaryUniqueValues(allPoints.map((point) => point.sessionId)).length || Math.max(...seriesProfiles.map((profile) => profile.points.length));
  const dataConfidence: AISummaryReportAccuracy = sessionCount >= 6 ? "High" : sessionCount >= 4 ? "Moderate" : "Low";
  const allExerciseNames = graphData.map((series) => series.exerciseName.toUpperCase()).join(" ");
  const constraintTags = AI_SUMMARY_CONSTRAINT_PATTERNS.filter((tag) => allExerciseNames.includes(tag.replace(".", "")) || allExerciseNames.includes(tag));
  const hasConstraints = constraintTags.length > 0;
  const startOutputAverage = seriesProfiles.reduce((sum, profile) => sum + profile.startOutput, 0) / seriesProfiles.length;
  const endOutputAverage = seriesProfiles.reduce((sum, profile) => sum + profile.endOutput, 0) / seriesProfiles.length;
  const outputDeltaAverage = endOutputAverage - startOutputAverage;
  const outputRangeAverage = seriesProfiles.reduce((sum, profile) => sum + profile.outputRange, 0) / seriesProfiles.length;
  const totalWeightIncreaseCount = seriesProfiles.reduce((sum, profile) => sum + profile.weightIncreaseCount, 0);
  const maxConsecutiveWeightIncreaseCount = Math.max(...seriesProfiles.map((profile) => profile.consecutiveWeightIncreaseCount));
  const hasSynchronizedProgression = blockType === "paired" && seriesProfiles.length > 1 && seriesProfiles.every((profile) => profile.outputDelta >= 0 || profile.hasMaintainedOutputUnderWeight);
  const hasRetainedOutputUnderWeight = seriesProfiles.some((profile) => profile.hasMaintainedOutputUnderWeight);
  const hasExplosiveJump = seriesProfiles.some((profile) => profile.hasExplosiveJump);
  const hasLateDip = seriesProfiles.some((profile) => profile.hasLateDip);
  const hasRebound = seriesProfiles.some((profile) => profile.hasRebound);
  const hasExerciseChange =
    seriesProfiles.some((profile) => profile.hasExerciseChange) ||
    graphData.some((series) => /\bchanged\b/i.test(series.exerciseName)) ||
    (blockType === "paired" && graphData.length > 2);

  const markers: AISummaryMarker[] = [];

  if (outputDeltaAverage > 1) {
    markers.push({ kind: "output_rise", text: "Output finished higher than it started.", strength: Math.min(1, Math.abs(outputDeltaAverage) / 8) });
  } else if (outputDeltaAverage < -1) {
    markers.push({ kind: "output_decline", text: "Output finished lower than it started.", strength: Math.min(1, Math.abs(outputDeltaAverage) / 8) });
  } else {
    markers.push({ kind: "output_plateau", text: "Output stayed in a controlled range.", strength: 0.45 });
  }

  if (totalWeightIncreaseCount > 0) {
    markers.push({ kind: "weight_progression", text: "Weight increased across the block.", strength: Math.min(1, totalWeightIncreaseCount / 6) });
  }

  if (maxConsecutiveWeightIncreaseCount >= 3) {
    markers.push({ kind: "consecutive_weight_progression", text: `${maxConsecutiveWeightIncreaseCount} consecutive weight increases appeared in the block.`, strength: Math.min(1, maxConsecutiveWeightIncreaseCount / 5) });
  }

  if (hasRetainedOutputUnderWeight) {
    markers.push({ kind: "retained_output_under_weight", text: "Output was retained while weight demand increased.", strength: 0.82 });
  }

  if (hasSynchronizedProgression) {
    markers.push({ kind: "synchronized_progression", text: "Both exercises contributed positively to the read.", strength: 0.76 });
  }

  if (hasConstraints) {
    markers.push({ kind: "constraint_present", text: `${constraintTags.join("/")} constraints are present.`, strength: 0.68 });
  }

  if (hasExplosiveJump) {
    markers.push({ kind: "explosive_jump", text: "A large output jump separated the graph from baseline.", strength: 0.9 });
  }

  if (hasRebound) {
    markers.push({ kind: "rebound", text: "A dip was followed by a recovery signal.", strength: 0.58 });
  }

  if (hasLateDip) {
    markers.push({ kind: "late_dip", text: "There was a late-program dip to interpret with context.", strength: 0.48 });
  }

  if (dataConfidence === "Low") {
    markers.push({ kind: "low_data", text: "More sessions would improve confidence.", strength: 0.5 });
  }

  return {
    mode: blockType,
    seriesProfiles,
    sessionCount,
    hasExerciseChange,
    dataConfidence,
    startOutputAverage,
    endOutputAverage,
    outputDeltaAverage,
    outputRangeAverage,
    totalWeightIncreaseCount,
    maxConsecutiveWeightIncreaseCount,
    hasConstraints,
    constraintTags,
    hasSynchronizedProgression,
    hasRetainedOutputUnderWeight,
    hasExplosiveJump,
    hasLateDip,
    hasRebound,
    markers,
  };
};

const getAISummaryMarker = (scorecard: AISummaryScorecard, kind: AISummaryMarkerKind) =>
  scorecard.markers.find((marker) => marker.kind === kind);

type AISummaryLegacySignalTag =
  | "no_signal"
  | "finish_above_start"
  | "finish_below_start"
  | "late_average_above_early"
  | "late_average_below_early"
  | "weight_increased"
  | "three_weight_increases"
  | "four_plus_weight_increases"
  | "maintained_under_load"
  | "tradeoff_drop_under_load"
  | "recovered_after_tradeoff"
  | "unrecovered_tradeoff"
  | "major_set_gain"
  | "controlled_major_set_gain"
  | "strong_finish"
  | "volatile_without_resolution"
  | "spike_not_retained"
  | "early_gain_then_plateau"
  | "late_spike_without_support"
  | "plateau_after_progression"
  | "no_output_progression_under_load"
  | "load_drop_observed"
  | "retained_meaningful_improvement"
  | "synchronized_plateau_breakthrough";

type AISummaryLegacyStats = {
  outputs: number[];
  weights: number[];
  firstOutput: number;
  lastOutput: number;
  firstWeight: number;
  lastWeight: number;
  minOutput: number;
  maxOutput: number;
  outputRange: number;
  outputDelta: number;
  weightDelta: number;
  outputIncreaseCount: number;
  weightIncreaseCount: number;
  maxOutputRun: number;
  maxWeightRun: number;
  earlyAverage: number;
  lateAverage: number;
  averageDelta: number;
  percentChange: number;
  peakRetentionGap: number;
  hasSignificantGap: boolean;
};

type AISummaryLegacyScorecard = {
  label: AISummaryLabel;
  growthScore: number;
  exceptionalScore: number;
  riskScore: number;
  declineScore: number;
  finalScore: number;
  tags: AISummaryLegacySignalTag[];
  profile: AISummarySeriesProfile | null;
};

const addAISummaryLegacyTag = (tags: AISummaryLegacySignalTag[], tag: AISummaryLegacySignalTag) => {
  if (!tags.includes(tag)) tags.push(tag);
};

const getAISummaryLegacyAverage = (values: number[]) =>
  values.length ? values.reduce((total, value) => total + value, 0) / values.length : 0;

const countAISummaryLegacyIncreases = (values: number[]) => {
  let count = 0;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) count += 1;
  }
  return count;
};

const getAISummaryLegacyMaxUpwardRun = (values: number[]) => {
  let currentRun = 0;
  let maxRun = 0;

  for (let index = 1; index < values.length; index += 1) {
    if (values[index] > values[index - 1]) {
      currentRun += 1;
      maxRun = Math.max(maxRun, currentRun);
    } else {
      currentRun = 0;
    }
  }

  return maxRun;
};

const getAISummaryLegacyPointTime = (point: GraphPoint) => {
  const value = getSafeDateTime(point.date);
  return Number.isFinite(value) ? value : NaN;
};

const parseAISummaryLegacyWeight = (weight: string) => {
  const normalized = normalizeWeightInput(weight);
  if (!normalized || normalized === "BW") return 0;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
};

const isAISummaryLegacyControlledProfile = (profile: AISummarySeriesProfile | null | undefined) => {
  const firstPoint = profile?.points?.[0];
  const name = String(profile?.exerciseName || "").toLowerCase();
  const target = String(firstPoint?.target || "").toLowerCase();
  const combined = `${name} ${target}`;

  return /\btempo\b/.test(combined) || /\bpause\b/.test(combined) || /\becc\b/.test(combined) || /eccentric/.test(combined) || /\biso\b/.test(combined);
};

const getAISummaryLegacyStats = (profile: AISummarySeriesProfile): AISummaryLegacyStats => {
  const points = [...profile.points].sort((a, b) => {
    const timeA = Number.isFinite(getAISummaryLegacyPointTime(a)) ? getAISummaryLegacyPointTime(a) : a.sessionNumber;
    const timeB = Number.isFinite(getAISummaryLegacyPointTime(b)) ? getAISummaryLegacyPointTime(b) : b.sessionNumber;
    return timeA - timeB;
  });
  const outputs = points.map((point) => Number(point.y)).filter((value) => Number.isFinite(value));
  const weights = points.map((point) => parseAISummaryLegacyWeight(point.weight));
  const firstOutput = outputs[0] || 0;
  const lastOutput = outputs[outputs.length - 1] || 0;
  const firstWeight = weights[0] || 0;
  const lastWeight = weights[weights.length - 1] || 0;
  const minOutput = outputs.length ? Math.min(...outputs) : 0;
  const maxOutput = outputs.length ? Math.max(...outputs) : 0;
  const outputRange = maxOutput - minOutput;
  const outputDelta = lastOutput - firstOutput;
  const weightDelta = lastWeight - firstWeight;
  const outputIncreaseCount = countAISummaryLegacyIncreases(outputs);
  const weightIncreaseCount = countAISummaryLegacyIncreases(weights);
  const maxOutputRun = getAISummaryLegacyMaxUpwardRun(outputs);
  const maxWeightRun = getAISummaryLegacyMaxUpwardRun(weights);
  const windowSize = Math.min(3, Math.max(1, Math.ceil(outputs.length / 3)));
  const earlyAverage = getAISummaryLegacyAverage(outputs.slice(0, windowSize));
  const lateAverage = getAISummaryLegacyAverage(outputs.slice(-windowSize));
  const averageDelta = lateAverage - earlyAverage;
  const percentChange = firstOutput ? outputDelta / Math.max(1, Math.abs(firstOutput)) : 0;
  const peakRetentionGap = maxOutput - lastOutput;
  const timePoints = points.map((point) => getAISummaryLegacyPointTime(point)).filter((value) => Number.isFinite(value));
  const gaps = timePoints.slice(1).map((time, index) => time - timePoints[index]);
  const averageGap = getAISummaryLegacyAverage(gaps);
  const hasSignificantGap = Boolean(gaps.length && averageGap > 0 && gaps.some((gap) => gap > averageGap * 1.75));

  return {
    outputs,
    weights,
    firstOutput,
    lastOutput,
    firstWeight,
    lastWeight,
    minOutput,
    maxOutput,
    outputRange,
    outputDelta,
    weightDelta,
    outputIncreaseCount,
    weightIncreaseCount,
    maxOutputRun,
    maxWeightRun,
    earlyAverage,
    lateAverage,
    averageDelta,
    percentChange,
    peakRetentionGap,
    hasSignificantGap,
  };
};

const hasAISummaryLegacyDropAfterLoadIncrease = (stats: AISummaryLegacyStats) => {
  for (let index = 1; index < stats.outputs.length; index += 1) {
    if (stats.weights[index] > stats.weights[index - 1] && stats.outputs[index] <= stats.outputs[index - 1] - 1) return true;
  }
  return false;
};

const hasAISummaryLegacyRecoveryAfterLoadDrop = (stats: AISummaryLegacyStats) => {
  for (let index = 1; index < stats.outputs.length - 1; index += 1) {
    const droppedUnderLoad = stats.weights[index] > stats.weights[index - 1] && stats.outputs[index] <= stats.outputs[index - 1] - 1;
    if (!droppedUnderLoad) continue;

    const nextOutputs = stats.outputs.slice(index + 1);
    const recoveryTarget = Math.max(stats.firstOutput, stats.outputs[index - 1] - 0.5);
    if (nextOutputs.some((output) => output >= recoveryTarget)) return true;
  }
  return false;
};

const hasAISummaryLegacyWeightDrop = (stats: AISummaryLegacyStats) => {
  for (let index = 1; index < stats.weights.length; index += 1) {
    if (stats.weights[index] > 0 && stats.weights[index - 1] > 0 && stats.weights[index] < stats.weights[index - 1]) return true;
  }
  return false;
};

const getAISummaryLegacyPreviousOutput = (stats: AISummaryLegacyStats) =>
  stats.outputs.length >= 2 ? stats.outputs[stats.outputs.length - 2] : stats.lastOutput;

const buildAISummaryLegacySeriesScorecard = (
  profile: AISummarySeriesProfile,
  mode: BlockType
): AISummaryLegacyScorecard => {
  const stats = getAISummaryLegacyStats(profile);
  const controlled = isAISummaryLegacyControlledProfile(profile);
  const tags: AISummaryLegacySignalTag[] = [];
  let growthScore = 0;
  let exceptionalScore = 0;
  let riskScore = 0;
  let declineScore = 0;

  const hasWeightIncrease = stats.weightIncreaseCount > 0 || stats.weightDelta > 0;
  const noSignal = stats.outputs.length < 3 || (stats.outputRange <= 0.1 && !hasWeightIncrease);
  const meaningfulFinishGain = mode === "single"
    ? stats.outputDelta >= 1 || (stats.outputDelta >= 0.75 && stats.averageDelta >= 0.5 && stats.firstOutput >= 8)
    : stats.outputDelta >= 1;
  const strongFinishGain = mode === "single"
    ? stats.outputDelta >= 3 || stats.averageDelta >= 2 || stats.percentChange >= 0.18
    : stats.outputDelta >= 3 || stats.averageDelta >= 2;
  const lateAverageUp = mode === "single" ? stats.averageDelta >= 1 : stats.averageDelta >= 0.5;
  const lateAverageDown = mode === "single" ? stats.averageDelta <= -1 : stats.averageDelta <= -0.75;
  const finishBelowStart = stats.outputDelta <= -1;
  const maintainedUnderLoad = hasWeightIncrease && stats.lastOutput >= stats.firstOutput - 0.25 && stats.lateAverage >= stats.earlyAverage - 0.5;
  const dropUnderLoad = hasAISummaryLegacyDropAfterLoadIncrease(stats);
  const recoveredAfterLoadDrop = hasAISummaryLegacyRecoveryAfterLoadDrop(stats);
  const unrecoveredTradeoff = dropUnderLoad && !recoveredAfterLoadDrop && stats.lastOutput < stats.firstOutput;
  const spikeNotRetained = stats.maxOutput >= stats.firstOutput + 2 && stats.peakRetentionGap >= 2 && stats.lastOutput < stats.maxOutput - 1;
  const volatileWithoutResolution = stats.outputRange >= 3 && !meaningfulFinishGain && !lateAverageUp;
  const controlledMajorSetGain = controlled && stats.outputDelta >= 3;
  const majorSetGain = stats.outputDelta >= 3;
  const previousOutput = getAISummaryLegacyPreviousOutput(stats);
  const loadDropObserved = mode === "paired" && hasAISummaryLegacyWeightDrop(stats);
  const finalPointIsPeak = stats.lastOutput >= stats.maxOutput - 0.1;
  const finalSpikeWithoutSupport =
    finalPointIsPeak &&
    stats.outputs.length >= 5 &&
    stats.lastOutput - previousOutput >= Math.max(2, stats.outputRange * 0.35) &&
    stats.lateAverage <= stats.lastOutput - 1.25 &&
    stats.maxOutputRun < 3;
  const earlyGainThenPlateau =
    mode === "single" &&
    meaningfulFinishGain &&
    stats.outputRange <= 1.5 &&
    stats.maxOutput <= stats.lastOutput + 0.25 &&
    stats.lateAverage <= stats.maxOutput - 0.1;
  const noOutputProgressionUnderLoad =
    mode === "paired" && hasWeightIncrease && stats.outputDelta < 1 && stats.averageDelta < 0.5;
  const plateauAfterProgression =
    mode === "paired" &&
    hasWeightIncrease &&
    maintainedUnderLoad &&
    stats.outputDelta <= 1 &&
    stats.averageDelta <= 0.75 &&
    stats.outputRange <= 1.5;

  if (noSignal) addAISummaryLegacyTag(tags, "no_signal");
  if (meaningfulFinishGain) addAISummaryLegacyTag(tags, "finish_above_start");
  if (finishBelowStart) addAISummaryLegacyTag(tags, "finish_below_start");
  if (lateAverageUp) addAISummaryLegacyTag(tags, "late_average_above_early");
  if (lateAverageDown) addAISummaryLegacyTag(tags, "late_average_below_early");
  if (hasWeightIncrease) addAISummaryLegacyTag(tags, "weight_increased");
  if (stats.maxWeightRun >= 3) addAISummaryLegacyTag(tags, "three_weight_increases");
  if (stats.maxWeightRun >= 4) addAISummaryLegacyTag(tags, "four_plus_weight_increases");
  if (maintainedUnderLoad) addAISummaryLegacyTag(tags, "maintained_under_load");
  if (dropUnderLoad) addAISummaryLegacyTag(tags, "tradeoff_drop_under_load");
  if (recoveredAfterLoadDrop) addAISummaryLegacyTag(tags, "recovered_after_tradeoff");
  if (unrecoveredTradeoff) addAISummaryLegacyTag(tags, "unrecovered_tradeoff");
  if (majorSetGain) addAISummaryLegacyTag(tags, "major_set_gain");
  if (controlledMajorSetGain) addAISummaryLegacyTag(tags, "controlled_major_set_gain");
  if (strongFinishGain) addAISummaryLegacyTag(tags, "strong_finish");
  if (volatileWithoutResolution) addAISummaryLegacyTag(tags, "volatile_without_resolution");
  if (spikeNotRetained) addAISummaryLegacyTag(tags, "spike_not_retained");
  if (earlyGainThenPlateau) addAISummaryLegacyTag(tags, "early_gain_then_plateau");
  if (finalSpikeWithoutSupport) addAISummaryLegacyTag(tags, "late_spike_without_support");
  if (plateauAfterProgression) addAISummaryLegacyTag(tags, "plateau_after_progression");
  if (noOutputProgressionUnderLoad) addAISummaryLegacyTag(tags, "no_output_progression_under_load");
  if (loadDropObserved) addAISummaryLegacyTag(tags, "load_drop_observed");

  if (meaningfulFinishGain) growthScore += 2;
  if (lateAverageUp) growthScore += mode === "single" ? 3 : 2;
  if (hasWeightIncrease) growthScore += 1;
  if (stats.maxWeightRun >= 3) growthScore += 2;
  if (stats.maxWeightRun >= 4) {
    growthScore += 3;
    exceptionalScore += 1;
  }
  if (maintainedUnderLoad) growthScore += 2;
  if (recoveredAfterLoadDrop) growthScore += 2;
  if (strongFinishGain) growthScore += mode === "single" ? 4 : 3;
  if (majorSetGain && mode === "paired") growthScore += 2;
  if (controlledMajorSetGain && mode === "paired") exceptionalScore += 1;
  if (stats.outputIncreaseCount >= 3 && stats.lastOutput >= stats.firstOutput) growthScore += 1;

  if (spikeNotRetained) riskScore += 2;
  if (volatileWithoutResolution) riskScore += 2;
  if (unrecoveredTradeoff) riskScore += 3;
  if (earlyGainThenPlateau) riskScore += 2;
  if (finalSpikeWithoutSupport) riskScore += 3;
  if (plateauAfterProgression) riskScore += 2;
  if (noOutputProgressionUnderLoad && !controlled) riskScore += 2;
  if (noOutputProgressionUnderLoad && controlled) riskScore += 1;
  if (loadDropObserved) riskScore += 2;
  if (stats.hasSignificantGap && stats.outputDelta < 0) riskScore += 1;

  if (finishBelowStart) declineScore += 2;
  if (lateAverageDown) declineScore += 2;
  if (!hasWeightIncrease && finishBelowStart && lateAverageDown) declineScore += 2;
  if (unrecoveredTradeoff) declineScore += 1;

  if (dropUnderLoad && recoveredAfterLoadDrop) riskScore = Math.max(0, riskScore - 1);

  const finalScore = growthScore + exceptionalScore * 2 - riskScore;
  let label: AISummaryLabel = "Stable Growth";

  if (noSignal) {
    label = "Stable Growth";
  } else if (declineScore >= 5 && finalScore < 2) {
    label = "Contextual Decline";
  } else if (mode === "single") {
    const singleFinishesBelowBaseline = stats.lastOutput < stats.firstOutput;
    const singleStrongEligible =
      !singleFinishesBelowBaseline &&
      !volatileWithoutResolution &&
      !finalSpikeWithoutSupport &&
      !earlyGainThenPlateau &&
      (lateAverageUp || stats.maxOutputRun >= 3 || (strongFinishGain && stats.peakRetentionGap <= 1));

    if (singleFinishesBelowBaseline) {
      label = "Stable Growth";
    } else if (singleStrongEligible && finalScore >= 8) {
      label = "Exceptional Growth";
    } else if (finalScore >= 3 || meaningfulFinishGain) {
      label = "Moderate Growth";
    }
  } else {
    const strongCap =
      finalSpikeWithoutSupport ||
      plateauAfterProgression ||
      noOutputProgressionUnderLoad ||
      loadDropObserved ||
      (lateAverageDown && stats.outputDelta <= 0);
    const canReachStrong = !strongCap && (exceptionalScore >= 1 || (growthScore >= 9 && riskScore <= 1));

    if (canReachStrong && finalScore >= 7) {
      label = "Exceptional Growth";
    } else if (finalScore >= 3 || (hasWeightIncrease && stats.lastOutput >= stats.firstOutput - 1)) {
      label = "Moderate Growth";
    }
  }

  return { label, growthScore, exceptionalScore, riskScore, declineScore, finalScore, tags, profile };
};

const hasAISummaryStrictRetainedMeaningfulImprovement = (items: AISummaryLegacyScorecard[]) => {
  if (items.length < 2) return false;

  const statItems = items
    .filter((item) => item.profile)
    .map((item) => ({ item, stats: getAISummaryLegacyStats(item.profile as AISummarySeriesProfile) }));
  if (!statItems.length || !statItems.every(({ stats }) => stats.outputs.length >= 4)) return false;

  const allSeriesFinishMeaningfullyAboveBaseline = statItems.every(({ stats }) => stats.lastOutput - stats.firstOutput >= 2);
  const hasDemandContext = statItems.some(
    ({ item, stats }) => item.tags.includes("weight_increased") || stats.weightIncreaseCount > 0 || stats.weightDelta > 0
  );
  const hasStandoutRetainedGain = statItems.some(({ stats }) => {
    const peakGain = stats.maxOutput - stats.firstOutput;
    const finalGain = stats.lastOutput - stats.firstOutput;
    const retentionRatio = peakGain > 0 ? finalGain / peakGain : 0;
    return peakGain >= 4 && finalGain >= 2 && retentionRatio >= 0.5;
  });
  const hasHardLimiter = statItems.some(
    ({ item, stats }) => item.tags.includes("unrecovered_tradeoff") || item.tags.includes("finish_below_start") || stats.lastOutput < stats.firstOutput
  );

  return allSeriesFinishMeaningfullyAboveBaseline && hasDemandContext && hasStandoutRetainedGain && !hasHardLimiter;
};

const hasAISummarySynchronizedPlateauBreakthrough = (items: AISummaryLegacyScorecard[]) => {
  if (items.length < 2) return false;

  return items.every((item) => {
    if (!item.profile) return false;
    const stats = getAISummaryLegacyStats(item.profile);
    if (stats.outputs.length < 5) return false;

    const finalIndex = stats.outputs.length - 1;
    const previousOutput = stats.outputs[finalIndex - 1];
    const previousWeight = stats.weights[finalIndex - 1] || 0;
    const finalWeight = stats.weights[finalIndex] || 0;
    const priorWindow = stats.outputs.slice(Math.max(0, finalIndex - 3), finalIndex);
    const priorRange = priorWindow.length ? Math.max(...priorWindow) - Math.min(...priorWindow) : 0;
    const noMeaningfulRegressionInPlateau = priorWindow.every((value) => value >= previousOutput - 0.5);
    const demandHeldOrIncreased = finalWeight === 0 || previousWeight === 0 || finalWeight >= previousWeight;

    return (
      priorWindow.length >= 3 &&
      priorRange <= 0.5 &&
      noMeaningfulRegressionInPlateau &&
      stats.lastOutput >= previousOutput + 1 &&
      stats.lastOutput > stats.firstOutput &&
      demandHeldOrIncreased
    );
  });
};

const combineAISummaryLegacyScorecards = (items: AISummaryLegacyScorecard[]): AISummaryLegacyScorecard => {
  const growthScore = items.reduce((total, item) => total + item.growthScore, 0);
  const exceptionalScore = items.reduce((total, item) => total + item.exceptionalScore, 0);
  const riskScore = items.reduce((total, item) => total + item.riskScore, 0);
  const declineScore = items.reduce((total, item) => total + item.declineScore, 0);
  const finalScore = growthScore + exceptionalScore * 2 - riskScore;
  const tags = items.flatMap((item) => item.tags).filter((tag, index, list) => list.indexOf(tag) === index);
  const strongCount = items.filter((item) => item.label === "Exceptional Growth").length;
  const moderateCount = items.filter((item) => item.label === "Moderate Growth").length;
  const contextualCount = items.filter((item) => item.label === "Contextual Decline").length;
  const positiveCount = strongCount + moderateCount;
  const bothStrong = strongCount === items.length;
  const bothContextual = contextualCount === items.length;
  const anyExceptional = exceptionalScore >= 1;
  const noUnresolvedTradeoff = !tags.includes("unrecovered_tradeoff");
  const noHardDecline = !bothContextual && declineScore < 7;
  const hasStrictRetainedMeaningfulImprovement = hasAISummaryStrictRetainedMeaningfulImprovement(items);
  const hasSynchronizedPlateauBreakthrough = hasAISummarySynchronizedPlateauBreakthrough(items);

  if (hasStrictRetainedMeaningfulImprovement) addAISummaryLegacyTag(tags, "retained_meaningful_improvement");
  if (hasSynchronizedPlateauBreakthrough) addAISummaryLegacyTag(tags, "synchronized_plateau_breakthrough");

  const hasStrongCap =
    tags.includes("late_spike_without_support") ||
    tags.includes("plateau_after_progression") ||
    tags.includes("no_output_progression_under_load") ||
    tags.includes("load_drop_observed") ||
    tags.includes("unrecovered_tradeoff") ||
    items.some((item) => item.tags.includes("finish_below_start") || item.tags.includes("late_average_below_early"));
  const qualifiesByCleanOutstandingSignal =
    (hasStrictRetainedMeaningfulImprovement || hasSynchronizedPlateauBreakthrough) && noHardDecline && noUnresolvedTradeoff;
  const qualifiesByGeneralStrongSignal =
    !hasStrongCap && noHardDecline && noUnresolvedTradeoff && (bothStrong || (anyExceptional && finalScore >= 8) || (growthScore >= 14 && riskScore <= 1));

  let label: AISummaryLabel = "Stable Growth";
  if (bothContextual || (contextualCount > 0 && positiveCount === 0)) {
    label = "Contextual Decline";
  } else if (qualifiesByCleanOutstandingSignal || qualifiesByGeneralStrongSignal) {
    label = "Exceptional Growth";
  } else if (positiveCount > 0 || finalScore >= 3) {
    label = "Moderate Growth";
  }

  return { label, growthScore, exceptionalScore, riskScore, declineScore, finalScore, tags, profile: null };
};

const getAISummaryMarkerFromLegacyTag = (scorecard: AISummaryScorecard, tag: AISummaryLegacySignalTag): AISummaryMarker | null => {
  const lookup: Partial<Record<AISummaryLegacySignalTag, AISummaryMarkerKind>> = {
    finish_above_start: "output_rise",
    finish_below_start: "output_decline",
    late_average_above_early: "output_rise",
    late_average_below_early: "output_decline",
    weight_increased: "weight_progression",
    three_weight_increases: "consecutive_weight_progression",
    four_plus_weight_increases: "consecutive_weight_progression",
    maintained_under_load: "retained_output_under_weight",
    recovered_after_tradeoff: "rebound",
    tradeoff_drop_under_load: "late_dip",
    unrecovered_tradeoff: "late_dip",
    major_set_gain: "output_rise",
    controlled_major_set_gain: "constraint_present",
    strong_finish: "strong_finish",
    volatile_without_resolution: "output_volatility",
    late_spike_without_support: "strong_finish",
    retained_meaningful_improvement: "synchronized_progression",
    synchronized_plateau_breakthrough: "synchronized_progression",
  };

  const markerKind = lookup[tag];
  return markerKind ? getAISummaryMarker(scorecard, markerKind) || null : null;
};

const classifyAISummaryLabel = (scorecard: AISummaryScorecard): AISummaryClassification => {
  const perSeriesScorecards = scorecard.seriesProfiles.map((profile) =>
    buildAISummaryLegacySeriesScorecard(profile, scorecard.mode === "single" ? "single" : "paired")
  );
  const legacyScorecard = perSeriesScorecards.length > 1 ? combineAISummaryLegacyScorecards(perSeriesScorecards) : perSeriesScorecards[0];
  const reasons = legacyScorecard.tags
    .map((tag) => getAISummaryMarkerFromLegacyTag(scorecard, tag))
    .filter((marker): marker is AISummaryMarker => marker !== null)
    .filter((marker, index, list) => list.findIndex((item) => item.kind === marker.kind) === index)
    .slice(0, 5);
  const confidence = Math.max(0.58, Math.min(0.92, 0.62 + Math.abs(legacyScorecard.finalScore) * 0.03 + legacyScorecard.exceptionalScore * 0.04));

  return {
    label: legacyScorecard.label,
    confidence,
    reasons: reasons.length ? reasons : scorecard.markers.slice(0, 3),
  };
};

const getAISummaryBestOutputProfile = (scorecard: AISummaryScorecard) =>
  [...scorecard.seriesProfiles].sort((a, b) => b.outputDelta - a.outputDelta)[0];

const getAISummaryBestWeightProfile = (scorecard: AISummaryScorecard) =>
  [...scorecard.seriesProfiles].sort((a, b) => b.weightIncreaseCount - a.weightIncreaseCount || b.totalWeightIncrease - a.totalWeightIncrease)[0];

const getAISummaryBlockNoun = (scorecard: AISummaryScorecard) => (scorecard.mode === "single" ? "exercise" : "block");

const getAISummaryConstraintText = (scorecard: AISummaryScorecard) =>
  scorecard.constraintTags.length ? ` under ${scorecard.constraintTags.join("/")} constraints` : "";

const buildAISummaryAchievements = (scorecard: AISummaryScorecard, classification: AISummaryClassification): AISummaryAchievement[] => {
  const achievements: AISummaryAchievement[] = [];
  const bestWeightProfile = getAISummaryBestWeightProfile(scorecard);
  const bestOutputProfile = getAISummaryBestOutputProfile(scorecard);
  const constraints = getAISummaryConstraintText(scorecard);

  if (scorecard.hasExplosiveJump && bestOutputProfile) {
    achievements.push({
      id: "explosive-output-jump",
      title: "Explosive output jump",
      detail:
        bestOutputProfile.endsAtPeak
          ? `After an explosive start, you kept climbing and finished ${formatAISummaryDeltaWithMetric(bestOutputProfile.outputDelta, bestOutputProfile)} above where you started.`
          : `You created clear separation from your starting baseline and retained much of that gain.`,
      strength: 0.96,
      labelImpact: "carries",
      markerKinds: ["explosive_jump", "output_rise", "strong_finish"],
    });
  }

  if (scorecard.hasRetainedOutputUnderWeight && bestWeightProfile) {
    const weightText =
      bestWeightProfile.weightIncreaseCount >= 3
        ? ` through ${bestWeightProfile.weightIncreaseCount} weight increases`
        : " while weight increased";
    achievements.push({
      id: "retained-output-under-weight",
      title: "Output held under rising demand",
      detail: `You maintained output${weightText}${constraints}.`,
      strength: classification.label === "Exceptional Growth" ? 0.94 : 0.8,
      labelImpact: classification.label === "Exceptional Growth" ? "carries" : "promotes",
      markerKinds: ["retained_output_under_weight", "weight_progression", "constraint_present"],
    });
  }

  if (scorecard.maxConsecutiveWeightIncreaseCount >= 3 && bestWeightProfile) {
    achievements.push({
      id: "four-plus-weight-increases",
      title: `${scorecard.maxConsecutiveWeightIncreaseCount} consecutive weight increases`,
      detail: `${bestWeightProfile.exerciseName} built rare weight momentum while keeping the block structurally intact.`,
      strength: Math.min(0.96, 0.7 + scorecard.maxConsecutiveWeightIncreaseCount * 0.06),
      labelImpact: scorecard.maxConsecutiveWeightIncreaseCount >= 5 || classification.label === "Exceptional Growth" ? "carries" : "promotes",
      markerKinds: ["consecutive_weight_progression", "weight_progression"],
    });
  }

  if (scorecard.hasSynchronizedProgression) {
    achievements.push({
      id: "synchronized-progression",
      title: "Both exercises supported the read",
      detail: "Both exercises contributed to the growth pattern instead of the summary relying on one standout line.",
      strength: classification.label === "Exceptional Growth" ? 0.84 : 0.72,
      labelImpact: classification.label === "Exceptional Growth" ? "promotes" : "supports",
      markerKinds: ["synchronized_progression"],
    });
  }

  if (bestOutputProfile && bestOutputProfile.outputDelta >= 2 && !scorecard.hasExplosiveJump) {
    achievements.push({
      id: "finished-above-start",
      title: `Finished ${formatAISummaryNumber(bestOutputProfile.outputDelta)} above baseline`,
      detail: `You finished ${formatAISummaryDeltaWithMetric(bestOutputProfile.outputDelta, bestOutputProfile)} above where you started.`,
      strength: Math.min(0.82, 0.56 + bestOutputProfile.outputDelta * 0.04),
      labelImpact: bestOutputProfile.outputDelta >= 4 ? "promotes" : "supports",
      markerKinds: ["output_rise", "strong_finish"],
    });
  }

  if (scorecard.hasLateDip && scorecard.hasRebound) {
    achievements.push({
      id: "rebound-after-dip",
      title: "Recovery after a dip",
      detail: "The temporary dip recovered instead of turning into a sustained breakdown.",
      strength: 0.62,
      labelImpact: "supports",
      markerKinds: ["rebound", "late_dip"],
    });
  }

  if (!achievements.length) {
    const fallbackDetail =
      classification.label === "Contextual Decline"
        ? "The graph moved downward enough to deserve context, but not enough to turn the effort into a simple negative read."
        : classification.label === "Stable Growth"
          ? "You established a controlled baseline for future comparison."
          : classification.reasons[0]?.text || "The graph produced a readable pattern from the available sessions.";

    achievements.push({
      id: "primary-pattern",
      title: classification.label === "Contextual Decline" ? "Contextual pattern" : classification.label === "Stable Growth" ? "Stable structure" : "Primary progress pattern",
      detail: fallbackDetail,
      strength: 0.5,
      labelImpact: "supports",
      markerKinds: classification.reasons.map((reason) => reason.kind),
    });
  }

  return achievements.sort((a, b) => {
    const impactRank = { carries: 3, promotes: 2, supports: 1 };
    return impactRank[b.labelImpact] - impactRank[a.labelImpact] || b.strength - a.strength;
  }).slice(0, 4);
};

// ===== AI SUMMARY INTERPRETED ACHIEVEMENTS =====

const getAISummaryImpactRank = (impact: "supports" | "promotes" | "carries") => {
  if (impact === "carries") return 3;
  if (impact === "promotes") return 2;
  return 1;
};

const isAISummaryTrueConsistencyCheck = (scorecard: AISummaryScorecard) => {
  const bestOutputProfile = getAISummaryBestOutputProfile(scorecard);
  const hasLittleOutputMovement = Math.abs(scorecard.outputDeltaAverage) < 0.25;
  const hasTightRange = scorecard.outputRangeAverage <= 0.75;
  const hasNoMeaningfulWeightProgression = scorecard.totalWeightIncreaseCount === 0;
  const hasNoStructuralRebound = !scorecard.hasRebound && !scorecard.hasExplosiveJump;
  const singleLowMovement =
    scorecard.mode === "single" &&
    bestOutputProfile != null &&
    Math.abs(bestOutputProfile.outputDelta) < 0.25 &&
    bestOutputProfile.outputRange <= 0.75 &&
    hasNoMeaningfulWeightProgression &&
    hasNoStructuralRebound;

  return (hasLittleOutputMovement && hasTightRange && hasNoMeaningfulWeightProgression && hasNoStructuralRebound) || singleLowMovement;
};

const getAISummaryControlledProgressionProfile = (scorecard: AISummaryScorecard) => {
  const bestOutputProfile = getAISummaryBestOutputProfile(scorecard);
  if (!bestOutputProfile) return null;

  const hasGradualPositiveDrift = bestOutputProfile.outputDelta > 0 && bestOutputProfile.outputRange <= Math.max(2.5, Math.abs(bestOutputProfile.outputDelta) + 1.5);
  const hasUsefulRebound = scorecard.hasRebound && bestOutputProfile.outputDelta >= 0;
  const hasStableWeightProgression = scorecard.hasRetainedOutputUnderWeight || (scorecard.totalWeightIncreaseCount > 0 && bestOutputProfile.isFlatOrControlled);

  return hasGradualPositiveDrift || hasUsefulRebound || hasStableWeightProgression ? bestOutputProfile : null;
};


const normalizeAISummaryConstraintTag = (tag: string) => tag.replace(/\./g, "").toUpperCase();

const getAISummaryConstraintTags = (scorecard: AISummaryScorecard) =>
  getAISummaryUniqueValues(scorecard.constraintTags.map(normalizeAISummaryConstraintTag));

const formatAISummaryConstraintTagList = (tags: string[]) => {
  const uniqueTags = getAISummaryUniqueValues(tags.map(normalizeAISummaryConstraintTag));
  if (!uniqueTags.length) return "constraint";
  if (uniqueTags.length === 1) return uniqueTags[0];
  if (uniqueTags.length === 2) return `${uniqueTags[0]} and ${uniqueTags[1]}`;
  return `${uniqueTags.slice(0, -1).join(", ")}, and ${uniqueTags[uniqueTags.length - 1]}`;
};

const formatAISummaryCompactConstraintTagList = (tags: string[]) => {
  const uniqueTags = getAISummaryUniqueValues(tags.map(normalizeAISummaryConstraintTag));
  if (!uniqueTags.length) return "constraint";
  if (uniqueTags.length === 1) return uniqueTags[0];
  return uniqueTags.join(" + ");
};

const getAISummaryConstraintArticle = (constraintText: string) => /^ECC\b/i.test(constraintText.trim()) ? "an" : "a";

const getAISummaryConstraintOccurrenceCount = (scorecard: AISummaryScorecard) => {
  const tags = getAISummaryConstraintTags(scorecard);
  if (!tags.length) return 0;

  return scorecard.seriesProfiles.reduce((count, profile) => {
    const names = [profile.exerciseName, ...profile.exerciseNameVariants].join(" ").toUpperCase();
    return count + (tags.some((tag) => names.includes(tag)) ? 1 : 0);
  }, 0);
};

const getAISummaryConstraintPhrase = (scorecard: AISummaryScorecard) => {
  if (!scorecard.hasConstraints) return "";
  const occurrenceCount = getAISummaryConstraintOccurrenceCount(scorecard);
  const tags = getAISummaryConstraintTags(scorecard);
  const tagText = formatAISummaryConstraintTagList(tags);
  const compactTagText = formatAISummaryCompactConstraintTagList(tags);

  if (occurrenceCount >= 2) {
    return tags.length > 1
      ? `under ${compactTagText} constraints`
      : `under double ${tagText} constraints`;
  }

  return `under ${getAISummaryConstraintArticle(tagText)} ${tagText} constraint`;
};

const getAISummaryWorkingWithConstraintPhrase = (scorecard: AISummaryScorecard) => {
  if (!scorecard.hasConstraints) return "";
  const occurrenceCount = getAISummaryConstraintOccurrenceCount(scorecard);
  const tags = getAISummaryConstraintTags(scorecard);
  const tagText = formatAISummaryConstraintTagList(tags);
  const compactTagText = formatAISummaryCompactConstraintTagList(tags);

  if (occurrenceCount >= 2) {
    return tags.length > 1
      ? `while working with ${compactTagText} constraints`
      : `while working with double ${tagText} constraints`;
  }

  return `while working with ${getAISummaryConstraintArticle(tagText)} ${tagText} constraint`;
};

const getAISummaryOutputMetricLabel = (profile: AISummarySeriesProfile | null | undefined) => {
  if (!profile?.points.length) return "";
  const lastPoint = profile.points[profile.points.length - 1];
  const rawMetric = String(lastPoint.metric || "").trim();
  const rawTarget = String(lastPoint.target || "").trim();
  const combined = `${rawMetric} ${rawTarget}`.toLowerCase();

  if (/calorie/.test(combined)) return "calories";
  if (/lap/.test(combined)) return "laps";
  if (/yard/.test(combined)) return "yards";
  if (/rep/.test(combined)) return "reps";
  if (lastPoint.blockType === "paired") return "sets";
  return rawMetric && rawMetric !== "output" ? rawMetric : "";
};

const formatAISummaryDeltaWithMetric = (value: number, profile?: AISummarySeriesProfile | null) => {
  const metric = getAISummaryOutputMetricLabel(profile);
  return `${formatAISummaryNumber(value)}${metric ? ` ${metric}` : ""}`;
};

const hasAISummaryLargeRelativeGain = (profile: AISummarySeriesProfile | null | undefined) => {
  if (!profile || Math.abs(profile.startOutput) < 0.1) return false;
  return profile.endOutput >= profile.startOutput * 1.65 || profile.peakOutput >= profile.startOutput * 1.85;
};

const isAISummaryWeightedConditioningProfile = (profile: AISummarySeriesProfile | null | undefined) => {
  if (!profile?.points.length) return false;
  const metricText = `${profile.points.map((point) => `${point.target} ${point.metric}`).join(" ")}`.toLowerCase();
  const isConditioningMetric = /calorie|lap|yard|carry|rower|bike|run|walk|slam/.test(metricText) || profile.points.some((point) => point.blockType === "single");
  return isConditioningMetric && profile.totalWeightIncrease > 0;
};

const hasAISummarySignificantWeightGain = (profile: AISummarySeriesProfile | null | undefined) => {
  if (!profile) return false;
  const first = profile.numericWeights[0];
  if (first == null) return false;
  return profile.totalWeightIncrease >= Math.max(7.5, Math.abs(first) * 0.25);
};

const pushAISummaryInterpretation = (
  interpreted: AISummaryInterpretedAchievement[],
  item: AISummaryInterpretedAchievement
) => {
  const alreadyHasKind = interpreted.some((existing) => existing.kind === item.kind);
  if (!alreadyHasKind) interpreted.push(item);
};

const hasAISummarySustainedPerformancePattern = (scorecard: AISummaryScorecard, profile?: AISummarySeriesProfile | null) => {
  const target = profile || getAISummaryBestOutputProfile(scorecard);
  if (!target || target.points.length < 4) return false;

  const toleratedFloor = target.startOutput - 0.25;
  const belowBaselineCount = target.points.filter((point) => point.y < toleratedFloor).length;
  const finishesPositive = target.outputDelta > 0.75;
  const hasDemandProgression = target.totalWeightIncrease > 0 || scorecard.totalWeightIncreaseCount > 0;
  const outputValues = target.points.map((point) => point.y);
  const maxStepRegression = outputValues.reduce((largestDrop, value, index) => {
    if (index === 0) return largestDrop;
    return Math.max(largestDrop, outputValues[index - 1] - value);
  }, 0);
  const givebackFromPeak = target.peakOutput - target.endOutput;
  const noMeaningfulGiveback = maxStepRegression <= 0.75 && givebackFromPeak <= 0.75;
  const structureStayedIntact = belowBaselineCount <= 1 && target.endOutput >= target.startOutput;

  return finishesPositive && hasDemandProgression && structureStayedIntact && noMeaningfulGiveback && !scorecard.hasLateDip && !scorecard.hasRebound;
};

const hasAISummaryTightBaselineRange = (profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 3) return false;
  const stayedAheadOfBaseline = profile.lowOutput >= profile.startOutput - 0.25 && profile.endOutput >= profile.startOutput;
  const tightWorkRange = profile.outputRange <= Math.max(1.25, Math.abs(profile.outputDelta) + 0.75);
  const notTrajectoryDriven = profile.outputDelta <= Math.max(1.25, profile.outputRange * 0.75);
  return stayedAheadOfBaseline && tightWorkRange && notTrajectoryDriven;
};

const hasAISummaryRecoveredHiccup = (profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 5 || !profile.endsAtPeak || profile.outputDelta <= 0.75) return false;

  const values = profile.points.map((point) => point.y);
  const meaningfulDrop = Math.max(2, profile.outputRange * 0.45);

  for (let index = 1; index < values.length - 1; index += 1) {
    const previous = values[index - 1];
    const current = values[index];
    const next = values[index + 1];
    const singlePointDrop = previous - current >= meaningfulDrop && next - current >= meaningfulDrop * 0.75;
    const recoveredPastPrevious = next >= previous || profile.endOutput >= profile.peakOutput - 0.25;

    if (singlePointDrop && recoveredPastPrevious && current < profile.startOutput - 0.5) return true;
  }

  return false;
};

const hasAISummaryEscalatingConstrainedProgression = (scorecard: AISummaryScorecard, profile?: AISummarySeriesProfile | null) => {
  if (!profile || !scorecard.hasConstraints || profile.startOutput <= 0) return false;
  const nearDouble = profile.endOutput >= profile.startOutput * 1.45 && profile.endOutput <= profile.startOutput * 2.1;
  const meaningfulRise = profile.outputDelta >= Math.max(1.5, profile.startOutput * 0.45);
  const demandPresent = scorecard.totalWeightIncreaseCount > 0 || scorecard.hasRetainedOutputUnderWeight;
  return nearDouble && meaningfulRise && demandPresent;
};

const hasAISummaryDominantBaselineSeparation = (profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.startOutput <= 0 || profile.points.length < 5) return false;

  const values = profile.points.map((point) => point.y).filter((value) => Number.isFinite(value));
  if (values.length < 5) return false;

  const start = values[0];
  const minimumBreakoutGain = Math.max(2, Math.abs(start) * 0.45);
  const allowableEarlyDip = Math.max(0.5, Math.abs(start) * 0.15);
  const retainedFloor = start + minimumBreakoutGain * 0.7;
  const maxPostBreakoutEscalation = Math.max(1, Math.abs(start) * 0.25);

  for (let index = 1; index <= values.length - 3; index += 1) {
    const priorValues = values.slice(0, index);
    const priorHadRecoveryDip = priorValues.some((value) => value < start - allowableEarlyDip);
    if (priorHadRecoveryDip) continue;

    const comparisonWindow = priorValues.slice(-3);
    const comparisonAverage = comparisonWindow.length
      ? comparisonWindow.reduce((sum, value) => sum + value, 0) / comparisonWindow.length
      : start;

    const breakoutFromStart = values[index] - start;
    const breakoutFromRecentStructure = values[index] - comparisonAverage;
    const compressedBreakout = index <= 2 || breakoutFromRecentStructure >= Math.max(1.5, Math.abs(start) * 0.3);
    const retainedWindow = values.slice(index, index + 3);
    const retainedElevation = retainedWindow.length >= 3 && retainedWindow.every((value) => value >= retainedFloor);
    const afterRetainedWindow = values.slice(index + 3);
    const keepsEscalatingAfterBreakout = afterRetainedWindow.some((value) => value - values[index] > maxPostBreakoutEscalation);

    if (breakoutFromStart >= minimumBreakoutGain && compressedBreakout && retainedElevation && !keepsEscalatingAfterBreakout) {
      return true;
    }
  }

  return false;
};

const hasAISummaryPreservedVolatility = (scorecard: AISummaryScorecard, profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 6) return false;
  if (profile.outputRange < 1) return false;

  const start = profile.startOutput;
  const end = profile.endOutput;
  const retainedFloor = start - Math.max(0.75, Math.abs(start) * 0.25);
  const collapsed = profile.lowOutput < retainedFloor;
  const finishedNearStructure = end >= retainedFloor;
  const demandProgressed = scorecard.totalWeightIncreaseCount > 0 || profile.hasWeightProgression;
  const notClearDecline = profile.outputDelta >= -Math.max(0.75, profile.outputRange * 0.35);
  const isMostlyFlatStructure = profile.isFlatOrControlled && profile.outputRange <= Math.max(1.25, Math.abs(profile.outputDelta) + 0.75);

  return demandProgressed && !collapsed && finishedNearStructure && notClearDecline && !isMostlyFlatStructure;
};

const hasAISummarySharedOutputLevel = (scorecard: AISummaryScorecard, tolerance = 0.35) => {
  if (scorecard.seriesProfiles.length < 2) return false;
  const endValues = scorecard.seriesProfiles.map((profile) => profile.endOutput);
  const highestEnd = Math.max(...endValues);
  const lowestEnd = Math.min(...endValues);
  return highestEnd - lowestEnd <= tolerance;
};

const hasAISummaryStrongOutputFloor = (scorecard: AISummaryScorecard, profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 4) return false;
  const retainedBaseline = profile.lowOutput >= profile.startOutput - 0.5;
  const controlledRange = profile.outputRange <= Math.max(1.5, Math.abs(profile.outputDelta) + 1);
  const finishHeld = profile.endOutput >= profile.startOutput - 0.25;
  const sharedLevel = hasAISummarySharedOutputLevel(scorecard);
  const settledFromAbove = profile.startOutput > profile.endOutput + 0.25 || profile.peakOutput > profile.endOutput + 0.75;
  return sharedLevel && retainedBaseline && controlledRange && finishHeld && settledFromAbove;
};

const hasAISummaryStrongOutputCeiling = (scorecard: AISummaryScorecard, profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 4) return false;
  const sharedLevel = hasAISummarySharedOutputLevel(scorecard);
  const reachedFromBelow = profile.endOutput >= profile.startOutput + 0.25 || profile.peakOutput >= profile.startOutput + 0.75;
  const heldNearPeak = profile.endOutput >= profile.peakOutput - 0.75;
  const dominantStableCeiling = profile.lowOutput >= profile.peakOutput - 1 && profile.endOutput >= profile.peakOutput - 0.5 && profile.hasWeightProgression;
  return (sharedLevel && reachedFromBelow && heldNearPeak) || dominantStableCeiling;
};

const getAISummaryWorkRangeTier = (scorecard: AISummaryScorecard, profile?: AISummarySeriesProfile | null) => {
  if (!profile) return "solid work range";
  const weightMomentum = scorecard.maxConsecutiveWeightIncreaseCount >= 3 || scorecard.totalWeightIncreaseCount >= 5;
  const strongConstraintContext = scorecard.hasConstraints && scorecard.totalWeightIncreaseCount >= 3;
  const highRetention = profile.lowOutput >= profile.startOutput - 0.5 && profile.endOutput >= profile.startOutput - 0.25;

  if (highRetention && (weightMomentum || strongConstraintContext)) return "pronounced work range";
  if (highRetention || scorecard.totalWeightIncreaseCount >= 3) return "pronounced work range";
  return "solid work range";
};

const hasAISummaryVisibleFluctuation = (profile?: AISummarySeriesProfile | null) =>
  !!profile && profile.outputRange > Math.max(0.5, Math.abs(profile.outputDelta) + 0.25);

const hasAISummaryDominantConsistentOutputProfile = (profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 5 || !profile.hasWeightProgression) return false;
  const values = profile.points.map((point) => point.y);
  const counts = values.reduce<Record<string, number>>((map, value) => {
    const key = String(value);
    map[key] = (map[key] || 0) + 1;
    return map;
  }, {});
  const dominantCount = Math.max(...Object.values(counts));
  const offDominantCount = values.length - dominantCount;
  const dominantLevel = Number(Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]);
  const meaningfulDeviationCount = values.filter((value) => Math.abs(value - dominantLevel) >= 0.75).length;

  return dominantCount >= values.length - 1 && offDominantCount <= 1 && meaningfulDeviationCount <= 1 && profile.totalWeightIncrease > 0;
};

const hasAISummaryStrictSustainedProfile = (profile?: AISummarySeriesProfile | null) => {
  if (!profile || profile.points.length < 5) return false;
  const values = profile.points.map((point) => point.y);
  const maxStepDrop = values.reduce((largestDrop, value, index) => {
    if (index === 0) return largestDrop;
    return Math.max(largestDrop, values[index - 1] - value);
  }, 0);
  return maxStepDrop <= 0.25 && profile.lowOutput >= profile.startOutput - 0.25 && profile.endOutput >= profile.startOutput - 0.25;
};

const hasAISummarySustainedAnchor = (scorecard: AISummaryScorecard) =>
  scorecard.seriesProfiles.some((profile) => hasAISummaryStrictSustainedProfile(profile) && (profile.hasWeightProgression || scorecard.totalWeightIncreaseCount > 0));

const getAISummaryDisciplineScore = (scorecard: AISummaryScorecard) => {
  let score = 0;
  if (scorecard.hasRetainedOutputUnderWeight) score += 2;
  if (scorecard.hasConstraints) score += 1;
  if (scorecard.constraintTags.length > 1) score += 1;
  if (scorecard.totalWeightIncreaseCount >= 3) score += 1;
  if (scorecard.maxConsecutiveWeightIncreaseCount >= 3) score += 1;
  if (scorecard.maxConsecutiveWeightIncreaseCount >= 5) score += 1;
  if (hasAISummarySustainedAnchor(scorecard)) score += 2;
  if (!scorecard.hasLateDip || scorecard.hasRebound) score += 1;
  return score;
};

const shouldUseAISummaryDemandDisciplinePayoff = (scorecard: AISummaryScorecard, force = false) =>
  force || getAISummaryDisciplineScore(scorecard) >= 5;

const getAISummaryDemandDisciplinePayoff = (scorecard: AISummaryScorecard, variant: "workflow" | "discipline" = "workflow", force = false) => {
  if (!shouldUseAISummaryDemandDisciplinePayoff(scorecard, force)) return "";
  if (variant === "discipline") return "This type of discipline is what drives long-term progress.";
  if (scorecard.hasConstraints) return "That level of structure under rising demand reflects excellent discipline.";
  return "This style of workflow defines a great workout.";
};

const joinAISummarySentences = (...sentences: string[]) =>
  sentences.map((sentence) => sentence.trim()).filter(Boolean).join(" ");

const getAISummaryImpactfulWeightProgression = (scorecard: AISummaryScorecard) => {
  const largestGain = scorecard.seriesProfiles.reduce((largest, profile) => Math.max(largest, profile.totalWeightIncrease), 0);
  const largestRelativeGain = scorecard.seriesProfiles.reduce((largest, profile) => {
    const firstWeight = profile.numericWeights[0];
    if (!firstWeight || firstWeight <= 0) return largest;
    return Math.max(largest, profile.totalWeightIncrease / firstWeight);
  }, 0);

  return largestGain >= 10 || largestRelativeGain >= 0.45;
};

const getAISummarySubstantialWeightProgression = (scorecard: AISummaryScorecard) => {
  const largestGain = scorecard.seriesProfiles.reduce((largest, profile) => Math.max(largest, profile.totalWeightIncrease), 0);
  const largestRelativeGain = scorecard.seriesProfiles.reduce((largest, profile) => {
    const firstWeight = profile.numericWeights[0];
    if (!firstWeight || firstWeight <= 0) return largest;
    return Math.max(largest, profile.totalWeightIncrease / firstWeight);
  }, 0);

  return largestGain >= 16 || largestRelativeGain >= 0.75;
};

const getAISummaryProgressionPhrase = (scorecard: AISummaryScorecard, _context: "range" | "ceiling" | "default" = "default") => {
  const hasConsecutiveRun = scorecard.maxConsecutiveWeightIncreaseCount >= 3;
  const hasImpactfulProgression = getAISummaryImpactfulWeightProgression(scorecard);
  const hasSubstantialProgression = getAISummarySubstantialWeightProgression(scorecard);

  if (hasConsecutiveRun && hasSubstantialProgression) return "multiple substantial weight increases";
  if (hasConsecutiveRun && hasImpactfulProgression) return "consecutive and impactful weight increases";
  if (hasConsecutiveRun) return "consecutive weight increases";
  if (hasImpactfulProgression && scorecard.totalWeightIncreaseCount >= 2) return "multiple impactful weight increases";
  if (scorecard.totalWeightIncreaseCount >= 3) return "multiple weight increases";
  return "weight increases";
};

const getAISummaryConstraintPayoffSentence = (scorecard: AISummaryScorecard, preferredNoun = "performance") => {
  if (!scorecard.hasConstraints) return "";
  const tags = getAISummaryConstraintTags(scorecard);
  if (!tags.length) return "";
  const occurrenceCount = getAISummaryConstraintOccurrenceCount(scorecard);
  const compact = occurrenceCount >= 2
    ? tags.length > 1
      ? `${formatAISummaryCompactConstraintTagList(tags)} constraints`
      : `double ${formatAISummaryConstraintTagList(tags)} constraints`
    : `${getAISummaryConstraintArticle(formatAISummaryConstraintTagList(tags))} ${formatAISummaryConstraintTagList(tags)} constraint`;
  const prefix = "Performing";
  return `${prefix} at that level under ${compact} is what makes this ${preferredNoun} stand out.`;
};


type AISummaryInterpretationContext = {
  interpreted: AISummaryInterpretedAchievement[];
  bestWeightProfile?: AISummarySeriesProfile | null;
  bestOutputProfile?: AISummarySeriesProfile | null;
  controlledProgressionProfile?: AISummarySeriesProfile | null;
  constraintPhrase: string;
  constraintSuffix: string;
  workingWithConstraintSuffix: string;
  trueConsistencyCheck: boolean;
  blockNoun: string;
  bestProfile?: AISummarySeriesProfile | null;
  weightedConditioning: boolean;
  significantWeightGain: boolean;
  hasExerciseChange: boolean;
  largeRelativeGain: boolean;
  dominantBaselineSeparation: boolean;
  tightBaselineRange: boolean;
  escalatingConstrainedProgression: boolean;
  sustainedPerformance: boolean;
  outlierHiccup: boolean;
  preservedVolatility: boolean;
};

const buildAISummaryModerateInterpretedAchievements = (
  scorecard: AISummaryScorecard,
  context: AISummaryInterpretationContext
) => {
  const {
    interpreted,
    bestWeightProfile,
    bestOutputProfile,
    controlledProgressionProfile,
    constraintPhrase,
    constraintSuffix,
    workingWithConstraintSuffix,
    blockNoun,
    bestProfile,
    weightedConditioning,
    significantWeightGain,
    hasExerciseChange,
    largeRelativeGain,
    tightBaselineRange,
    sustainedPerformance,
    outlierHiccup,
    preservedVolatility,
  } = context;

if (hasExerciseChange && scorecard.hasConstraints && bestProfile?.isFlatOrControlled) {
      pushAISummaryInterpretation(interpreted, {
        kind: "exercise_change_stability",
        title: "Hidden stability through exercise change",
        meaning: "The athlete maintained the baseline despite a mid-program exercise change and constraint demand.",
        summarySentence: `Despite a mid-program exercise change, you maintained your output range ${constraintPhrase || "under constraint"}.`,
        strength: 0.88,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["constraint_present", "output_plateau"],
      });
    }

    if (outlierHiccup && bestOutputProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "outlier_hiccup",
        title: "Outlier hiccup with strong finish",
        meaning: "One outlier did not change the overall growth identity of the block.",
        summarySentence: `Despite a hiccup, you performed well here. With a gradual upward trend, you finished at your peak, beyond where you started.`,
        strength: 0.83,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["late_dip", "strong_finish", "output_rise"],
      });
    }

    if (scorecard.mode === "single" && getAISummaryOutputMetricLabel(bestOutputProfile) === "laps" && controlledProgressionProfile && controlledProgressionProfile.outputDelta > 0) {
      pushAISummaryInterpretation(interpreted, {
        kind: "controlled_progression",
        title: "Controlled upward progression",
        meaning: "The conditioning output stayed compressed by the short time window while still moving upward.",
        summarySentence: hasAISummaryVisibleFluctuation(controlledProgressionProfile)
          ? `Despite minor fluctuation, the overall trend moved gradually upward and finished at the highest point of the block.`
          : `The overall trend moved gradually upward and finished at the highest point of the block.`,
        strength: 0.82,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["output_rise", "strong_finish"],
      });
    }

    if (scorecard.hasConstraints && significantWeightGain && hasAISummaryDominantConsistentOutputProfile(bestWeightProfile)) {
      pushAISummaryInterpretation(interpreted, {
        kind: "consistent_output_progression",
        title: "Consistent output under rising demand",
        meaning: "The athlete held a dominant output level while weight progression became the main source of added demand.",
        summarySentence: `You maintained consistent output while making substantial weight increases.`,
        strength: 0.89,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["retained_output_under_weight", "weight_progression", "output_plateau"],
      });
    }

    if (scorecard.hasConstraints && scorecard.totalWeightIncreaseCount >= 3 && bestOutputProfile?.isFlatOrControlled) {
      pushAISummaryInterpretation(interpreted, {
        kind: "constraint_work_area",
        title: "Solid work area under constraint",
        meaning: "The athlete preserved a controlled work area while moving through multiple weight increases under constraint demand.",
        summarySentence: joinAISummarySentences(
          `You maintained a consistent work area ${constraintPhrase || "under constraint"} and ${getAISummaryProgressionPhrase(scorecard, "range")}.`,
          getAISummaryDemandDisciplinePayoff(scorecard, "discipline")
        ),
        strength: 0.86,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["constraint_present", "weight_progression", "output_plateau"],
      });
    }

    if (sustainedPerformance && bestOutputProfile && bestWeightProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "sustained_performance",
        title: "Sustained performance",
        meaning: "The athlete sustained the output structure while demand increased instead of giving ground back.",
        summarySentence: joinAISummarySentences(
          `You established a sustained progression pattern and managed it through continual weight increases.`,
          getAISummaryDemandDisciplinePayoff(scorecard, "discipline", true)
        ),
        strength: 0.84,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["retained_output_under_weight", "weight_progression", "output_rise"],
      });
    }

    if (scorecard.hasRetainedOutputUnderWeight && scorecard.hasConstraints && bestWeightProfile?.isFlatOrControlled) {
      pushAISummaryInterpretation(interpreted, {
        kind: "constraint_floor",
        title: "Workable floor under constraint",
        meaning: "The athlete maintained a usable output floor while the constraint and weight demand increased.",
        summarySentence: joinAISummarySentences(
          `You maintained a ${getAISummaryWorkRangeTier(scorecard, bestOutputProfile)}${workingWithConstraintSuffix || constraintSuffix} and ${getAISummaryProgressionPhrase(scorecard, "range")}.`,
          getAISummaryDemandDisciplinePayoff(scorecard, "discipline")
        ),
        strength: 0.86,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["retained_output_under_weight", "weight_progression", "constraint_present"],
      });
    }

    if (preservedVolatility && bestWeightProfile && !scorecard.hasConstraints) {
      pushAISummaryInterpretation(interpreted, {
        kind: "preserved_volatility",
        title: "Preserved structure through volatility",
        meaning: "The block moved through volatility without losing its working structure while weight gradually increased.",
        summarySentence: `You established a pronounced work range while making ${getAISummaryProgressionPhrase(scorecard, "range")}.`,
        strength: 0.83,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["output_volatility", "weight_progression"],
      });
    }

    if (weightedConditioning && bestWeightProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "weighted_conditioning",
        title: "Weighted conditioning progress",
        meaning: "Adding weight while preserving conditioning-style output carries extra value.",
        summarySentence: preservedVolatility
          ? `Moving through volatility while progressing upward in weight during cardio is what defines this performance.`
          : `This is a cardio-plus-weight read: progressing upward in weight while preserving conditioning output gives the exercise more value than the output line alone shows.`,
        strength: 0.87,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["weight_progression", "retained_output_under_weight"],
      });
    }

    if (!scorecard.hasConstraints && scorecard.hasRetainedOutputUnderWeight && significantWeightGain && bestOutputProfile?.isFlatOrControlled) {
      const floorDominant = hasAISummaryStrongOutputFloor(scorecard, bestOutputProfile);
      const ceilingDominant = hasAISummaryStrongOutputCeiling(scorecard, bestOutputProfile);
      pushAISummaryInterpretation(interpreted, {
        kind: floorDominant ? "strong_output_floor" : ceilingDominant ? "strong_output_ceiling" : "controlled_workflow",
        title: floorDominant ? "Strong output floor" : ceilingDominant ? "Strong output ceiling" : "Controlled work range",
        meaning: floorDominant
          ? "The athlete established a workable output floor and sustained it while weight progressed."
          : ceilingDominant
            ? "The athlete established a strong output ceiling and held it while weight progressed."
            : "The athlete maintained a useful work range while demand progressed.",
        summarySentence: floorDominant
          ? `You established a workable floor and sustained it through ${getAISummaryProgressionPhrase(scorecard, "range")}.`
          : ceilingDominant
            ? `You established a strong ceiling and sustained it through ${getAISummaryProgressionPhrase(scorecard, "ceiling")}.`
            : `You maintained consistent output through ${getAISummaryProgressionPhrase(scorecard, "range")}.`,
        strength: 0.84,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["retained_output_under_weight", "weight_progression", "output_plateau"],
      });
    }

    if (significantWeightGain && bestWeightProfile && !weightedConditioning && !interpreted.some((item) => item.kind === "consistent_output_progression")) {
      pushAISummaryInterpretation(interpreted, {
        kind: "substantial_weight_gain",
        title: "Substantial weight increases",
        meaning: "The weight progression was substantial enough to shape how the graph should be read.",
        summarySentence: scorecard.hasConstraints
          ? joinAISummarySentences(
              `You carved out a strong work area while making substantial weight increases.`,
              getAISummaryConstraintPayoffSentence(scorecard, "performance") || `Retaining that structure as demand rose is what makes this performance stand out.`
            )
          : scorecard.maxConsecutiveWeightIncreaseCount >= 5
            ? joinAISummarySentences(
                `You maintained a ${getAISummaryWorkRangeTier(scorecard, bestOutputProfile)} through ${getAISummaryProgressionPhrase(scorecard, "range")}.`,
                getAISummaryDemandDisciplinePayoff(scorecard)
              )
            : `You maintained consistent output with ${scorecard.maxConsecutiveWeightIncreaseCount >= 3 ? getAISummaryProgressionPhrase(scorecard, "range") : significantWeightGain ? "impactful weight increases" : "meaningful weight increases"}. That demand increase gives the ${blockNoun} more value than the output line alone shows.`,
        strength: 0.78,
        labelImpact: "supports",
        evidenceMarkerKinds: ["weight_progression", "retained_output_under_weight"],
      });
    }

    if (scorecard.hasExplosiveJump && bestOutputProfile && !largeRelativeGain) {
      pushAISummaryInterpretation(interpreted, {
        kind: "elevated_floor",
        title: "Elevated floor established",
        meaning: "The athlete established a higher working range early and maintained it.",
        summarySentence: `You established a higher working range early and maintained it through the rest of the ${blockNoun}.`,
        strength: 0.78,
        labelImpact: "promotes",
        evidenceMarkerKinds: ["explosive_jump", "output_plateau"],
      });
    }

    if (!interpreted.length && scorecard.hasRetainedOutputUnderWeight && bestWeightProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "controlled_workflow",
        title: "Solid workflow",
        meaning: "The athlete established a stable working range and maintained it while demand rose.",
        summarySentence: scorecard.totalWeightIncreaseCount <= 1
          ? `You established a stable output structure early and managed it while moving up in weight.`
          : joinAISummarySentences(
              `You established a consistent workflow and managed it through multiple weight increases.`,
              getAISummaryDemandDisciplinePayoff(scorecard, "discipline")
            ),
        strength: 0.74,
        labelImpact: "supports",
        evidenceMarkerKinds: ["retained_output_under_weight", "weight_progression"],
      });
    }

    if (!interpreted.length && scorecard.hasConstraints && bestOutputProfile?.isFlatOrControlled) {
      pushAISummaryInterpretation(interpreted, {
        kind: "constraint_floor",
        title: "Solid output range under constraint",
        meaning: "The athlete maintained a controlled working range while handling constraint demand.",
        summarySentence: `Under ${getAISummaryConstraintTags(scorecard).length > 1 ? `${formatAISummaryCompactConstraintTagList(getAISummaryConstraintTags(scorecard))} constraints` : `${getAISummaryConstraintArticle(formatAISummaryConstraintTagList(getAISummaryConstraintTags(scorecard)))} ${formatAISummaryConstraintTagList(getAISummaryConstraintTags(scorecard))} constraint`}, you maintained a solid output range throughout the program. Great work.`,
        strength: 0.73,
        labelImpact: "supports",
        evidenceMarkerKinds: ["constraint_present", "output_plateau"],
      });
    }

    if (!interpreted.length && tightBaselineRange) {
      pushAISummaryInterpretation(interpreted, {
        kind: "tight_baseline_range",
        title: "Tight range above baseline",
        meaning: "The athlete managed a tight range of work while staying ahead of the starting baseline.",
        summarySentence: `You managed a tight range of work while staying ahead of your baseline.`,
        strength: 0.72,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_plateau", "output_rise"],
      });
    }

    if (!interpreted.length && controlledProgressionProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "controlled_progression",
        title: "Controlled upward progression",
        meaning: "The graph stayed controlled while gradually moving in a positive direction.",
        summarySentence: bestOutputProfile?.endsAtPeak
          ? `With a gradual upward trend, you finished at your peak, beyond where you started.`
          : `With a gradual upward trend, you finished beyond where you started.`,
        strength: 0.7,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_rise", "output_plateau"],
      });
    }

    if (hasExerciseChange && !interpreted.some((item) => item.kind === "exercise_change_stability" || item.kind === "exercise_change_context")) {
      pushAISummaryInterpretation(interpreted, {
        kind: "exercise_change_context",
        title: "Mid-program exercise change",
        meaning: "The athlete kept the output range intact despite an exercise replacement mid-program.",
        summarySentence: "Despite a mid-program exercise change, you maintained your output range.",
        strength: 0.81,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_plateau"],
      });
    }
};

const buildAISummaryExceptionalInterpretedAchievements = (
  scorecard: AISummaryScorecard,
  context: AISummaryInterpretationContext
) => {
  const {
    interpreted,
    bestWeightProfile,
    bestOutputProfile,
    constraintPhrase,
    constraintSuffix,
    blockNoun,
    largeRelativeGain,
    dominantBaselineSeparation,
    escalatingConstrainedProgression,
    significantWeightGain,
  } = context;

if (scorecard.mode !== "single" && escalatingConstrainedProgression && bestOutputProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "escalating_constrained_progression",
        title: "Escalating constrained progression",
        meaning: "The athlete kept upward pressure on the block while demand increased under constraint conditions.",
        summarySentence: `Your upward trajectory did not let up this program, nearly doubling your total output from your baseline at higher demands. Results like this, especially ${constraintPhrase || "under constraint"}, reflect textbook elite-tier progress.`,
        strength: 0.995,
        labelImpact: "carries",
        evidenceMarkerKinds: ["output_rise", "weight_progression", "constraint_present"],
      });
    } else if (scorecard.hasExplosiveJump && scorecard.hasConstraints && scorecard.hasRetainedOutputUnderWeight && bestOutputProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "explosive_constrained_progression",
        title: "Explosive constrained progression",
        meaning: "The block accelerated under constraint demand and held the higher structure while weight continued rising.",
        summarySentence: `Explosive upward progression${constraintSuffix || " under constraint"} is extremely rare, and the higher output structure held while continuing upward in weight.`,
        strength: 0.985,
        labelImpact: "carries",
        evidenceMarkerKinds: ["explosive_jump", "constraint_present", "weight_progression"],
      });
    } else if (largeRelativeGain && dominantBaselineSeparation && bestOutputProfile) {
      pushAISummaryInterpretation(interpreted, {
        kind: "dominant_baseline_separation",
        title: "Dominant baseline separation",
        meaning: "The athlete created immediate distance from the starting baseline and kept operating from that higher level.",
        summarySentence: hasAISummaryLargeRelativeGain(bestOutputProfile) && bestOutputProfile.endOutput < bestOutputProfile.startOutput * 2 && bestOutputProfile.endOutput >= bestOutputProfile.startOutput * 1.65
          ? `Your upward trajectory did not let up this program, nearly doubling your total output from your baseline. This kind of progression${constraintSuffix ? `, especially ${constraintPhrase},` : ""} is textbook elite-tier progress.`
          : `You created major separation from your starting baseline and never let up. Doubling your output${scorecard.totalWeightIncreaseCount > 0 ? ` while handling ${significantWeightGain ? "significant weight increases" : "more weight"}` : ""} reflects textbook elite-tier progress.`,
        strength: 0.99,
        labelImpact: "carries",
        evidenceMarkerKinds: ["explosive_jump", "output_rise", "strong_finish"],
      });
    } else if (scorecard.hasExplosiveJump && bestOutputProfile) {
      const deltaText = formatAISummaryDeltaWithMetric(bestOutputProfile.outputDelta, bestOutputProfile);
      pushAISummaryInterpretation(interpreted, {
        kind: "explosive_continuity",
        title: "Explosive acceleration with retention",
        meaning: "The graph broke away early and continued building without giving the progression back.",
        summarySentence: bestOutputProfile.endsAtPeak
          ? `After an explosive start, you kept climbing until finishing at your highest output of the ${blockNoun}. That is ${deltaText} above where you started and reflects an exceptional progression window.`
          : `After an explosive start, you established a much higher working range and kept the progression alive through the rest of the ${blockNoun}.`,
        strength: 0.97,
        labelImpact: "carries",
        evidenceMarkerKinds: ["explosive_jump", "output_rise"],
      });
    }

    if (scorecard.hasRetainedOutputUnderWeight && bestWeightProfile) {
      const retainedSentence = bestWeightProfile.weightIncreaseCount <= 1 && bestOutputProfile && scorecard.hasConstraints
        ? `You established a higher output ceiling ${constraintPhrase} and sustained it with added weight. Maintaining that elevated level after the jump is a strong sign of progress.`
        : `You maintained the higher output structure while ${bestWeightProfile.weightIncreaseCount >= 3 ? "handling substantial weight increases" : "adding weight"}${constraintSuffix}.`;
      pushAISummaryInterpretation(interpreted, {
        kind: "retained_adaptation",
        title: "Retained adaptation under rising demand",
        meaning: "The athlete maintained output while demand continued rising.",
        summarySentence: retainedSentence,
        strength: 0.94,
        labelImpact: interpreted.length ? "promotes" : "carries",
        evidenceMarkerKinds: ["retained_output_under_weight", "weight_progression", "constraint_present"],
      });
    }

    if (!interpreted.length && scorecard.mode === "single" && bestOutputProfile && bestOutputProfile.outputDelta > 0) {
      const deltaText = formatAISummaryDeltaWithMetric(bestOutputProfile.outputDelta, bestOutputProfile);
      const recoveredHiccup = hasAISummaryRecoveredHiccup(bestOutputProfile);
      pushAISummaryInterpretation(interpreted, {
        kind: recoveredHiccup ? "vertical_relaunch_conditioning" : "explosive_conditioning_climb",
        title: recoveredHiccup ? "Vertical relaunch conditioning" : "Explosive conditioning climb",
        meaning: recoveredHiccup
          ? "The exercise recovered from an early disruption, launched into a new range, and closed at its highest output."
          : "The exercise climbed sharply and kept the conditioning trajectory moving through the end of the program.",
        summarySentence: recoveredHiccup && bestOutputProfile.endsAtPeak
          ? `After an early hiccup, you launched into a completely new working range and finished at your highest output. Closing ${deltaText} above where you started reinforces an exceptional conditioning trajectory.`
          : bestOutputProfile.endsAtPeak
            ? `After an explosive jump early in the program, you kept building through the remaining sessions. Finishing ${deltaText} above where you started reflects an exceptional conditioning trajectory.`
            : `You built a much stronger conditioning range and kept the progression moving at a high level.`,
        strength: 0.91,
        labelImpact: "carries",
        evidenceMarkerKinds: ["output_rise", "strong_finish"],
      });
    }

    if (!interpreted.length) {
      pushAISummaryInterpretation(interpreted, {
        kind: "exceptional_fallback",
        title: "High-octane performance window",
        meaning: "The classifier detected an exceptional performance even though the exact story needs broad framing.",
        summarySentence: "Your stand-out moment here really exemplifies high-octane performance. You kept this progression moving at a very high level.",
        strength: 0.88,
        labelImpact: "carries",
        evidenceMarkerKinds: scorecard.markers.map((reason: AISummaryMarker) => reason.kind),
      });
    }
};

const buildAISummaryStableInterpretedAchievements = (
  scorecard: AISummaryScorecard,
  context: AISummaryInterpretationContext
) => {
  const {
    interpreted,
    controlledProgressionProfile,
    trueConsistencyCheck,
    bestProfile,
    workingWithConstraintSuffix,
    tightBaselineRange,
  } = context;

if (!trueConsistencyCheck && scorecard.hasConstraints && bestProfile?.isFlatOrControlled) {
      pushAISummaryInterpretation(interpreted, {
        kind: "constraint_floor",
        title: "Stable progress under constraint",
        meaning: "The athlete managed weight and output consistently while working with constraint demand.",
        summarySentence: `You managed weight and output consistently${workingWithConstraintSuffix}, demonstrating stable progress. This is a good foundation to build from.`,
        strength: 0.74,
        labelImpact: "supports",
        evidenceMarkerKinds: ["constraint_present", "output_plateau"],
      });
    }

    if (!interpreted.length && !trueConsistencyCheck && tightBaselineRange) {
      pushAISummaryInterpretation(interpreted, {
        kind: "tight_baseline_range",
        title: "Tight range above baseline",
        meaning: "The athlete managed a tight range of work while staying ahead of the starting baseline.",
        summarySentence: `You managed a tight range of work while staying ahead of your baseline. Good job.`,
        strength: 0.73,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_plateau", "output_rise"],
      });
    }

    if (!interpreted.length && !trueConsistencyCheck && controlledProgressionProfile && controlledProgressionProfile.outputDelta > 0) {
      pushAISummaryInterpretation(interpreted, {
        kind: "controlled_progression",
        title: "Controlled upward drift",
        meaning: "The graph remained stable while gradually trending upward.",
        summarySentence: controlledProgressionProfile.endsAtPeak
          ? `With a gradual upward trend, you finished at your peak, beyond where you started. This is a good foundation to build from.`
          : `With a gradual upward trend, you finished at a stronger point than where you started. This is a good foundation to build from.`,
        strength: 0.72,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_rise", "output_plateau"],
      });
    }

    if (!interpreted.length && scorecard.hasRebound && Math.abs(scorecard.outputDeltaAverage) <= Math.max(1.5, scorecard.outputRangeAverage * 0.4)) {
      pushAISummaryInterpretation(interpreted, {
        kind: "balanced_volatility",
        title: "Balanced volatility",
        meaning: "The baseline and endpoint anchor the volatility between peak and valley.",
        summarySentence: `You stayed connected to your baseline while the block moved through some volatility. This is a good foundation to build from.`,
        strength: 0.68,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_volatility", "rebound"],
      });
    }

    if (!interpreted.length && trueConsistencyCheck) {
      pushAISummaryInterpretation(interpreted, {
        kind: "true_consistency_check",
        title: "True consistency check",
        meaning: "This block was more consistency-focused than progression-focused.",
        summarySentence: "Putting in that work still matters in training. Good job.",
        strength: 0.54,
        labelImpact: "supports",
        evidenceMarkerKinds: ["output_plateau"],
      });
    }
};

const buildAISummaryContextualDeclineInterpretedAchievements = (
  context: AISummaryInterpretationContext
) => {
  const { interpreted } = context;

pushAISummaryInterpretation(interpreted, {
      kind: "contextual_decline",
      title: "Contextual downward drift",
      meaning: "The downward movement is worth reading with context rather than judgment.",
      summarySentence: "The gradual downward trend is worth reading with context. Conditioning-based outputs can fluctuate with recovery, stress, schedule, or outside fatigue, so this type of decline deserves further assessment before drawing a hard conclusion.",
      strength: 0.72,
      labelImpact: "supports",
      evidenceMarkerKinds: ["output_decline"],
    });
};

const buildAISummaryInterpretedAchievements = (
  scorecard: AISummaryScorecard,
  classification: AISummaryClassification,
  achievements: AISummaryAchievement[]
): AISummaryInterpretedAchievement[] => {
  const interpreted: AISummaryInterpretedAchievement[] = [];
  const bestWeightProfile = getAISummaryBestWeightProfile(scorecard);
  const bestOutputProfile = getAISummaryBestOutputProfile(scorecard);
  const controlledProgressionProfile = getAISummaryControlledProgressionProfile(scorecard);
  const constraintPhrase = getAISummaryConstraintPhrase(scorecard);
  const constraintSuffix = constraintPhrase ? ` ${constraintPhrase}` : "";
  const workingWithConstraintPhrase = getAISummaryWorkingWithConstraintPhrase(scorecard);
  const workingWithConstraintSuffix = workingWithConstraintPhrase ? ` ${workingWithConstraintPhrase}` : "";
  const trueConsistencyCheck = isAISummaryTrueConsistencyCheck(scorecard);
  const blockNoun = getAISummaryBlockNoun(scorecard);
  const bestProfile = bestOutputProfile || bestWeightProfile;
  const weightedConditioning = isAISummaryWeightedConditioningProfile(bestWeightProfile) || isAISummaryWeightedConditioningProfile(bestOutputProfile);
  const significantWeightGain = scorecard.seriesProfiles.some(hasAISummarySignificantWeightGain);
  const hasExerciseChange = scorecard.hasExerciseChange;
  const largeRelativeGain = hasAISummaryLargeRelativeGain(bestOutputProfile);
  const dominantBaselineSeparation = hasAISummaryDominantBaselineSeparation(bestOutputProfile);
  const tightBaselineRange = hasAISummaryTightBaselineRange(bestOutputProfile);
  const escalatingConstrainedProgression = hasAISummaryEscalatingConstrainedProgression(scorecard, bestOutputProfile);
  const sustainedPerformance = hasAISummarySustainedPerformancePattern(scorecard, bestOutputProfile);
  const outlierHiccup = hasAISummaryRecoveredHiccup(bestOutputProfile);
  const preservedVolatility = hasAISummaryPreservedVolatility(scorecard, bestOutputProfile || bestWeightProfile);

  const context: AISummaryInterpretationContext = {
    interpreted,
    bestWeightProfile,
    bestOutputProfile,
    controlledProgressionProfile,
    constraintPhrase,
    constraintSuffix,
    workingWithConstraintSuffix,
    trueConsistencyCheck,
    blockNoun,
    bestProfile,
    weightedConditioning,
    significantWeightGain,
    hasExerciseChange,
    largeRelativeGain,
    dominantBaselineSeparation,
    tightBaselineRange,
    escalatingConstrainedProgression,
    sustainedPerformance,
    outlierHiccup,
    preservedVolatility,
  };

  if (classification.label === "Exceptional Growth") {
    buildAISummaryExceptionalInterpretedAchievements(scorecard, context);
  }

  if (classification.label === "Moderate Growth") {
    buildAISummaryModerateInterpretedAchievements(scorecard, context);
  }

  if (classification.label === "Stable Growth") {
    buildAISummaryStableInterpretedAchievements(scorecard, context);
  }

  if (classification.label === "Contextual Decline") {
    buildAISummaryContextualDeclineInterpretedAchievements(context);
  }

  if (!interpreted.length && achievements[0]) {
    pushAISummaryInterpretation(interpreted, {
      kind: "baseline_support",
      title: achievements[0].title,
      meaning: achievements[0].detail,
      summarySentence: achievements[0].detail,
      strength: achievements[0].strength,
      labelImpact: achievements[0].labelImpact,
      evidenceMarkerKinds: achievements[0].markerKinds,
    });
  }

  return interpreted
    .sort((a, b) => getAISummaryImpactRank(b.labelImpact) - getAISummaryImpactRank(a.labelImpact) || b.strength - a.strength)
    .slice(0, classification.label === "Exceptional Growth" ? 3 : 2);
};

const buildAISummaryHighlightsFromInterpretations = (interpretedAchievements: AISummaryInterpretedAchievement[]): AISummaryHighlight[] =>
  interpretedAchievements
    .filter((achievement) => achievement.labelImpact === "carries" || achievement.strength >= 0.82)
    .map((achievement) => ({
      title: achievement.title,
      detail: achievement.meaning,
      strength: achievement.strength,
    }))
    .slice(0, 2);

const shouldUseAISummaryHighlightSlot = (classification: AISummaryClassification, highlight?: AISummaryHighlight) => {
  if (!highlight) return false;
  if (classification.label === "Exceptional Growth") return highlight.strength >= 0.68;
  if (classification.label === "Moderate Growth") return highlight.strength >= 0.78;
  return false;
};


const buildAISummaryHighlightSentence = (highlight: AISummaryHighlight, scorecard: AISummaryScorecard) => {
  const title = highlight.title.trim();
  const detail = highlight.detail.trim();
  const constraintPhrase = getAISummaryConstraintPhrase(scorecard);

  if (/consecutive weight increases/i.test(title)) {
    return `You set the tone with ${title.toLowerCase()}${constraintPhrase ? ` ${constraintPhrase}` : ""}.`;
  }

  if (/above baseline/i.test(title)) {
    return `${title} gives the work a clear positive finish.`;
  }

  if (/explosive|baseline separation|retained/i.test(title)) {
    return detail || "You created separation from your baseline and kept building from there.";
  }

  return detail || title;
};

const getAISummarySlotPlan = (classification: AISummaryClassification, story: AISummaryStory): AISummarySlotPlan => {
  const basePlan: AISummarySlotPlan = {
    allowSecondaryHighlight: false,
    secondaryHighlightMinStrength: 0.9,
    allowFallbackHighlight: classification.label === "Exceptional Growth" || classification.label === "Moderate Growth",
    allowStructuralExplanation: story.needsStructuralExplanation,
    allowCloser: classification.label !== "Contextual Decline",
  };

  if (classification.label === "Exceptional Growth") {
    return {
      ...basePlan,
      allowSecondaryHighlight: true,
      secondaryHighlightMinStrength:
        story.identity === "stacked_progression" ||
        story.identity === "synchronized_advancement" ||
        story.identity === "constraint_progression"
          ? 0.86
          : 0.92,
      allowFallbackHighlight: true,
      allowStructuralExplanation: story.needsStructuralExplanation,
      allowCloser: true,
    };
  }

  if (classification.label === "Moderate Growth") {
    return {
      ...basePlan,
      allowSecondaryHighlight: false,
      secondaryHighlightMinStrength: 0.78,
      allowFallbackHighlight: true,
      allowStructuralExplanation: story.needsStructuralExplanation,
      allowCloser: true,
    };
  }

  if (classification.label === "Stable Growth") {
    return {
      ...basePlan,
      allowFallbackHighlight: false,
      allowStructuralExplanation: story.needsStructuralExplanation,
      allowCloser: false,
    };
  }

  return {
    ...basePlan,
    allowFallbackHighlight: false,
    allowStructuralExplanation: true,
    allowCloser: false,
  };
};

const isAISummaryPrestigeInterpretation = (interpretation?: AISummaryInterpretedAchievement) =>
  !!interpretation &&
  (
    interpretation.kind === "dominant_baseline_separation" ||
    interpretation.kind === "explosive_continuity" ||
    interpretation.kind === "escalating_constrained_progression" ||
    interpretation.kind === "explosive_constrained_progression" ||
    interpretation.kind === "explosive_conditioning_climb" ||
    interpretation.kind === "vertical_relaunch_conditioning"
  );

const selectAISummarySecondarySlotCandidate = (
  classification: AISummaryClassification,
  slotPlan: AISummarySlotPlan,
  primaryInterpretation: AISummaryInterpretedAchievement | undefined,
  secondaryInterpretations: AISummaryInterpretedAchievement[]
) => {
  const primaryIsPrestige = isAISummaryPrestigeInterpretation(primaryInterpretation);
  const exerciseChangeCandidate = secondaryInterpretations.find((item) => item.kind === "exercise_change_stability" || item.kind === "exercise_change_context");
  if (exerciseChangeCandidate && primaryInterpretation?.kind !== "exercise_change_stability") return exerciseChangeCandidate;

  if (!slotPlan.allowSecondaryHighlight) return undefined;

  return secondaryInterpretations.find((item) => {
    if (primaryIsPrestige && item.kind === "retained_adaptation") return false;
    if (classification.label === "Exceptional Growth") {
      return !primaryIsPrestige && (item.strength >= slotPlan.secondaryHighlightMinStrength || item.labelImpact !== "supports");
    }
    return item.strength >= slotPlan.secondaryHighlightMinStrength;
  });
};

const normalizeAISummarySlotText = (text: string) =>
  text
    .replace(/\bThe clearest (highlight|win) was\b/gi, "")
    .replace(/\bdouble ([A-Z]+)\/\1 constraints\b/g, "double $1 constraints")
    .replace(/\bthe read pointed upward\b/gi, "the progression stayed positive")
    .replace(/\s+/g, " ")
    .trim();

const locateAISummaryStory = (scorecard: AISummaryScorecard, classification: AISummaryClassification): AISummaryStory => {
  if (classification.label === "Exceptional Growth") {
    if (scorecard.hasRetainedOutputUnderWeight && scorecard.hasConstraints) {
      return { identity: "constraint_progression", label: classification.label, tone: "exceptional", needsStructuralExplanation: true };
    }
    if (scorecard.hasSynchronizedProgression) {
      return { identity: "synchronized_advancement", label: classification.label, tone: "exceptional", needsStructuralExplanation: false };
    }
    return { identity: scorecard.hasExplosiveJump ? "stacked_progression" : "hidden_progression", label: classification.label, tone: "exceptional", needsStructuralExplanation: !scorecard.hasExplosiveJump };
  }

  if (classification.label === "Moderate Growth") {
    if (scorecard.hasRetainedOutputUnderWeight) {
      return { identity: "stable_retention", label: classification.label, tone: "positive", needsStructuralExplanation: true };
    }
    return { identity: "steady_growth", label: classification.label, tone: "positive", needsStructuralExplanation: false };
  }

  if (classification.label === "Contextual Decline") {
    return { identity: "decline_with_context", label: classification.label, tone: "contextual", needsStructuralExplanation: true };
  }

  return { identity: scorecard.hasRebound ? "mixed_signals" : "baseline_read", label: classification.label, tone: "neutral", needsStructuralExplanation: false };
};

const formatAISummaryNumber = (value: number) => {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
};

const getAISummaryHeadline = (classification: AISummaryClassification, _story: AISummaryStory) => classification.label;


const buildAISummaryOpeningSlot = (scorecard: AISummaryScorecard, classification: AISummaryClassification, _story: AISummaryStory): AISummaryResolvedSlot => {
  const blockNoun = getAISummaryBlockNoun(scorecard);

  if (classification.label === "Exceptional Growth") {
    return { kind: "opener", text: `You crushed this ${blockNoun}!`, importance: 1 };
  }

  if (classification.label === "Moderate Growth") {
    if ((scorecard.hasConstraints && scorecard.hasRetainedOutputUnderWeight) || (scorecard.hasRetainedOutputUnderWeight && scorecard.totalWeightIncreaseCount >= 5)) return { kind: "opener", text: "Impressive performance.", importance: 0.9 };
    if (scorecard.hasRetainedOutputUnderWeight || scorecard.maxConsecutiveWeightIncreaseCount >= 3) return { kind: "opener", text: "Strong work here.", importance: 0.88 };
    if (scorecard.hasExplosiveJump) return { kind: "opener", text: "This block came together well.", importance: 0.86 };
    return { kind: "opener", text: "You performed well here.", importance: 0.82 };
  }

  if (classification.label === "Contextual Decline") {
    return { kind: "opener", text: "", importance: 0.76 };
  }

  if (isAISummaryTrueConsistencyCheck(scorecard)) {
    return { kind: "opener", text: "This block functioned more as a consistency-focused session than a progression-focused one.", importance: 0.68 };
  }

  return { kind: "opener", text: "You did well.", importance: 0.72 };
};

const buildAISummaryAchievementSentence = (
  scorecard: AISummaryScorecard,
  classification: AISummaryClassification,
  achievement?: AISummaryAchievement
) => {
  if (!achievement) return "";

  if (classification.label === "Stable Growth") {
    return achievement.detail;
  }

  if (achievement.id === "retained-output-under-weight") {
    return achievement.detail.replace("maintained its working range", "maintained a stable working range");
  }

  if (achievement.id === "explosive-output-jump") {
    return achievement.detail;
  }

  if (achievement.id === "four-plus-weight-increases") {
    return achievement.detail;
  }

  if (achievement.id === "synchronized-progression" && classification.label === "Exceptional Growth") {
    return "Both exercises helped create distance from the starting baseline and kept the higher structure intact.";
  }

  if (scorecard.mode === "single" && classification.label === "Moderate Growth" && achievement.id === "finished-above-start") {
    return achievement.detail.replace("which keeps the read pointed upward", "which is a strong sign of conditioning progress");
  }

  return achievement.detail;
};


const buildAISummaryExerciseChangeContextSentence = (
  scorecard: AISummaryScorecard,
  classification: AISummaryClassification,
  interpretedAchievements: AISummaryInterpretedAchievement[] = []
) => {
  if (classification.label !== "Moderate Growth" && classification.label !== "Exceptional Growth") return "";
  if (!scorecard.hasExerciseChange) return "";
  const stabilitySentence = interpretedAchievements.find((item) => item.kind === "exercise_change_stability")?.summarySentence || "";
  if (/mid-program exercise change/i.test(stabilitySentence)) return "";

  const kinds = interpretedAchievements.map((item) => item.kind);
  if (kinds.includes("strong_output_ceiling")) return "Despite a mid-program exercise change, you maintained a strong ceiling.";
  if (kinds.includes("strong_output_floor")) return "Despite a mid-program exercise change, you maintained a workable floor.";
  if (kinds.includes("controlled_progression")) return "Despite a mid-program exercise change, the progression still moved upward.";
  return "Despite a mid-program exercise change, you maintained your output range.";
};

const buildAISummaryStructuralSentence = (
  scorecard: AISummaryScorecard,
  classification: AISummaryClassification,
  story: AISummaryStory,
  interpretedAchievements: AISummaryInterpretedAchievement[] = []
) => {
  const bestOutputProfile = getAISummaryBestOutputProfile(scorecard);

  if (classification.label === "Contextual Decline") {
    return "";
  }

  if (classification.label === "Stable Growth") {
    return "";
  }

  if (classification.label === "Exceptional Growth") {
    return "";
  }

  if (classification.label === "Moderate Growth") {
    const hasInterpretation = interpretedAchievements.length > 0;
    if (hasInterpretation) return "";
    if (story.needsStructuralExplanation && scorecard.hasRetainedOutputUnderWeight) {
      return "The work became meaningful through the higher demand you handled, not just the output line.";
    }
    if (bestOutputProfile && bestOutputProfile.outputDelta > 0 && !scorecard.hasLateDip) {
      return `${bestOutputProfile.exerciseName} finished ${formatAISummaryDeltaWithMetric(bestOutputProfile.outputDelta, bestOutputProfile)} above where it started.`;
    }
  }

  return "";
};

const getAISummaryCloserText = (
  scorecard: AISummaryScorecard,
  classification: AISummaryClassification,
  interpretedAchievements: AISummaryInterpretedAchievement[]
) => {
  if (classification.label === "Exceptional Growth") return "Outstanding work!";
  if (classification.label === "Contextual Decline") return "";
  if (classification.label === "Stable Growth") {
    if (interpretedAchievements.some((item) => item.kind === "true_consistency_check")) return "";
    if (interpretedAchievements.some((item) => item.kind === "controlled_progression" || item.kind === "balanced_volatility")) return "";
    return "";
  }

  const kinds = interpretedAchievements.map((item) => item.kind);
  const highAchievementEnergy =
    kinds.includes("constraint_work_area") ||
    (kinds.includes("substantial_weight_gain") && (scorecard.hasConstraints || scorecard.totalWeightIncreaseCount >= 5));
  if (highAchievementEnergy) return "Great job.";
  if (kinds.includes("sustained_performance")) return "Great job.";
  if (kinds.includes("tight_baseline_range")) return classification.label === "Moderate Growth" ? "Good job." : "";
  if (kinds.includes("weighted_conditioning") || kinds.includes("preserved_volatility")) return "Good job.";
  if (kinds.includes("constraint_floor") || kinds.includes("controlled_workflow") || kinds.includes("consistent_output_progression") || kinds.includes("strong_output_floor") || kinds.includes("strong_output_ceiling")) return "Good job.";
  if (scorecard.hasConstraints || scorecard.hasRetainedOutputUnderWeight) return "Good job.";
  return "Good work.";
};

const adjustAISummaryCloserForThemeRepetition = (closer: string, existingSlots: AISummaryResolvedSlot[]) => {
  if (!closer) return closer;
  const priorText = existingSlots.map((slot) => slot.text).join(" ").toLowerCase();
  if (/\b(good|great|outstanding)\s+(job|work)\b[.!]?\s*$/.test(priorText)) return "";
  if (/\b(this style of workflow defines a great workout|this type of discipline|structure under rising demand reflects excellent discipline)\b/.test(priorText)) return "Good job.";

  return closer;
};


const composeAISummarySlots = (
  scorecard: AISummaryScorecard,
  classification: AISummaryClassification,
  story: AISummaryStory,
  achievements: AISummaryAchievement[],
  interpretedAchievements: AISummaryInterpretedAchievement[],
  highlights: AISummaryHighlight[]
): AISummaryResolvedSlot[] => {
  const slots: AISummaryResolvedSlot[] = [];
  const slotPlan = getAISummarySlotPlan(classification, story);
  const primaryAchievement = achievements[0];
  const primaryInterpretation = interpretedAchievements[0];
  const secondaryInterpretations = interpretedAchievements.slice(1);
  const primaryHighlight = highlights[0];

  const addSlot = (slot: AISummaryResolvedSlot | null | undefined) => {
    if (!slot?.text.trim()) return;
    const normalizedText = normalizeAISummarySlotText(slot.text);
    if (!normalizedText) return;
    slots.push({ ...slot, text: normalizedText });
  };

  addSlot(buildAISummaryOpeningSlot(scorecard, classification, story));

  const achievementSentence = primaryInterpretation?.summarySentence || buildAISummaryAchievementSentence(scorecard, classification, primaryAchievement);
  if (achievementSentence) {
    addSlot({
      kind: "dominant_achievement",
      text: achievementSentence,
      importance: primaryInterpretation?.strength || primaryAchievement?.strength || 0.7,
    });
  }

  const usefulSecondary = selectAISummarySecondarySlotCandidate(
    classification,
    slotPlan,
    primaryInterpretation,
    secondaryInterpretations
  );

  if (usefulSecondary && usefulSecondary.summarySentence !== achievementSentence) {
    addSlot({ kind: "highlight", text: usefulSecondary.summarySentence, importance: usefulSecondary.strength });
  } else if (slotPlan.allowFallbackHighlight && !primaryInterpretation && shouldUseAISummaryHighlightSlot(classification, primaryHighlight)) {
    const highlightText = buildAISummaryHighlightSentence(primaryHighlight, scorecard);
    if (highlightText && highlightText !== achievementSentence) {
      addSlot({ kind: "highlight", text: highlightText, importance: primaryHighlight.strength });
    }
  }

  const exerciseChangeContext = buildAISummaryExerciseChangeContextSentence(scorecard, classification, interpretedAchievements);
  const exerciseChangeAlreadyMentioned = slots.some((slot) => /mid-program exercise change/i.test(slot.text));
  if (exerciseChangeContext && exerciseChangeContext !== achievementSentence && !exerciseChangeAlreadyMentioned) {
    addSlot({ kind: "supporting_context", text: exerciseChangeContext, importance: 0.66 });
  }

  if (slotPlan.allowStructuralExplanation) {
    const structuralSentence = buildAISummaryStructuralSentence(scorecard, classification, story, interpretedAchievements);
    if (structuralSentence) {
      addSlot({
        kind: classification.label === "Contextual Decline" || classification.label === "Stable Growth" ? "structural_explanation" : "supporting_context",
        text: structuralSentence,
        importance: 0.58,
      });
    }
  }

  if (slotPlan.allowCloser) {
    const closer = adjustAISummaryCloserForThemeRepetition(getAISummaryCloserText(scorecard, classification, interpretedAchievements), slots);
    if (closer) addSlot({ kind: "closer", text: closer, importance: 0.35 });
  }

  const seen = new Set<string>();
  return slots.filter((slot) => {
    const normalized = slot.text.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    const shortKey = normalized
      .replace(/\b(the|a|an|this|that|with|while|under|through|and|or|but|it|its|you|your|graph|block|exercise)\b/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!normalized || seen.has(normalized) || seen.has(shortKey)) return false;
    seen.add(normalized);
    seen.add(shortKey);
    return true;
  });
};

const cleanupAISummaryText = (slots: AISummaryResolvedSlot[]) => {
  const sentence = slots
    .sort((a, b) => {
      const order: Record<AISummarySlotKind, number> = {
        opener: 1,
        dominant_achievement: 2,
        highlight: 3,
        supporting_context: 4,
        structural_explanation: 5,
        closer: 6,
      };
      return order[a.kind] - order[b.kind];
    })
    .map((slot) => slot.text.trim())
    .filter(Boolean)
    .join(" ")
    .replace(/You performed well here\. Despite a hiccup, you performed well here\./g, "Despite a hiccup, you performed well here.")
    .replace(/\s+/g, " ")
    .trim();

  return sentence
    .replace(/\s+/g, " ")
    .replace(/\.\s+Outstanding work\.$/, ". Outstanding work!")
    .replace(/\.\s+Outstanding job\.$/, ". Outstanding job!");
};

const generateWorkoutSummaryInsightFromGraphData = (graphData: GraphSeries[], blockType?: BlockType): WorkoutSummaryInsight | null => {
  if (!graphData.length || !blockType) return null;

  const scorecard = buildAISummaryScorecard(graphData, blockType);
  if (!scorecard) return null;

  const classification = classifyAISummaryLabel(scorecard);
  const achievements = buildAISummaryAchievements(scorecard, classification);
  const interpretedAchievements = buildAISummaryInterpretedAchievements(scorecard, classification, achievements);
  const highlights = buildAISummaryHighlightsFromInterpretations(interpretedAchievements);
  const story = locateAISummaryStory(scorecard, classification);
  const slots = composeAISummarySlots(scorecard, classification, story, achievements, interpretedAchievements, highlights);
  const summary = cleanupAISummaryText(slots);
  const headline = getAISummaryHeadline(classification, story);

  return {
    id: `ai-summary-${blockType}-${classification.label.replace(/\s+/g, "-").toLowerCase()}-${scorecard.sessionCount}-${graphData.map((series) => series.exerciseId).join("-")}`,
    label: classification.label,
    headline,
    summary,
    tone: story.tone,
    reportAccuracy: scorecard.dataConfidence,
    accuracyReason: scorecard.dataConfidence === "High" ? "stable data set" : scorecard.dataConfidence === "Moderate" ? "developing data set" : "limited data",
    achievements,
    interpretedAchievements,
    highlights,
    markers: scorecard.markers,
    slots,
  };
};

const getAISummaryToneClasses = (tone: AISummaryTone) => {
  if (tone === "exceptional") return "bg-emerald-100 text-emerald-800 ring-emerald-200";
  if (tone === "positive") return "bg-teal-100 text-teal-800 ring-teal-200";
  if (tone === "contextual") return "bg-amber-100 text-amber-800 ring-amber-200";
  if (tone === "baseline") return "bg-sky-100 text-sky-800 ring-sky-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
};

function AISummaryMiniCard({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="rounded-xl border border-zinc-100 bg-zinc-50 p-3">
      <div className="text-sm font-semibold text-zinc-900">{title}</div>
      <p className="mt-1 text-xs leading-5 text-zinc-600">{detail}</p>
    </div>
  );
}

function GraphInsightCard({ insight }: { insight: WorkoutSummaryInsight | null }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [insight?.id]);

  if (!insight) {
    return (
      <section className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-500">
        Add more saved sessions to generate a workout summary for this graph.
      </section>
    );
  }

  const toneClasses = getAISummaryToneClasses(insight.tone);
  const secondaryDetails = insight.markers.slice(0, 5);

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="rounded-2xl bg-zinc-950 px-3 py-2 text-sm font-bold text-white shadow-sm">AI</div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700">Workout Summary</h3>
            <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${toneClasses}`}>{insight.label}</span>
            <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600">
              Report Accuracy: {insight.reportAccuracy} · {insight.accuracyReason}
            </span>
          </div>

          <p className="mt-2 text-lg font-semibold leading-snug text-zinc-950">{insight.headline}</p>
          <p className="mt-2 text-sm leading-6 text-zinc-700">{insight.summary}</p>


          {insight.interpretedAchievements.length ? (
            <div className="mt-3">
              <p className="mb-1 text-xs font-bold uppercase tracking-wide text-zinc-500">Key Factors</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {insight.interpretedAchievements.slice(0, 2).map((achievement) => (
                  <AISummaryMiniCard key={`${insight.id}-${achievement.kind}-${achievement.title}`} title={achievement.title} detail={achievement.meaning} />
                ))}
              </div>
            </div>
          ) : null}

          {secondaryDetails.length ? (
            <div className="mt-3">
              <button type="button" onClick={() => setOpen((value) => !value)} className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                {open ? "Hide Details" : "Show Details"}
              </button>
              {open ? (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {secondaryDetails.map((marker) => (
                    <AISummaryMiniCard key={`${insight.id}-${marker.kind}-${marker.text}`} title={marker.kind.replace(/_/g, " ")} detail={marker.text} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default function App() {
  const [members, setMembers] = useState<Member[]>(() => {
    if (typeof window === "undefined") return [{ id: "member-1", clientId: "100001", name: "Test Subject" }];
    const stored = window.localStorage.getItem(STORAGE_KEYS.members);
    return stored ? JSON.parse(stored) : [{ id: "member-1", clientId: "100001", name: "Test Subject" }];
  });
  const [memberSearch, setMemberSearch] = useState("");
  const [viewArchivedMembers, setViewArchivedMembers] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>("member-1");
  const [isEditingMember, setIsEditingMember] = useState(false);
  const [editedMemberName, setEditedMemberName] = useState("");
  const [editedMemberClientId, setEditedMemberClientId] = useState("");
  const [role, setRole] = useState<Role>("admin");
  const [screen, setScreen] = useState<Screen>("members");
  const [programs, setPrograms] = useState<Program[]>(() => {
    if (typeof window === "undefined") return buildInitialPrograms();
    const stored = window.localStorage.getItem(STORAGE_KEYS.programs);
    return stored ? mergeProgramsWithBase(JSON.parse(stored)) : buildInitialPrograms();
  });
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>("program-1");
  const [builderSource, setBuilderSource] = useState<BuilderSource>("adminPrograms");
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(ROUTINE_IDS.day1);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(BLOCK_IDS.day1A);
  const [graphAxis, setGraphAxis] = useState<GraphAxis>("date");
  const [activeExerciseName, setActiveExerciseName] = useState<string | null>(null);
  const [lastHoveredGraphPoint, setLastHoveredGraphPoint] = useState<ChartPoint | null>(null);
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>(() => {
    if (typeof window === "undefined") return [];
    const stored = window.localStorage.getItem(STORAGE_KEYS.savedSessions);
    return stored ? JSON.parse(stored) : [];
  });
  const [importText, setImportText] = useState(PROGRAM_1_IMPORT_TEMPLATE);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    const scopedMembers = members.filter((member) => (viewArchivedMembers ? Boolean(member.archived) : !member.archived));

    if (!query) return showAllMembers ? scopedMembers : scopedMembers.slice(0, 10);
    return scopedMembers.filter((member) =>
      member.name.toLowerCase().includes(query) || member.clientId.toLowerCase().includes(query)
    );
  }, [members, memberSearch, viewArchivedMembers, showAllMembers]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || members[0] || null,
    [members, selectedMemberId]
  );

  useEffect(() => {
    if (!selectedMember) {
      setIsEditingMember(false);
      setEditedMemberName("");
      setEditedMemberClientId("");
      return;
    }

    setEditedMemberName(selectedMember.name);
    setEditedMemberClientId(selectedMember.clientId);
    setIsEditingMember(false);
  }, [selectedMember?.id]);

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => getSafeDateTime(b.startedAt) - getSafeDateTime(a.startedAt)),
    [programs]
  );

  const adminPrograms = useMemo(() => {
    if (!selectedMember) return [];
    return programs.filter((program) => (program.memberId || members[0]?.id || null) === selectedMember.id);
  }, [programs, selectedMember, members]);

  const adminSortedPrograms = useMemo(
    () => [...adminPrograms].sort((a, b) => getSafeDateTime(b.startedAt) - getSafeDateTime(a.startedAt)),
    [adminPrograms]
  );

  const activeAdminProgram = useMemo(
    () => adminSortedPrograms.find((program) => program.status === "active") || null,
    [adminSortedPrograms]
  );

  const selectedProgram = useMemo(
    () =>
      programs.find((program) => program.id === selectedProgramId) ||
      (role === "admin" && (screen === "memberOverview" || screen === "adminPrograms" || screen === "builder")
        ? adminSortedPrograms[0] || null
        : sortedPrograms[0] || null),
    [programs, selectedProgramId, role, screen, adminSortedPrograms, sortedPrograms]
  );

  const selectedRoutine = useMemo(
    () => selectedProgram?.routines.find((routine) => routine.id === selectedRoutineId) || selectedProgram?.routines[0] || null,
    [selectedProgram, selectedRoutineId]
  );

  const selectedBlock = useMemo(
    () => selectedRoutine?.blocks.find((block) => block.id === selectedBlockId) || selectedRoutine?.blocks[0] || null,
    [selectedRoutine, selectedBlockId]
  );

  const matchingSavedSessions = useMemo(() => {
    if (!selectedProgram || !selectedRoutine || !selectedMember) return [];

    return [...savedSessions]
      .filter(
        (session) =>
          session.programId === selectedProgram.id &&
          session.routineId === selectedRoutine.id &&
          session.memberId === selectedMember.id
      )
      .sort((a, b) => getSafeDateTime(b.createdAt) - getSafeDateTime(a.createdAt));
  }, [savedSessions, selectedMember, selectedProgram, selectedRoutine]);

  const latestSavedSession = matchingSavedSessions[0] || null;

  const graphData = useMemo<GraphSeries[]>(() => {
    if (!selectedBlock || !selectedRoutine || !selectedProgram || !selectedMember) return [];

    const seriesMap: Record<string, GraphSeries> = {};
    const exerciseLookup = new Map(selectedBlock.exercises.map((exercise) => [exercise.id, exercise]));

    const scopedSessions = savedSessions.filter(
      (session) =>
        session.programId === selectedProgram.id &&
        session.routineId === selectedRoutine.id &&
        session.memberId === selectedMember.id
    );

    scopedSessions.forEach((session) => {
      const matchingBlock = session.blocks.find((block) => block.blockId === selectedBlock.id);
      if (!matchingBlock) return;

      matchingBlock.entries.forEach((entry, entryIndex) => {
        const exercise = exerciseLookup.get(entry.exerciseId);
        const rawY = selectedBlock.type === "single" ? entry.performance : entry.setsCompleted;
        const y = Number(rawY);
        const sessionNumber = Number(session.sessionNumber);
        const slot: 1 | 2 = selectedBlock.type === "paired" ? (entryIndex === 0 ? 1 : 2) : 1;

        if (!Number.isFinite(y) || !Number.isFinite(sessionNumber)) return;

        if (!seriesMap[entry.exerciseId]) {
          seriesMap[entry.exerciseId] = {
            exerciseId: entry.exerciseId,
            exerciseName: entry.exerciseName,
            points: [],
          };
        }

        seriesMap[entry.exerciseId].points.push({
          x: graphAxis === "date" ? session.date : sessionNumber,
          y,
          weight: normalizeWeightInput(entry.weight),
          sessionId: session.id,
          sessionNumber,
          date: session.date,
          performance: entry.performance,
          duration: selectedBlock.duration,
          exerciseName: entry.exerciseName,
          target: entry.target || exercise?.target || "",
          metric: entry.metric || exercise?.metric || "",
          blockType: selectedBlock.type,
          slot,
        });
      });
    });

    return Object.values(seriesMap).map((series) => ({
      ...series,
      points: [...series.points].sort((a, b) => {
        if (graphAxis === "date") {
          return getSafeDateTime(a.date) - getSafeDateTime(b.date);
        }
        return a.sessionNumber - b.sessionNumber;
      }),
    }));
  }, [savedSessions, selectedBlock, selectedRoutine, selectedProgram, selectedMember, graphAxis]);

  const generatedWorkoutSummaryInsight = useMemo(
    () => generateWorkoutSummaryInsightFromGraphData(graphData, selectedBlock?.type),
    [graphData, selectedBlock?.type]
  );

  const dateAxisMeta = useMemo(() => {
    const labels = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.date)))).sort(
      (a, b) => getSafeDateTime(a) - getSafeDateTime(b)
    );

    if (!labels.length) {
      return {
        positionMap: new Map<string, number>(),
        tickValues: [] as number[],
        labelMap: new Map<number, string>(),
        domain: [0, 1] as [number, number],
      };
    }

    const firstTime = getSafeDateTime(labels[0]);
    const tickValues = labels.map((label) => {
      const diffMs = Math.max(0, getSafeDateTime(label) - firstTime);
      return diffMs / (1000 * 60 * 60 * 24) + 1;
    });
    const positionMap = new Map(labels.map((label, index) => [label, tickValues[index]]));
    const labelMap = new Map<number, string>(tickValues.map((tick, index) => [tick, `D${index + 1}`]));
    const minTick = Math.min(...tickValues);
    const maxTick = Math.max(...tickValues);

    return {
      positionMap,
      tickValues,
      labelMap,
      domain: [Math.max(0, minTick - 0.4), maxTick + 0.4] as [number, number],
    };
  }, [graphData]);

  const chartSeries = useMemo<PositionedSeries[]>(() => {
    const baselineBySlot = new Map<1 | 2, number>();

    graphData.forEach((series) => {
      const firstPoint = series.points[0];
      if (!firstPoint) return;

      const slot = firstPoint.slot;
      const baseX = graphAxis === "date" ? Number(dateAxisMeta.positionMap.get(firstPoint.date) || 0) : firstPoint.sessionNumber;
      const current = baselineBySlot.get(slot);
      if (current == null || baseX < current) {
        baselineBySlot.set(slot, baseX);
      }
    });

    const collisionMap = new Map<string, GraphPoint[]>();

    if (selectedBlock?.type === "paired") {
      graphData.forEach((series) => {
        series.points.forEach((point) => {
          const baseX = graphAxis === "date" ? Number(dateAxisMeta.positionMap.get(point.date) || 0) : point.sessionNumber;
          const collisionKey = `${baseX}::${point.y}`;
          const cluster = collisionMap.get(collisionKey) || [];
          cluster.push(point);
          collisionMap.set(collisionKey, cluster);
        });
      });
    }

    return graphData.map((series) => {
      const firstPoint = series.points[0];
      const slot: 1 | 2 = firstPoint?.slot ?? 1;
      const firstBaseX =
        graphAxis === "date"
          ? Number(dateAxisMeta.positionMap.get(firstPoint?.date || "") || 0)
          : Number(firstPoint?.sessionNumber || 0);
      const isChangedMidRoutine =
        selectedBlock?.type === "paired" && firstPoint
          ? firstBaseX > Number(baselineBySlot.get(slot) ?? firstBaseX)
          : false;

      const shape =
        selectedBlock?.type === "single"
          ? "square"
          : isChangedMidRoutine
            ? "diamond"
            : slot === 2
              ? "triangle"
              : "circle";

      const dash = selectedBlock?.type === "paired" && slot === 2 ? "6 4" : undefined;
      const stroke = selectedBlock?.type === "paired" && slot === 2 ? "#6b7280" : "#111111";

      const points: ChartPoint[] = series.points.map((point) => {
        const baseX = graphAxis === "date" ? Number(dateAxisMeta.positionMap.get(point.date) || 0) : point.sessionNumber;
        const xLabel = graphAxis === "date" ? dateAxisMeta.labelMap.get(baseX) || "" : `S${point.sessionNumber}`;

        let offset = 0;
        if (selectedBlock?.type === "paired") {
          const collisionKey = `${baseX}::${point.y}`;
          const cluster = (collisionMap.get(collisionKey) || []).slice().sort((a, b) => {
            if (a.slot !== b.slot) return a.slot - b.slot;
            return a.exerciseName.localeCompare(b.exerciseName);
          });

          if (cluster.length === 2 && cluster[0].slot !== cluster[1].slot) {
            offset = point.slot === 1 ? -(PAIRED_SAME_Y_TOTAL_OFFSET / 2) : PAIRED_SAME_Y_TOTAL_OFFSET / 2;
          }
        }

        return {
          ...point,
          chartX: baseX + offset,
          xLabel,
        };
      });

      return {
        ...series,
        slot,
        shape,
        dash,
        stroke,
        isChangedMidRoutine,
        points,
      };
    });
  }, [dateAxisMeta.labelMap, dateAxisMeta.positionMap, graphData, graphAxis, selectedBlock]);

  useEffect(() => {
    if (!chartSeries.length) {
      setActiveExerciseName(null);
      return;
    }

    if (activeExerciseName && chartSeries.some((series) => series.exerciseName === activeExerciseName)) {
      return;
    }

    setActiveExerciseName(chartSeries[0]?.exerciseName ?? null);
  }, [activeExerciseName, chartSeries]);

  const xAxisTicks = useMemo<number[]>(() => {
    if (graphAxis === "date") {
      return dateAxisMeta.tickValues;
    }

    const sessions = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.sessionNumber))));
    return sessions.sort((a, b) => a - b);
  }, [dateAxisMeta.tickValues, graphData, graphAxis]);

  const xAxisLabelMap = useMemo<Map<number, string>>(() => {
    if (graphAxis === "date") {
      return dateAxisMeta.labelMap;
    }

    const map = new Map<number, string>();
    const sessions = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.sessionNumber))));
    sessions.forEach((sessionNumber) => {
      map.set(sessionNumber, `S${sessionNumber}`);
    });
    return map;
  }, [dateAxisMeta.labelMap, graphData, graphAxis]);

  const xAxisDomain = useMemo<[number, number]>(() => {
    if (!xAxisTicks.length) return [0, 1];
    if (graphAxis === "date") return dateAxisMeta.domain;
    return [Math.min(...xAxisTicks) - 0.4, Math.max(...xAxisTicks) + 0.4];
  }, [dateAxisMeta.domain, graphAxis, xAxisTicks]);

  const yDomain = useMemo(() => {
    const values = graphData.flatMap((series) => series.points.map((point) => point.y));
    if (!values.length) return [0, 4] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);
    const padding = selectedBlock?.type === "single" ? 1 : 2;

    return [Math.max(0, Math.floor(min) - padding), Math.ceil(max) + padding] as [number, number];
  }, [graphData, selectedBlock?.type]);

  const yAxisTicks = useMemo(() => {
    if (selectedBlock?.type !== "paired") return undefined;

    const ticks: number[] = [];
    for (let value = yDomain[1]; value >= yDomain[0]; value -= 1) {
      ticks.push(value);
    }
    return ticks;
  }, [selectedBlock?.type, yDomain]);

  const displayChartSeries = useMemo(() => {
    if (!activeExerciseName) return chartSeries;

    return [...chartSeries].sort((a, b) => {
      const aActive = a.exerciseName === activeExerciseName ? 1 : 0;
      const bActive = b.exerciseName === activeExerciseName ? 1 : 0;
      return aActive - bActive;
    });
  }, [activeExerciseName, chartSeries]);

  const graphLegendItems = useMemo(
    () =>
      chartSeries.map((series) => ({
        exerciseId: series.exerciseId,
        exerciseName: series.exerciseName,
        shape: series.shape as "circle" | "square" | "triangle" | "diamond",
        dash: series.dash,
        stroke: series.stroke,
        slot: series.slot,
        isChangedMidRoutine: series.isChangedMidRoutine,
      })),
    [chartSeries]
  );


  const weightLegendItems = useMemo(() => {
    const items = chartSeries.flatMap((series) =>
      series.points
        .map((point) => normalizeWeightInput(point.weight))
        .filter(Boolean)
        .map((weight) => ({
          key: `${series.exerciseId}-${series.shape}-${weight}`,
          exerciseName: series.exerciseName,
          shape: series.shape as "circle" | "square" | "triangle" | "diamond",
          value: weight,
          label: weight === "BW" ? "BW" : `${weight} lbs`,
          color: getStableWeightColor(weight),
        }))
    );

    const uniqueItems = Array.from(new Map(items.map((item) => [item.key, item])).values());

    return uniqueItems.sort((a, b) => {
      if (a.exerciseName !== b.exerciseName) return a.exerciseName.localeCompare(b.exerciseName);
      if (a.value === "BW") return -1;
      if (b.value === "BW") return 1;
      return Number(a.value) - Number(b.value);
    });
  }, [chartSeries]);

  const tooltipPosition = useMemo(() => getSmartTooltipPosition(lastHoveredGraphPoint, 320), [lastHoveredGraphPoint]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.members, JSON.stringify(members));
  }, [members]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.programs, JSON.stringify(programs));
  }, [programs]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEYS.savedSessions, JSON.stringify(savedSessions));
  }, [savedSessions]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadySeededProgram1 = window.localStorage.getItem(STORAGE_KEYS.seeded);
    if (!alreadySeededProgram1 && members[0] && programs.find((program) => program.id === "program-1")) {
      const programOne = programs.find((program) => program.id === "program-1");
      if (!programOne) return;

      const seededSessions = parseImportedSessions(PROGRAM_1_IMPORT_TEMPLATE, programOne, members[0].id);
      setSavedSessions((prev) => {
        const hasProgramOne = prev.some((session) => session.programId === programOne.id && session.memberId === members[0].id);
        return hasProgramOne ? prev : [...prev, ...seededSessions];
      });
      window.localStorage.setItem(STORAGE_KEYS.seeded, "true");
    }
  }, [members, programs]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadySeededProgram2 = window.localStorage.getItem(STORAGE_KEYS.seededProgram2);
    if (!alreadySeededProgram2 && members[0] && programs.find((program) => program.id === "program-2")) {
      const programTwo = programs.find((program) => program.id === "program-2");
      if (!programTwo) return;

      const seededSessions = parseRelayImportedSessions(PROGRAM_2_RELAY_TEMPLATE, programTwo, members[0].id);
      setSavedSessions((prev) => {
        const hasProgramTwo = prev.some((session) => session.programId === programTwo.id && session.memberId === members[0].id);
        return hasProgramTwo ? prev : [...prev, ...seededSessions];
      });
      window.localStorage.setItem(STORAGE_KEYS.seededProgram2, "true");
    }
  }, [members, programs]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const alreadySeededProgram3 = window.localStorage.getItem(STORAGE_KEYS.seededProgram3);
    if (!alreadySeededProgram3 && members[0] && programs.find((program) => program.id === "program-3")) {
      const programThree = programs.find((program) => program.id === "program-3");
      if (!programThree) return;

      const seededSessions = parseRelayImportedSessions(PROGRAM_3_RELAY_TEMPLATE, programThree, members[0].id);
      setSavedSessions((prev) => {
        const hasProgramThree = prev.some((session) => session.programId === programThree.id && session.memberId === members[0].id);
        return hasProgramThree ? prev : [...prev, ...seededSessions];
      });
      window.localStorage.setItem(STORAGE_KEYS.seededProgram3, "true");
    }
  }, [members, programs]);


  useEffect(() => {
    if (!selectedProgram || !selectedRoutine || !selectedMember) {
      setSessionDraft(null);
      return;
    }

    setSessionDraft(createSessionDraft(selectedProgram.id, selectedRoutine, selectedMember.id));
  }, [selectedProgram?.id, selectedRoutine?.id, selectedMember?.id]);

  const updatePrograms = (updater: (current: Program[]) => Program[]) => {
    setPrograms((prev) => updater(prev));
  };

  const addRoutine = () => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) =>
        program.id === selectedProgram.id
          ? { ...program, routines: [...program.routines, createRoutine(program.routines.length)] }
          : program
      )
    );
  };

  const deleteRoutine = (routineId: string) => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== selectedProgram.id) return program;
        const nextRoutines = program.routines.filter((routine) => routine.id !== routineId);
        if (selectedRoutineId === routineId) setSelectedRoutineId(nextRoutines[0]?.id || null);
        return { ...program, routines: nextRoutines.length ? nextRoutines : [createRoutine(0)] };
      })
    );
  };

  const updateRoutine = (routineId: string, data: Partial<Routine>) => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) =>
        program.id !== selectedProgram.id
          ? program
          : {
              ...program,
              routines: program.routines.map((routine) => (routine.id === routineId ? { ...routine, ...data } : routine)),
            }
      )
    );
  };

  const addBlock = (routineId: string, type: BlockType) => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) =>
        program.id !== selectedProgram.id
          ? program
          : {
              ...program,
              routines: program.routines.map((routine) =>
                routine.id !== routineId ? routine : { ...routine, blocks: [...routine.blocks, createBlock(type)] }
              ),
            }
      )
    );
  };

  const deleteBlock = (routineId: string, blockId: string) => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== selectedProgram.id) return program;
        return {
          ...program,
          routines: program.routines.map((routine) => {
            if (routine.id !== routineId) return routine;
            const nextBlocks = routine.blocks.filter((block) => block.id !== blockId);
            if (selectedBlockId === blockId) setSelectedBlockId(nextBlocks[0]?.id || null);
            return { ...routine, blocks: nextBlocks.length ? nextBlocks : [createBlock("paired")] };
          }),
        };
      })
    );
  };

  const moveBlock = (routineId: string, blockId: string, direction: "up" | "down") => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== selectedProgram.id) return program;
        return {
          ...program,
          routines: program.routines.map((routine) => {
            if (routine.id !== routineId) return routine;
            const index = routine.blocks.findIndex((block) => block.id === blockId);
            if (index < 0) return routine;
            const swapIndex = direction === "up" ? index - 1 : index + 1;
            if (swapIndex < 0 || swapIndex >= routine.blocks.length) return routine;
            const nextBlocks = [...routine.blocks];
            [nextBlocks[index], nextBlocks[swapIndex]] = [nextBlocks[swapIndex], nextBlocks[index]];
            return { ...routine, blocks: nextBlocks };
          }),
        };
      })
    );
  };

  const updateBlock = (routineId: string, blockId: string, data: Partial<Block>) => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== selectedProgram.id) return program;
        return {
          ...program,
          routines: program.routines.map((routine) => {
            if (routine.id !== routineId) return routine;
            return {
              ...routine,
              blocks: routine.blocks.map((block) => (block.id === blockId ? { ...block, ...data } : block)),
            };
          }),
        };
      })
    );
  };

  const updateExercise = (routineId: string, blockId: string, exerciseId: string, data: Partial<Exercise>) => {
    if (!selectedProgram) return;
    updatePrograms((prev) =>
      prev.map((program) => {
        if (program.id !== selectedProgram.id) return program;
        return {
          ...program,
          routines: program.routines.map((routine) => {
            if (routine.id !== routineId) return routine;
            return {
              ...routine,
              blocks: routine.blocks.map((block) => {
                if (block.id !== blockId) return block;
                return {
                  ...block,
                  exercises: block.exercises.map((exercise) => (exercise.id === exerciseId ? { ...exercise, ...data } : exercise)),
                };
              }),
            };
          }),
        };
      })
    );
  };

  const goAdminMembers = () => {
    setRole("admin");
    setScreen("members");
  };

  const openMemberOverview = (memberId: string) => {
    setSelectedMemberId(memberId);
    setRole("admin");
    setScreen("memberOverview");
  };

  const goAdminPrograms = () => {
    setRole("admin");
    setScreen("adminPrograms");
  };

  const goBack = () => {
    if (role === "admin") {
      if (screen === "memberOverview") {
        goAdminMembers();
        return;
      }
      if (screen === "adminPrograms") {
        setScreen("memberOverview");
        return;
      }
      if (screen === "builder") {
        if (builderSource === "memberOverview") {
          setScreen("memberOverview");
        } else {
          goAdminPrograms();
        }
        return;
      }
      if (screen === "input") {
        goAdminMembers();
      }
      return;
    }

    if (screen === "routines") {
      goMemberPrograms();
      return;
    }
    if (screen === "routine") {
      setScreen("routines");
      return;
    }
    if (screen === "graph") {
      setScreen("routine");
    }
  };

  const backLabel = useMemo(() => {
    if (role === "admin") {
      if (screen === "memberOverview") return "Back to Client List";
      if (screen === "adminPrograms") return selectedMember ? `Back to ${selectedMember.name}` : "Back";
      if (screen === "builder") {
        if (builderSource === "memberOverview") return selectedMember ? `Back to ${selectedMember.name}` : "Back";
        return "Back to All Programs";
      }
      if (screen === "input") return "Back to Client List";
      return "";
    }
    if (screen === "routines") return "Back to My Programs";
    if (screen === "routine") return selectedProgram ? `Back to ${selectedProgram.name}` : "Back to My Programs";
    if (screen === "graph") return selectedRoutine ? `Back to ${selectedRoutine.label}` : "Back";
    return "";
  }, [role, screen, builderSource, selectedMember, selectedProgram, selectedRoutine]);

  const addMember = () => {
    const nextMemberNumber = members.length + 1;
    const newMember: Member = {
      id: uid(),
      clientId: String(100000 + nextMemberNumber),
      name: `New Member ${nextMemberNumber}`,
      programClosed: false,
      archived: false,
    };

    setMembers((prev) => [...prev, newMember]);
    setSelectedMemberId(newMember.id);
    setMemberSearch("");
    setViewArchivedMembers(false);
    setShowAllMembers(false);
  };

  const removeMember = (memberId: string) => {
    const confirmDelete = window.confirm("Are you sure? This action cannot be undone.");
    if (!confirmDelete) return;
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
      setScreen("members");
    }
  };

  const archiveMember = (memberId: string) => {
    setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, archived: true } : member)));
    if (selectedMemberId === memberId) {
      setSelectedMemberId(null);
      setScreen("members");
    }
  };

  const restoreMember = (memberId: string) => {
    setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, archived: false } : member)));
  };

  const goAdminInput = () => {
    setRole("admin");
    setScreen("input");
  };

  const goMemberPrograms = () => {
    setRole("member");
    setScreen("programs");
  };

  const openProgram = (programId: string) => {
    setSelectedProgramId(programId);
    setSelectedRoutineId(null);
    setSelectedBlockId(null);
    setScreen(role === "admin" ? "builder" : "routines");
  };

  const openRoutine = (routineId: string) => {
    setSelectedRoutineId(routineId);
    setScreen("routine");
  };

  const openGraph = (routineId: string, blockId: string) => {
    setSelectedRoutineId(routineId);
    setSelectedBlockId(blockId);
    setScreen("graph");
  };

  const selectedBlockIndex = selectedRoutine?.blocks.findIndex((block) => block.id === selectedBlock?.id) ?? -1;
  const canGoToPreviousBlock = selectedBlockIndex > 0;
  const canGoToNextBlock = !!selectedRoutine && selectedBlockIndex >= 0 && selectedBlockIndex < selectedRoutine.blocks.length - 1;
  const selectedGraphPositionLabel =
    selectedRoutine && selectedBlockIndex >= 0
      ? `Graph ${selectedBlockIndex + 1} of ${selectedRoutine.blocks.length}`
      : "Graph";
  const previousGraphBlockTitle = selectedRoutine && canGoToPreviousBlock ? selectedRoutine.blocks[selectedBlockIndex - 1]?.title : "";
  const nextGraphBlockTitle = selectedRoutine && canGoToNextBlock ? selectedRoutine.blocks[selectedBlockIndex + 1]?.title : "";

  const stepGraphBlock = (direction: "previous" | "next") => {
    if (!selectedRoutine || selectedBlockIndex < 0) return;

    const nextIndex = direction === "previous" ? selectedBlockIndex - 1 : selectedBlockIndex + 1;
    const nextBlock = selectedRoutine.blocks[nextIndex];
    if (!nextBlock) return;

    setSelectedBlockId(nextBlock.id);
  };

  const updateSessionDraftField = (field: "date" | "sessionNumber", value: string) => {
    setSessionDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateSessionExercise = (blockId: string, exerciseId: string, field: "weight" | "performance" | "setsCompleted", value: string) => {
    setSessionDraft((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        blocks: prev.blocks.map((block) =>
          block.blockId !== blockId
            ? block
            : {
                ...block,
                entries: block.entries.map((entry) =>
                  entry.exerciseId !== exerciseId
                    ? entry
                    : {
                        ...entry,
                        [field]: field === "weight" ? normalizeWeightInput(value) : value,
                      }
                ),
              }
        ),
      };
    });
  };

  const saveSession = () => {
    if (!sessionDraft || !selectedProgram || !selectedRoutine || !selectedMember) return;

    const trimmedDate = sessionDraft.date.trim();
    const trimmedSessionNumber = sessionDraft.sessionNumber.trim();

    if (!trimmedDate || !trimmedSessionNumber) return;

    const savedSession: SavedSession = {
      ...sessionDraft,
      date: trimmedDate,
      sessionNumber: trimmedSessionNumber,
      id: uid(),
      createdAt: new Date().toISOString(),
    };

    setSavedSessions((prev) => [...prev, savedSession]);
    setSessionDraft(createSessionDraft(selectedProgram.id, selectedRoutine, selectedMember.id));
  };

  const importProgramData = () => {
    if (!selectedProgram || !selectedMember || !importText.trim()) return;
    const importedSessions = parseAnyImportedSessions(importText, selectedProgram, selectedMember.id);
    if (!importedSessions.length) return;

    setSavedSessions((prev) => [
      ...prev.filter(
        (session) => !(session.programId === selectedProgram.id && session.memberId === selectedMember.id)
      ),
      ...importedSessions,
    ]);

    if (typeof window !== "undefined") {
      if (selectedProgram.id === "program-1") {
        window.localStorage.setItem(STORAGE_KEYS.seeded, "true");
      }
      if (selectedProgram.id === "program-2") {
        window.localStorage.setItem(STORAGE_KEYS.seededProgram2, "true");
      }
      if (selectedProgram.id === "program-3") {
        window.localStorage.setItem(STORAGE_KEYS.seededProgram3, "true");
      }
    }
  };

  const clearStoredSessions = () => {
    setSavedSessions([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STORAGE_KEYS.savedSessions);
      window.localStorage.removeItem(STORAGE_KEYS.seeded);
      window.localStorage.removeItem(STORAGE_KEYS.seededProgram2);
      window.localStorage.removeItem(STORAGE_KEYS.seededProgram3);
    }
  };

  const pathItems = useMemo(() => {
    if (role === "admin" && screen === "members") {
      return [{ label: "Admin" }, { label: "Client List" }];
    }
    if (role === "admin" && screen === "memberOverview") {
      return [{ label: "Admin", onClick: goAdminMembers }, { label: "Client List", onClick: goAdminMembers }, ...(selectedMember ? [{ label: selectedMember.name }] : [])];
    }
    if (role === "admin" && screen === "adminPrograms") {
      return [{ label: "Admin", onClick: goAdminMembers }, { label: "Client List", onClick: goAdminMembers }, ...(selectedMember ? [{ label: selectedMember.name, onClick: () => setScreen("memberOverview") }] : []), { label: "All Programs" }];
    }
    if (role === "admin" && screen === "builder") {
      return [{ label: "Admin", onClick: goAdminMembers }, { label: "Client List", onClick: goAdminMembers }, ...(selectedMember ? [{ label: selectedMember.name, onClick: () => setScreen("memberOverview") }] : []), ...(selectedProgram ? [{ label: selectedProgram.name, onClick: builderSource === "memberOverview" ? (() => setScreen("memberOverview")) : goAdminPrograms }] : [{ label: "Build a Program" }]), ...(selectedRoutine ? [{ label: selectedRoutine.label }] : [])];
    }
    if (role === "admin" && screen === "input") {
      return [{ label: "Admin" }, { label: "Data Input" }, ...(selectedProgram ? [{ label: selectedProgram.name }] : []), ...(selectedRoutine ? [{ label: selectedRoutine.label }] : [])];
    }
    if (role === "member" && screen === "programs") {
      return [{ label: "Member" }, { label: "My Programs" }];
    }
    if (role === "member" && screen === "routines") {
      return [{ label: "Member", onClick: goMemberPrograms }, { label: "My Programs", onClick: goMemberPrograms }, ...(selectedProgram ? [{ label: selectedProgram.name }] : [])];
    }
    if (role === "member" && screen === "routine") {
      return [{ label: "Member", onClick: goMemberPrograms }, { label: "My Programs", onClick: goMemberPrograms }, ...(selectedProgram ? [{ label: selectedProgram.name, onClick: () => setScreen("routines") }] : []), ...(selectedRoutine ? [{ label: selectedRoutine.label }] : [])];
    }
    if (role === "member" && screen === "graph") {
      return [{ label: "Member", onClick: goMemberPrograms }, { label: "My Programs", onClick: goMemberPrograms }, ...(selectedProgram ? [{ label: selectedProgram.name, onClick: () => setScreen("routines") }] : []), ...(selectedRoutine ? [{ label: selectedRoutine.label, onClick: () => setScreen("routine") }] : []), ...(selectedBlock ? [{ label: selectedBlock.title || "Graph" }] : [])];
    }
    return [];
  }, [role, screen, selectedMember, selectedProgram, selectedRoutine, selectedBlock, goAdminMembers, goAdminPrograms]);

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900 flex flex-col">
      <div className="relative z-0 bg-black">
        <div className="mx-auto flex h-[168px] w-full max-w-[430px] items-center justify-center overflow-visible">
          <img
            src={appBanner}
            alt="Pratt Report banner"
            className="w-[58%] max-w-[220px] translate-y-[-20px] object-contain"
          />
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-10 w-full max-w-[430px] flex-1 px-4">
        <div className="space-y-6 pb-10">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</div>
                  </div>

                  <div className="flex flex-nowrap gap-2">
                    <ToggleButton className="flex-1 whitespace-nowrap px-2 text-center text-xs" active={role === "admin" && (screen === "members" || screen === "memberOverview" || screen === "adminPrograms" || screen === "builder")} onClick={goAdminMembers}>Client List</ToggleButton>
                    <ToggleButton className="flex-1 whitespace-nowrap px-2 text-center text-xs" active={role === "admin" && screen === "input"} onClick={goAdminInput}>Admin Input</ToggleButton>
                    <ToggleButton className="flex-1 whitespace-nowrap px-2 text-center text-xs" active={role === "member" && (screen === "programs" || screen === "routines" || screen === "routine" || screen === "graph")} onClick={goMemberPrograms}>Member View</ToggleButton>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {!!pathItems.length && <PathBar items={pathItems} />}
                {backLabel ? (
                  <div>
                    <SmallButton onClick={goBack} className="shrink-0">← {backLabel}</SmallButton>
                  </div>
                ) : null}
              </div>

              {role === "admin" && screen === "members" && (
                <SectionCard title="Client List" collapsible>
                  <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                    <div className="space-y-3">
                      <div>
                        <Label>Search Client List</Label>
                        <TextInput value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search by name or ID" />
                      </div>
                      <div className="flex gap-2 text-sm">
                        <button
                          onClick={() => {
                            setViewArchivedMembers(false);
                            setShowAllMembers(false);
                          }}
                          className={`rounded-full border px-3 py-1 ${!viewArchivedMembers ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
                        >
                          Active
                        </button>
                        <button
                          onClick={() => {
                            setViewArchivedMembers(true);
                            setShowAllMembers(false);
                          }}
                          className={`rounded-full border px-3 py-1 ${viewArchivedMembers ? "bg-zinc-900 text-white" : "bg-white text-zinc-700"}`}
                        >
                          Archived
                        </button>
                      </div>
                    </div>
                    <div className="self-end flex gap-2">
                      <PrimaryButton onClick={addMember}>+ Add Client</PrimaryButton>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    {filteredMembers.map((member) => (
                      <div key={member.id} className="rounded-2xl border border-zinc-200 bg-white p-4 text-left transition">
                        <button onClick={() => openMemberOverview(member.id)} className="w-full text-left">
                          <div className="font-semibold text-zinc-900">{member.name}</div>
                        </button>
                        <div className="mt-3 flex gap-2">
                          {member.archived ? (
                            <SmallButton onClick={() => restoreMember(member.id)}>Restore</SmallButton>
                          ) : (
                            <>
                              <SmallButton onClick={() => archiveMember(member.id)}>Archive</SmallButton>
                              <SmallButton onClick={() => removeMember(member.id)} className="border-red-200 bg-red-600 text-white hover:bg-red-700">Delete</SmallButton>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {!memberSearch.trim() && !showAllMembers && members.filter((member) => (viewArchivedMembers ? Boolean(member.archived) : !member.archived)).length > 10 ? (
                    <div className="mt-4">
                      <SmallButton onClick={() => setShowAllMembers(true)}>Show All Clients</SmallButton>
                    </div>
                  ) : null}
                </SectionCard>
              )}

              {role === "admin" && screen === "memberOverview" && selectedMember && (
                <div className="space-y-6">
                  <SectionCard title="Client Overview" collapsible>
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex-1 space-y-3">
                            {isEditingMember ? (
                              <>
                                <div>
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Name</div>
                                  <input
                                    value={editedMemberName}
                                    onChange={(event) => setEditedMemberName(event.target.value)}
                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                                  />
                                </div>
                                <div>
                                  <div className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-zinc-500">Client ID</div>
                                  <input
                                    value={editedMemberClientId}
                                    onChange={(event) => setEditedMemberClientId(event.target.value)}
                                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 outline-none transition focus:border-zinc-500"
                                  />
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="text-sm font-semibold text-zinc-900">{selectedMember.name}</div>
                                <div className="text-xs text-zinc-500">Client ID {selectedMember.clientId}</div>
                              </>
                            )}
                          </div>

                          <div className="flex shrink-0 gap-2">
                            {isEditingMember ? (
                              <>
                                <SmallButton
                                  onClick={() => {
                                    const nextName = editedMemberName.trim();
                                    const nextClientId = editedMemberClientId.trim();
                                    if (!nextName || !nextClientId) return;

                                    setMembers((current) =>
                                      current.map((member) =>
                                        member.id === selectedMember.id
                                          ? { ...member, name: nextName, clientId: nextClientId }
                                          : member
                                      )
                                    );
                                    setIsEditingMember(false);
                                  }}
                                >
                                  Save
                                </SmallButton>
                                <SmallButton
                                  onClick={() => {
                                    setEditedMemberName(selectedMember.name);
                                    setEditedMemberClientId(selectedMember.clientId);
                                    setIsEditingMember(false);
                                  }}
                                >
                                  Cancel
                                </SmallButton>
                              </>
                            ) : (
                              <SmallButton onClick={() => setIsEditingMember(true)}>Edit</SmallButton>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="text-sm font-semibold text-zinc-900">Active Program</div>
                          {activeAdminProgram ? (
                            <>
                              <div className="mt-2 text-sm font-medium text-zinc-700">{activeAdminProgram.name}</div>
                              <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-zinc-600">
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                                  <div className="font-semibold text-zinc-900">{activeAdminProgram.routines.length}</div>
                                  <div>Routines</div>
                                </div>
                                <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                                  <div className="font-semibold text-zinc-900">{getProgramBlockCount(activeAdminProgram)}</div>
                                  <div>Total Blocks</div>
                                </div>
                              </div>
                              <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm text-zinc-600">
                                {String(activeAdminProgram.notes || "").trim() || "No program notes yet."}
                              </div>
                              <PrimaryButton
                                onClick={() => {
                                  setSelectedProgramId(activeAdminProgram.id);
                                  setSelectedRoutineId(activeAdminProgram.routines[0]?.id || null);
                                  setBuilderSource("memberOverview");
                                  setScreen("builder");
                                }}
                                className="mt-3 w-full"
                              >
                                Open Active Program
                              </PrimaryButton>
                            </>
                          ) : (
                            <div className="mt-2 text-sm text-zinc-500">No Active Program</div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="text-sm font-semibold text-zinc-900">All Programs</div>
                          <div className="mt-2 text-sm text-zinc-600">View every program for this member and start a new one.</div>
                          <PrimaryButton onClick={goAdminPrograms} className="mt-3 w-full">
                            View All Programs
                          </PrimaryButton>
                        </div>
                      </div>
                    </div>
                  </SectionCard>
                </div>
              )}

              {role === "admin" && screen === "adminPrograms" && selectedMember && (
                <div className="space-y-6">
                  <SectionCard title="All Programs" collapsible>
                    <div className="space-y-3">
                      <PrimaryButton
                        onClick={() => {
                          const nextProgramIndex = programs.length + 1;
                          const newProgram: Program = {
                            id: uid(),
                            name: `Program ${nextProgramIndex}`,
                            startedAt: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
                            status: "active",
                            routines: [createRoutine(0)],
                            notes: "",
                            memberId: selectedMember?.id,
                          };
                          setPrograms((prev) => [...prev, newProgram]);
                          setSelectedProgramId(newProgram.id);
                          setSelectedRoutineId(newProgram.routines[0]?.id || null);
                          setSelectedBlockId(newProgram.routines[0]?.blocks[0]?.id || null);
                          setBuilderSource("adminPrograms");
                          setScreen("builder");
                        }}
                        className="w-full"
                      >
                        + New Program
                      </PrimaryButton>

                      {adminSortedPrograms.map((program) => (
                        <div key={program.id} className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-3">
                            <button
                              onClick={() => {
                                setSelectedProgramId(program.id);
                                setSelectedRoutineId(program.routines[0]?.id || null);
                                setSelectedBlockId(program.routines[0]?.blocks[0]?.id || null);
                                setBuilderSource("adminPrograms");
                                setScreen("builder");
                              }}
                              className="text-left"
                            >
                              <div className="font-semibold text-zinc-900">{program.name}</div>
                              <div className="text-sm text-zinc-500">Started {program.startedAt}</div>
                            </button>
                            <div className={`text-xs font-semibold uppercase tracking-wide ${
                              program.status === "active"
                                ? "text-blue-600"
                                : program.status === "paused"
                                  ? "text-amber-600"
                                  : "text-zinc-400"
                            }`}>
                              {program.status === "active" ? "Active" : program.status === "paused" ? "Paused" : "Completed"}
                            </div>
                          </div>
                          <div className="mt-3 flex gap-2">
                            {program.status !== "closed" ? (
                              <SmallButton
                                onClick={() => {
                                  setPrograms((prev) =>
                                    prev.map((item) =>
                                      item.id === program.id
                                        ? { ...item, status: item.status === "paused" ? "active" : "paused" }
                                        : item
                                    )
                                  );
                                }}
                              >
                                {program.status === "paused" ? "Resume" : "Pause"}
                              </SmallButton>
                            ) : null}

                            {program.status === "active" ? (
                              <SmallButton
                                onClick={() => {
                                  const confirmClose = window.confirm("Are you sure you want to close this program? This action cannot be undone.");
                                  if (!confirmClose) return;
                                  setPrograms((prev) => prev.map((item) => item.id === program.id ? { ...item, status: "closed" } : item));
                                }}
                                className="border-red-200 bg-red-600 text-white hover:bg-red-700"
                              >
                                Close
                              </SmallButton>
                            ) : (
                              <SmallButton
                                onClick={() => {
                                  const confirmDelete = window.confirm("Are you sure you want to delete this program? This action cannot be undone.");
                                  if (!confirmDelete) return;
                                  setPrograms((prev) => prev.filter((item) => item.id !== program.id));
                                  if (selectedProgramId === program.id) {
                                    setSelectedProgramId(null);
                                  }
                                }}
                                className="border-red-200 bg-red-600 text-white hover:bg-red-700"
                              >
                                Delete
                              </SmallButton>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              )}

              {role === "admin" && screen === "builder" && (
                <div className="space-y-6">
                  {selectedProgram ? (
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
                      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Program Summary</div>
                      <div className="mt-2 text-lg font-semibold text-zinc-900">{selectedProgram.name}</div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm text-zinc-600">
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <div className="text-base font-semibold text-zinc-900">{selectedProgram.routines.length}</div>
                          <div>Routines</div>
                        </div>
                        <div className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2">
                          <div className="text-base font-semibold text-zinc-900">{getProgramBlockCount(selectedProgram)}</div>
                          <div>Total Blocks</div>
                        </div>
                      </div>
                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm text-zinc-600">
                        <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">Notes</div>
                        <div>{String(selectedProgram.notes || "").trim() || "No program notes yet."}</div>
                      </div>
                    </div>
                  ) : null}

                  <SectionCard title="Build a Program" collapsible>
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-600">Program Structure creates and manages routines. Routine Builder organizes block order. Program Details holds the overall program info and notes.</div>
                      {selectedProgram ? (
                        <div className="grid gap-3">
                          <div>
                            <Label>Program Name</Label>
                            <TextInput
  value={selectedProgram.name}
  onChange={(e) =>
    updatePrograms((current) =>
      current.map((p) =>
        p.id === selectedProgram.id ? { ...p, name: e.target.value } : p
      )
    )
  }
/>
                          </div>
                          <div>
                            <Label>Program Started Date</Label>
                            <TextInput
  value={selectedProgram.startedAt}
  onChange={(e) =>
    updatePrograms((current) =>
      current.map((p) =>
        p.id === selectedProgram.id ? { ...p, startedAt: e.target.value } : p
      )
    )
  }
/>
                          </div>
                          <div>
                            <Label>Program Notes</Label>
                            <TextArea
  value={selectedProgram.notes || ""}
  onChange={(e) =>
    updatePrograms((current) =>
      current.map((p) =>
        p.id === selectedProgram.id ? { ...p, notes: e.target.value } : p
      )
    )
  }
  rows={3}
  placeholder="Program focuses upper body, conditioning, etc."
/>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </SectionCard>

                  <SectionCard title="Program Structure" collapsible defaultOpen={false}>
                    <div className="space-y-3">
                      <PrimaryButton onClick={addRoutine} className="w-full">+ Routine</PrimaryButton>
                      <div className="space-y-2">
                        {selectedProgram?.routines.map((routine) => (
                          <div key={routine.id} className="rounded-2xl border border-zinc-200 bg-white p-2">
                            <button onClick={() => setSelectedRoutineId(routine.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedRoutine?.id === routine.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-900 hover:bg-zinc-50"}`}>
                              <div className="font-semibold">{routine.label}</div>
                              <div className={`text-xs ${selectedRoutine?.id === routine.id ? "text-zinc-300" : "text-zinc-500"}`}>{routine.blocks.length} blocks</div>
                            </button>
                            <div className="mt-2 flex justify-end">
                              <SmallButton onClick={() => deleteRoutine(routine.id)} className="border-red-200 bg-red-600 text-white hover:bg-red-700">Delete Routine</SmallButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title={selectedRoutine ? `${selectedRoutine.label} Builder` : "Routine Builder"} collapsible defaultOpen={false}>
                    {selectedRoutine ? (
                      <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto_auto]">
                          <div>
                            <Label>Routine Label</Label>
                            <TextInput value={selectedRoutine.label} onChange={(e) => updateRoutine(selectedRoutine.id, { label: e.target.value })} />
                          </div>
                          <div className="self-end">
                            <SmallButton onClick={() => addBlock(selectedRoutine.id, "paired")}>+ Paired Block</SmallButton>
                          </div>
                          <div className="self-end">
                            <SmallButton onClick={() => addBlock(selectedRoutine.id, "single")}>+ Single Block</SmallButton>
                          </div>
                          <div className="self-end">
                            <SmallButton
                              onClick={() => {
                                const confirmReset = window.confirm("Delete all blocks in this routine and start fresh?");
                                if (!confirmReset) return;
                                updateRoutine(selectedRoutine.id, { blocks: [] });
                              }}
                              className="border-red-200 bg-red-600 text-white hover:bg-red-700"
                            >
                              Clear Blocks
                            </SmallButton>
                          </div>
                        </div>

                        <div className="space-y-4">
                          {selectedRoutine.blocks.map((block, index) => (
                            <div key={block.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-zinc-500">Block {index + 1}</div>
                                <div className="flex flex-wrap gap-2">
                                  <SmallButton onClick={() => moveBlock(selectedRoutine.id, block.id, "up")} disabled={index === 0}>Move Up</SmallButton>
                                  <SmallButton onClick={() => moveBlock(selectedRoutine.id, block.id, "down")} disabled={index === selectedRoutine.blocks.length - 1}>Move Down</SmallButton>
                                  <SmallButton onClick={() => deleteBlock(selectedRoutine.id, block.id)} className="border-red-200 bg-red-600 text-white hover:bg-red-700">Delete Block</SmallButton>
                                </div>
                              </div>

                              <div className="mb-4 grid gap-3 md:grid-cols-3">
                                <div>
                                  <Label>Block Title</Label>
                                  <TextInput value={block.title} onChange={(e) => updateBlock(selectedRoutine.id, block.id, { title: e.target.value })} />
                                </div>
                                <div>
                                  <Label>Block Type</Label>
                                  <div className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">{block.type === "paired" ? "Paired Block" : "Single Block"}</div>
                                </div>
                                <div>
                                  <Label>Duration</Label>
                                  <TextInput value={block.duration} onChange={(e) => updateBlock(selectedRoutine.id, block.id, { duration: e.target.value })} placeholder="10 minutes" />
                                </div>
                              </div>

                              <div className="mb-4">
                                <Label>Screen Tip / Notes</Label>
                                <TextArea value={block.notes} onChange={(e) => updateBlock(selectedRoutine.id, block.id, { notes: e.target.value })} rows={3} placeholder="Add notes or screen tips here" />
                              </div>

                              <div className={`grid gap-3 ${block.type === "paired" ? "md:grid-cols-2" : "md:grid-cols-1"}`}>
                                {block.exercises.map((exercise) => (
                                  <div key={exercise.id} className="rounded-2xl border border-zinc-200 bg-white p-3">
                                    <div className="space-y-3">
                                      <div>
                                        <Label>Exercise Name</Label>
                                        <TextInput value={exercise.name} onChange={(e) => updateExercise(selectedRoutine.id, block.id, exercise.id, { name: e.target.value })} />
                                      </div>
                                      <div className="grid grid-cols-2 gap-3">
                                        <div>
                                          <Label>Target</Label>
                                          <TextInput value={exercise.target} onChange={(e) => updateExercise(selectedRoutine.id, block.id, exercise.id, { target: e.target.value })} />
                                        </div>
                                        <div>
                                          <Label>Metric</Label>
                                          <TextInput value={exercise.metric} onChange={(e) => updateExercise(selectedRoutine.id, block.id, exercise.id, { metric: e.target.value })} />
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-zinc-500">Select a routine to begin editing.</div>
                    )}
                  </SectionCard>
                </div>
              )}

              {role === "admin" && screen === "input" && (
                <SectionCard title="Admin Data Input" collapsible>
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">Builder sets the routine template: exercise names, targets, metrics, block duration, and screen tips. This input tab is where admin logs the actual session performance for a specific program, routine, and session number.</div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="mb-2 text-sm font-semibold text-zinc-900">Bulk Import Data</div>
                      <div className="mb-3 text-sm text-zinc-500">Paste cleaned relay-format text here to replace all saved sessions for the selected member.</div>
                      <TextArea value={importText} onChange={(e) => setImportText(e.target.value)} rows={16} />
                      <div className="mt-3 flex flex-wrap gap-2">
                        <PrimaryButton onClick={importProgramData}>Import Program Data</PrimaryButton>
                        <SmallButton onClick={clearStoredSessions}>Clear Stored Sessions</SmallButton>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="mb-2 text-sm font-semibold text-zinc-900">Relay Template</div>
                      <div className="mb-3 text-sm text-zinc-500">Use this format for future data handoff.</div>
                      <TextArea value={RELAY_TEMPLATE_TEXT} readOnly rows={18} />
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      <div>
                        <Label>Date</Label>
                        <TextInput value={sessionDraft?.date || ""} onChange={(e) => updateSessionDraftField("date", e.target.value)} placeholder="August 16, 2025" />
                      </div>
                      <div>
                        <Label>Routine</Label>
                        <div className="rounded-xl border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-700">{selectedRoutine?.label || "Select Routine"}</div>
                      </div>
                      <div>
                        <Label>Session #</Label>
                        <TextInput value={sessionDraft?.sessionNumber || ""} onChange={(e) => updateSessionDraftField("sessionNumber", e.target.value)} placeholder="16" />
                      </div>
                    </div>

                    {selectedRoutine && sessionDraft ? (
                      <div className="space-y-4">
                        {selectedRoutine.blocks.map((block) => {
                          const draftBlock = sessionDraft.blocks.find((entry) => entry.blockId === block.id);

                          return (
                            <div key={block.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="mb-3 text-base font-semibold text-zinc-900">{block.title}</div>
                              <div className="mb-3 text-sm text-zinc-500">Screen tip for this block: {block.notes || "No screen tip added yet."}</div>
                              {block.type === "paired" ? (
                                <div className="space-y-3">
                                  {block.exercises.map((exercise) => {
                                    const draftExercise = draftBlock?.entries.find((entry) => entry.exerciseId === exercise.id);

                                    return (
                                      <div key={exercise.id} className="grid gap-3 md:grid-cols-4">
                                        <TextInput value={exercise.name} readOnly />
                                        <TextInput
                                          type="text"
                                          inputMode="text"
                                          placeholder='Weight ("BW" or number)'
                                          value={draftExercise?.weight || ""}
                                          onChange={(e) => updateSessionExercise(block.id, exercise.id, "weight", e.target.value)}
                                        />
                                        <TextInput
                                          placeholder="Reps Per Set"
                                          value={draftExercise?.performance || ""}
                                          onChange={(e) => updateSessionExercise(block.id, exercise.id, "performance", e.target.value)}
                                        />
                                        <TextInput
                                          placeholder="Sets Completed"
                                          value={draftExercise?.setsCompleted || ""}
                                          onChange={(e) => updateSessionExercise(block.id, exercise.id, "setsCompleted", e.target.value)}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                <div className="grid gap-3 md:grid-cols-4">
                                  <TextInput value={block.exercises[0]?.name || "Exercise"} readOnly />
                                  <TextInput
                                    type="text"
                                    inputMode="text"
                                    placeholder='Weight ("BW" or number)'
                                    value={draftBlock?.entries[0]?.weight || ""}
                                    onChange={(e) => updateSessionExercise(block.id, block.exercises[0]?.id || "", "weight", e.target.value)}
                                  />
                                  <TextInput
                                    placeholder={`Metric / Target Per Set (${block.exercises[0]?.metric || "metric"})`}
                                    value={draftBlock?.entries[0]?.performance || ""}
                                    onChange={(e) => updateSessionExercise(block.id, block.exercises[0]?.id || "", "performance", e.target.value)}
                                  />
                                  <TextInput
                                    placeholder="Sets Completed"
                                    value={draftBlock?.entries[0]?.setsCompleted || ""}
                                    onChange={(e) => updateSessionExercise(block.id, block.exercises[0]?.id || "", "setsCompleted", e.target.value)}
                                  />
                                </div>
                              )}
                            </div>
                          );
                        })}

                        <div className="flex justify-end">
                          <PrimaryButton onClick={saveSession} disabled={!sessionDraft.date.trim() || !sessionDraft.sessionNumber.trim()}>
                            Save Session
                          </PrimaryButton>
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="mb-2 text-sm font-semibold text-zinc-900">Saved Session Preview</div>
                          {latestSavedSession ? (
                            <div className="space-y-3 text-sm text-zinc-700">
                              <div><span className="font-semibold">Date:</span> {latestSavedSession.date}</div>
                              <div><span className="font-semibold">Session #:</span> {latestSavedSession.sessionNumber}</div>
                              <div><span className="font-semibold">Routine:</span> {selectedRoutine?.label}</div>
                              <div className="space-y-2">
                                {latestSavedSession.blocks.map((block) => (
                                  <div key={block.blockId} className="rounded-xl bg-zinc-50 p-3">
                                    <div className="mb-1 font-medium text-zinc-900">{block.blockTitle}</div>
                                    <div className="space-y-1 text-zinc-600">
                                      {block.entries.map((entry) => (
                                        <div key={entry.exerciseId}>
                                          {entry.exerciseName}: {entry.weight || "—"} • {entry.performance || "—"} • {entry.setsCompleted || "—"}
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <div className="text-sm text-zinc-500">No saved session yet for this program/routine/member.</div>
                          )}
                        </div>

                        <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                          <div className="mb-2 flex items-center justify-between gap-3">
                            <div className="text-sm font-semibold text-zinc-900">Saved Session History</div>
                            <div className="text-xs text-zinc-500">Newest first</div>
                          </div>
                          {matchingSavedSessions.length ? (
                            <div className="space-y-3">
                              {matchingSavedSessions.map((session) => (
                                <div key={session.id} className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm text-zinc-700">
                                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                                    <div className="font-medium text-zinc-900">Session #{session.sessionNumber}</div>
                                    <div className="text-xs text-zinc-500">{session.date}</div>
                                  </div>
                                  <div className="space-y-2">
                                    {session.blocks.map((block) => (
                                      <div key={block.blockId} className="rounded-lg bg-white p-2">
                                        <div className="mb-1 text-sm font-medium text-zinc-900">{block.blockTitle}</div>
                                        <div className="space-y-1 text-zinc-600">
                                          {block.entries.map((entry) => (
                                            <div key={entry.exerciseId}>
                                              {entry.exerciseName}: {entry.weight || "—"} • {entry.performance || "—"} • {entry.setsCompleted || "—"}
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-sm text-zinc-500">No saved session history yet for this program/routine/member.</div>
                          )}
                        </div>

                        {selectedRoutine.blocks.length > 1 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => stepGraphBlock("previous")}
                              disabled={!canGoToPreviousBlock}
                              aria-label="Previous graph"
                              className="absolute left-0.5 top-1/2 flex h-11 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300/35 bg-white/30 text-xl text-zinc-700 shadow-sm backdrop-blur-[1px] sm:hidden disabled:pointer-events-none disabled:opacity-20"
                            >
                              ‹
                            </button>
                            <button
                              type="button"
                              onClick={() => stepGraphBlock("next")}
                              disabled={!canGoToNextBlock}
                              aria-label="Next graph"
                              className="absolute right-0.5 top-1/2 flex h-11 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300/35 bg-white/30 text-xl text-zinc-700 shadow-sm backdrop-blur-[1px] sm:hidden disabled:pointer-events-none disabled:opacity-20"
                            >
                              ›
                            </button>
                          </>
                        ) : null}
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No routine selected yet.</div>
                    )}
                  </div>
                </SectionCard>
              )}

              {role === "member" && screen === "programs" && (
                <SectionCard title="My Programs" collapsible>
                  <div className="space-y-3">
                    <div className="text-sm text-zinc-600">Members start here and open the most recent program first.</div>
                    <div className="space-y-3">
                      {adminSortedPrograms.map((program) => (
                        <button key={program.id} onClick={() => openProgram(program.id)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-semibold">{program.name}</div>
                              <div className="text-sm text-zinc-500">Started {program.startedAt}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</div>
                              <div className="text-sm font-medium text-zinc-600">{program.status === "closed" ? "Completed" : "In Progress"}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              )}

              {role === "member" && screen === "routines" && selectedProgram && (
                <SectionCard title={`${selectedProgram.name} Routines`}>
                  <div className="space-y-3">
                    <div className="text-sm text-zinc-600">Members choose a routine inside the selected program.</div>
                    <div className="space-y-3">
                      {selectedProgram.routines.map((routine) => (
                        <button key={routine.id} onClick={() => openRoutine(routine.id)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="text-lg font-semibold">{routine.label}</div>
                              <div className="text-sm text-zinc-500">{routine.blocks.length} blocks</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Status</div>
                              <div className="text-sm font-medium text-zinc-600">{selectedMember?.programClosed ? "Completed" : "In Progress"}</div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </SectionCard>
              )}

              {role === "member" && screen === "routine" && selectedRoutine && (
                <SectionCard title={selectedRoutine.label}>
                  <div className="space-y-3">
                    {selectedRoutine.blocks.map((block) => (
                      <button key={block.id} onClick={() => openGraph(selectedRoutine.id, block.id)} className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-left transition hover:border-zinc-400 hover:bg-white">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-semibold">{block.title}</div>
                            <div className="mt-2 space-y-1 text-sm text-zinc-600">
                              {block.exercises.map((exercise) => (
                                <div key={exercise.id}>{exercise.name} — Target: {exercise.target || "—"} {exercise.metric || ""}</div>
                              ))}
                            </div>
                            {!!block.notes && <div className="mt-3 text-sm text-zinc-500">{block.notes}</div>}
                          </div>
                          <div className="text-sm font-medium text-zinc-600">Tap to view graph</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </SectionCard>
              )}

              {role === "member" && screen === "graph" && selectedRoutine && selectedBlock && (
                <SectionCard title={`${selectedRoutine.label} • ${selectedBlock.title}`}>
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Label>X-Axis</Label>
                      <ToggleButton active={graphAxis === "date"} onClick={() => setGraphAxis("date")}>By Date</ToggleButton>
                      <ToggleButton active={graphAxis === "session"} onClick={() => setGraphAxis("session")}>By Session #</ToggleButton>
                    </div>

                    {selectedRoutine.blocks.length > 1 ? (
                      <div className="hidden sm:flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                        <button
                          type="button"
                          onClick={() => stepGraphBlock("previous")}
                          disabled={!canGoToPreviousBlock}
                          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35"
                        >
                          ← Previous
                        </button>
                        <div className="min-w-0 text-center">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{selectedGraphPositionLabel}</div>
                          <div className="truncate text-sm font-semibold text-zinc-900">{selectedBlock.title}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => stepGraphBlock("next")}
                          disabled={!canGoToNextBlock}
                          className="rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 shadow-sm transition hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35"
                        >
                          Next →
                        </button>
                      </div>
                    ) : null}

                    <div className="graph-ui-lock space-y-4 rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="graph-select-none" style={{ minHeight: graphLegendItems.length > 2 ? 112 : graphLegendItems.length === 1 ? 96 : 76 }}>
                        <style>{GRAPH_UI_LOCK_CSS}</style>
                        <div className="mb-2 text-sm font-semibold text-zinc-900 select-none">Exercise Key</div>
                        {graphLegendItems.length ? (
                          <div className="flex flex-wrap gap-2 text-sm text-zinc-700">
                            {graphLegendItems.map((item) => {
                              const isActive = item.exerciseName === activeExerciseName;

                              return (
                              <button
                                type="button"
                                key={item.exerciseId}
                                onClick={() => setActiveExerciseName(item.exerciseName)}
                                className={`graph-select-none inline-flex select-none items-center gap-2 rounded-full border px-3 py-1.5 text-left transition ${isActive ? "border-zinc-400 bg-zinc-100 shadow-sm" : "border-zinc-200 bg-zinc-50"}`}
                              >
                                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                                  <line
                                    x1="2"
                                    y1="10"
                                    x2="18"
                                    y2="10"
                                    stroke={item.stroke}
                                    strokeWidth="2"
                                    strokeDasharray={item.dash}
                                  />
                                  {item.shape === "triangle" ? (
                                    <polygon points="10,4 5,14 15,14" fill={item.stroke} stroke={item.stroke} strokeWidth="1.25" />
                                  ) : item.shape === "diamond" ? (
                                    <polygon points="10,3 17,10 10,17 3,10" fill={item.stroke} stroke={item.stroke} strokeWidth="1.25" />
                                  ) : item.shape === "square" ? (
                                    <rect x="6" y="6" width="8" height="8" rx="1.5" fill={item.stroke} stroke={item.stroke} strokeWidth="1.25" />
                                  ) : (
                                    <circle cx="10" cy="10" r="4" fill={item.stroke} stroke={item.stroke} strokeWidth="1.25" />
                                  )}
                                </svg>
                                <span>{item.exerciseName}</span>
                                {item.isChangedMidRoutine ? <span className="text-xs text-zinc-500">(changed)</span> : null}
                              </button>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-500 select-none">No exercise key data yet.</div>
                        )}
                      </div>

                      {chartSeries.length ? (
                        <div
                          className="graph-select-none relative select-none rounded-2xl border border-zinc-200 bg-white p-2 sm:p-2.5"
                          onMouseDown={(event) => {
                            if (event.target instanceof HTMLElement || event.target instanceof SVGElement) {
                              event.preventDefault();
                            }
                          }}
                          onDragStart={(event) => event.preventDefault()}
                        >
                          <div className="graph-select-none h-[320px] w-full touch-pan-x">
                            <ResponsiveContainer width="100%" height="100%">
                              <LineChart
                                margin={{ top: 36, right: 6, left: -4, bottom: 8 }}
                                onMouseMove={(state: any) => {
                                  if (!state?.isTooltipActive) return;
                                  const point = state?.activePayload?.[0]?.payload as ChartPoint | undefined;
                                  if (point) {
                                    setLastHoveredGraphPoint(point);
                                    setActiveExerciseName(point.exerciseName);
                                  }
                                }}
                                onMouseLeave={() => setLastHoveredGraphPoint(null)}
                              >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                <XAxis
                                  type="number"
                                  dataKey="chartX"
                                  ticks={xAxisTicks}
                                  domain={xAxisDomain}
                                  tickFormatter={(value) => xAxisLabelMap.get(Number(value)) || ""}
                                  angle={0}
                                  textAnchor="middle"
                                  height={28}
                                  tick={{ fontSize: graphAxis === "date" ? 10 : 11 }}
                                  tickMargin={6}
                                  allowDecimals={false}
                                />
                                <YAxis
                                  type="number"
                                  domain={yDomain}
                                  ticks={yAxisTicks}
                                  tickCount={Math.max(4, Math.min(8, yDomain[1] - yDomain[0] + 1))}
                                  allowDecimals={selectedBlock?.type === "single"}
                                  width={34}
                                  tick={selectedBlock?.type === "paired" ? <GraphYAxisTick /> : { fontSize: 10 }}
                                  tickMargin={2}
                                  label={{ value: "Completed Output", angle: -90, position: "insideLeft", style: { fontSize: 11 }, dx: -1 }}
                                />
                                <Tooltip content={<GraphTooltip />} position={tooltipPosition} cursor={false} shared={false} />
                                {displayChartSeries.map((series) => (
                                  <Line
                                    key={series.exerciseId}
                                    type="linear"
                                    data={series.points}
                                    dataKey="y"
                                    name={series.exerciseName}
                                    xAxisId={0}
                                    yAxisId={0}
                                    stroke={series.stroke}
                                    strokeWidth={2}
                                    strokeDasharray={series.dash}
                                    style={{ pointerEvents: "none" }}
                                    dot={(props) => {
                                      const point = props.payload as ChartPoint;
                                      return (
                                        <g
                                          data-graph-dot="true"
                                          style={{ pointerEvents: "auto", cursor: "pointer" }}
                                          onMouseEnter={() => {
                                            setLastHoveredGraphPoint(point);
                                            setActiveExerciseName(point.exerciseName);
                                          }}
                                          onTouchStart={() => {
                                            setLastHoveredGraphPoint(point);
                                            setActiveExerciseName(point.exerciseName);
                                          }}
                                          onTouchMove={() => {
                                            setLastHoveredGraphPoint(point);
                                            setActiveExerciseName(point.exerciseName);
                                          }}
                                        >
                                          <ExerciseDot
                                            {...props}
                                            payload={point}
                                            shape={series.shape as "circle" | "square" | "triangle" | "diamond"}
                                          />
                                        </g>
                                      );
                                    }}
                                    activeDot={(props) => {
                                      const point = props.payload as ChartPoint;
                                      return (
                                        <g data-graph-dot="true" style={{ pointerEvents: "auto" }}>
                                          <ExerciseDot
                                            {...props}
                                            payload={point}
                                            shape={series.shape as "circle" | "square" | "triangle" | "diamond"}
                                          />
                                        </g>
                                      );
                                    }}
                                    isAnimationActive={false}
                                    connectNulls={false}
                                  />
                                ))}
                              </LineChart>
                            </ResponsiveContainer>
                          </div>

                          {selectedRoutine.blocks.length > 1 ? (
                            <>
                              <button
                                type="button"
                                onClick={() => stepGraphBlock("previous")}
                                disabled={!canGoToPreviousBlock}
                                aria-label="Previous graph"
                                className="absolute left-0.5 top-1/2 flex h-11 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300/35 bg-white/30 text-xl text-zinc-700 shadow-sm backdrop-blur-[1px] sm:hidden disabled:pointer-events-none disabled:opacity-20"
                              >
                                ‹
                              </button>
                              <button
                                type="button"
                                onClick={() => stepGraphBlock("next")}
                                disabled={!canGoToNextBlock}
                                aria-label="Next graph"
                                className="absolute right-0.5 top-1/2 flex h-11 w-14 -translate-y-1/2 items-center justify-center rounded-full border border-zinc-300/35 bg-white/30 text-xl text-zinc-700 shadow-sm backdrop-blur-[1px] sm:hidden disabled:pointer-events-none disabled:opacity-20"
                              >
                                ›
                              </button>
                            </>
                          ) : null}
                        </div>
                      ) : (
                        <div className="graph-select-none rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500 select-none">
                          No graph data yet for this block.
                        </div>
                      )}

                      <div className="graph-select-none" style={{ minHeight: graphLegendItems.length > 2 ? 112 : graphLegendItems.length === 1 ? 96 : 76 }}>
                        <div className="mb-2 text-sm font-semibold text-zinc-900 select-none">Weight Key</div>
                        {weightLegendItems.length ? (
                          <div className="flex flex-wrap gap-2 text-sm text-zinc-700">
                            {weightLegendItems.map((item) => (
                              <div key={item.key} className="graph-select-none inline-flex select-none items-center gap-2 rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5">
                                <svg width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
                                  {item.shape === "triangle" ? (
                                    <polygon points="8,3 4,13 12,13" fill={item.color} stroke={item.color} strokeWidth="1.25" />
                                  ) : item.shape === "diamond" ? (
                                    <polygon points="8,2 14,8 8,14 2,8" fill={item.color} stroke={item.color} strokeWidth="1.25" />
                                  ) : item.shape === "square" ? (
                                    <rect x="4" y="4" width="8" height="8" rx="1.5" fill={item.color} stroke={item.color} strokeWidth="1.25" />
                                  ) : (
                                    <circle cx="8" cy="8" r="4" fill={item.color} stroke={item.color} strokeWidth="1.25" />
                                  )}
                                </svg>
                                <span>{item.label}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-500 select-none">No weight key data yet.</div>
                        )}
                      </div>
                    </div>

                    <GraphInsightCard insight={generatedWorkoutSummaryInsight} />

                    {selectedRoutine.blocks.length > 1 ? (
                      <div className="sticky bottom-3 z-20 hidden sm:flex items-center justify-between gap-3 rounded-2xl border border-zinc-300 bg-white/95 p-3 shadow-lg backdrop-blur">
                        <button
                          type="button"
                          onClick={() => stepGraphBlock("previous")}
                          disabled={!canGoToPreviousBlock}
                          className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35"
                          title={previousGraphBlockTitle ? `Previous: ${previousGraphBlockTitle}` : "Previous graph"}
                        >
                          ← Previous Graph
                        </button>
                        <div className="min-w-0 text-center">
                          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">{selectedGraphPositionLabel}</div>
                          <div className="truncate text-sm font-semibold text-zinc-900">{selectedBlock.title}</div>
                        </div>
                        <button
                          type="button"
                          onClick={() => stepGraphBlock("next")}
                          disabled={!canGoToNextBlock}
                          className="rounded-xl border border-zinc-300 bg-zinc-50 px-4 py-2 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 disabled:pointer-events-none disabled:opacity-35"
                          title={nextGraphBlockTitle ? `Next: ${nextGraphBlockTitle}` : "Next graph"}
                        >
                          Next Graph →
                        </button>
                      </div>
                    ) : null}
                  </div>
                </SectionCard>
              )}
          </div>
      </div>

      <div className="mt-auto px-4 pb-6 text-center text-xs text-zinc-500">
        Prototype v2 • Phase 5 — persistent storage, bulk import, collapsible sections
      </div>
    </div>
  );
}
