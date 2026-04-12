type BlockType = "paired" | "single";

type ProgramDefinition = {
  id: string;
  name: string;
  startedAt?: string;
  status?: "active" | "closed" | "archived";
  routines: RoutineDefinition[];
};

type RoutineDefinition = {
  id: string;
  label: string;
  order: number;
  blocks: BlockDefinition[];
};

type BlockDefinition = {
  id: string;
  label: string;
  order: number;
  type: BlockType;
  durationMinutes?: number;
  notes?: string;
  slots: ExerciseSlotDefinition[];
};

type ExerciseSlotDefinition = {
  id: string;
  order: number;
  lineStyle: "solid" | "dashed";
  baseShape: "circle" | "square" | "triangle" | "diamond";
  allowedExercises: ExerciseDefinition[];
};

type ExerciseDefinition = {
  id: string;
  name: string;
  targetLabel: string;
  metric: string;
  shapeOverride?: "circle" | "square" | "triangle" | "diamond";
};
type RoutineDefinition = {
  id: string;
  label: string;
  order: number;
  blocks: BlockDefinition[];
};

type BlockDefinition = {
  id: string;
  label: string;
  order: number;
  type: BlockType;
  durationMinutes?: number;
  notes?: string;
  slots: ExerciseSlotDefinition[];
};

type ExerciseSlotDefinition = {
  id: string;
  order: number;
  lineStyle: "solid" | "dashed";
  baseShape: "circle" | "square" | "triangle" | "diamond";
  allowedExercises: ExerciseDefinition[];
};

type ExerciseDefinition = {
  id: string;
  name: string;
  targetLabel: string;
  metric: string;
  shapeOverride?: "circle" | "square" | "triangle" | "diamond";
};

type SessionRecord = {
  id: string;
  memberId: string;
  programId: string;
  routineId: string;
  sessionNumber: number;
  date: string;
  createdAt: string;
  blockResults: BlockResult[];
};

type BlockResult = {
  blockId: string;
  slotResults: SlotResult[];
};

type SlotResult = {
  slotId: string;
  exerciseId: string;
  exerciseNameSnapshot: string;
  weight: string;
  setsCompleted?: number;
  performance?: number;
};

type Member = {
  id: string;
  name: string;
  createdAt: string;
};

// ---------- STORAGE KEYS ----------

const PROGRAM_STORAGE_KEY = "workout-app-program-definitions-v2";
const SESSION_STORAGE_KEY = "workout-app-session-records-v2";
const MEMBER_STORAGE_KEY = "workout-app-members-v2";

// ---------- STORAGE HELPERS ----------

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- ID HELPERS ----------

const makeExercise = (
  id: string,
  name: string,
  targetLabel: string,
  metric: string,
  shapeOverride?: "circle" | "square" | "triangle" | "diamond"
): ExerciseDefinition => ({
  id,
  name,
  targetLabel,
  metric,
  ...(shapeOverride ? { shapeOverride } : {}),
});

const makeSlot = (
  id: string,
  order: number,
  lineStyle: "solid" | "dashed",
  baseShape: "circle" | "square" | "triangle" | "diamond",
  allowedExercises: ExerciseDefinition[]
): ExerciseSlotDefinition => ({
  id,
  order,
  lineStyle,
  baseShape,
  allowedExercises,
});

const makeBlock = (
  id: string,
  label: string,
  order: number,
  type: BlockType,
  durationMinutes: number,
  slots: ExerciseSlotDefinition[]
): BlockDefinition => ({
  id,
  label,
  order,
  type,
  durationMinutes,
  slots,
});

const makeRoutine = (
  id: string,
  label: string,
  order: number,
  blocks: BlockDefinition[]
): RoutineDefinition => ({
  id,
  label,
  order,
  blocks,
});

// ---------- PROGRAM 1 DEFINITION ----------

const PROGRAM_1: ProgramDefinition = {
  id: "program-1",
  name: "Program 1",
  startedAt: "2025-07-25",
  status: "active",
  routines: [
    makeRoutine("program-1-day-1", "Day 1", 1, [
      makeBlock("program-1-day-1-block-a", "Paired Block A", 1, "paired", 10, [
        makeSlot("program-1-day-1-block-a-slot-1", 1, "solid", "circle", [
          makeExercise("program-1-skydivers", "PAUSE CS Skydivers", "10", "reps"),
        ]),
        makeSlot("program-1-day-1-block-a-slot-2", 2, "dashed", "square", [
          makeExercise("program-1-goblet-squat", "Goblet Squat", "10", "reps"),
        ]),
      ]),
      makeBlock("program-1-day-1-single-1", "Single Block", 2, "single", 3, [
        makeSlot("program-1-day-1-single-1-slot-1", 1, "solid", "triangle", [
          makeExercise("program-1-bike", "Bike", "Calories", "calories"),
        ]),
      ]),
      makeBlock("program-1-day-1-block-b", "Paired Block B", 3, "paired", 10, [
        makeSlot("program-1-day-1-block-b-slot-1", 1, "solid", "circle", [
          makeExercise("program-1-one-arm-db-row", "PAUSE 1 Arm DB Row", "5", "reps"),
        ]),
        makeSlot("program-1-day-1-block-b-slot-2", 2, "dashed", "square", [
          makeExercise("program-1-bench-shoulder-taps", "PAUSE Bench Shoulder Taps", "5", "reps"),
        ]),
      ]),
      makeBlock("program-1-day-1-single-2", "Single Block", 4, "single", 3, [
        makeSlot("program-1-day-1-single-2-slot-1", 1, "solid", "triangle", [
          makeExercise("program-1-run-walk", "Run/walk", "Laps", "laps"),
        ]),
      ]),
      makeBlock("program-1-day-1-block-c", "Paired Block C", 5, "paired", 10, [
        makeSlot("program-1-day-1-block-c-slot-1", 1, "solid", "circle", [
          makeExercise("program-1-one-leg-rdl", "TEMPO BW 1 Leg RDL", "5", "reps"),
        ]),
        makeSlot("program-1-day-1-block-c-slot-2", 2, "dashed", "square", [
          makeExercise("program-1-farmers-carry", "Farmer's Carry", "50", "yards"),
        ]),
      ]),
    ]),
    makeRoutine("program-1-day-2", "Day 2", 2, [
      makeBlock("program-1-day-2-block-a", "Paired Block A", 1, "paired", 10, [
        makeSlot("program-1-day-2-block-a-slot-1", 1, "solid", "circle", [
          makeExercise("program-1-db-rdl", "DB RDL", "8", "reps"),
        ]),
        makeSlot("program-1-day-2-block-a-slot-2", 2, "dashed", "square", [
          makeExercise("program-1-plank-march", "Plank March", "4", "reps"),
        ]),
      ]),
      makeBlock("program-1-day-2-single-1", "Single Block", 2, "single", 3, [
        makeSlot("program-1-day-2-single-1-slot-1", 1, "solid", "triangle", [
          makeExercise("program-1-rower-1", "Rower", "Calories", "calories"),
        ]),
      ]),
      makeBlock("program-1-day-2-block-b", "Paired Block B", 3, "paired", 10, [
        makeSlot("program-1-day-2-block-b-slot-1", 1, "solid", "circle", [
          makeExercise("program-1-reverse-lunge", "Goblet Reverse Lunge", "8", "reps"),
        ]),
        makeSlot("program-1-day-2-block-b-slot-2", 2, "dashed", "square", [
          makeExercise("program-1-db-bench", "DB Bench Press", "8", "reps"),
        ]),
      ]),
      makeBlock("program-1-day-2-single-2", "Single Block", 4, "single", 3, [
        makeSlot("program-1-day-2-single-2-slot-1", 1, "solid", "triangle", [
          makeExercise("program-1-rower-2", "Rower", "Calories", "calories"),
        ]),
      ]),
      makeBlock("program-1-day-2-block-c", "Paired Block C", 5, "paired", 10, [
        makeSlot("program-1-day-2-block-c-slot-1", 1, "solid", "circle", [
          makeExercise("program-1-bent-over-row", "DB Bent Over Row", "10", "reps"),
        ]),
        makeSlot("program-1-day-2-block-c-slot-2", 2, "dashed", "square", [
          makeExercise("program-1-bear-to-pushup", "Bear to Pushup", "5", "reps"),
        ]),
      ]),
    ]),
  ],
};

// ---------- PROGRAM 2 DEFINITION ----------

const PROGRAM_2: ProgramDefinition = {
  id: "program-2",
  name: "Program 2",
  startedAt: "2025-08-19",
  status: "active",
  routines: [
    makeRoutine("program-2-day-1", "Day 1", 1, [
      makeBlock("program-2-day-1-block-a", "Paired Block A", 1, "paired", 10, [
        makeSlot("program-2-day-1-block-a-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-tempo-cs-1-arm-db-row", "TEMPO CS 1 Arm DB Row", "10", "reps"),
        ]),
        makeSlot("program-2-day-1-block-a-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-tempo-plate-reach-squat", "TEMPO Plate Reach Squat", "5", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-1-single-1", "Single Block", 2, "single", 3, [
        makeSlot("program-2-day-1-single-1-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-bike", "Bike", "30/30 Calories", "calories"),
        ]),
      ]),
      makeBlock("program-2-day-1-block-b", "Paired Block B", 3, "paired", 10, [
        makeSlot("program-2-day-1-block-b-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-tempo-1-leg-rdl-iso-hand-pass", "TEMPO 1 Leg RDL Iso Hand Pass", "5", "reps"),
        ]),
        makeSlot("program-2-day-1-block-b-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-plank-march", "Plank March", "8", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-1-single-2", "Single Block", 4, "single", 3, [
        makeSlot("program-2-day-1-single-2-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-farmers-carry", "Farmer's Carry", "50 yards", "yards"),
        ]),
      ]),
      makeBlock("program-2-day-1-block-c", "Paired Block C", 5, "paired", 10, [
        makeSlot("program-2-day-1-block-c-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-tempo-db-bicep-curls", "TEMPO DB Bicep Curls", "10", "reps"),
        ]),
        makeSlot("program-2-day-1-block-c-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-pause-shoulder-taps", "PAUSE Shoulder Taps", "5", "reps"),
        ]),
      ]),
    ]),
    makeRoutine("program-2-day-2", "Day 2", 2, [
      makeBlock("program-2-day-2-block-a", "Paired Block A", 1, "paired", 10, [
        makeSlot("program-2-day-2-block-a-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-1-arm-inc-db-bench-press", "1 Arm Inc. DB Bench Press", "10", "reps"),
        ]),
        makeSlot("program-2-day-2-block-a-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-tempo-cs-alt-oh-reach", "TEMPO CS Alt. OH Reach", "10", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-2-single-1", "Single Block", 2, "single", 3, [
        makeSlot("program-2-day-2-single-1-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-walk-run-day2", "Walk/run", "Laps", "laps"),
        ]),
      ]),
      makeBlock("program-2-day-2-block-b", "Paired Block B", 3, "paired", 10, [
        makeSlot("program-2-day-2-block-b-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-contra-split-squat", "Contra. Split Squat", "8", "reps"),
        ]),
        makeSlot("program-2-day-2-block-b-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-bear-to-pushup", "Bear to Pushup", "5", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-2-single-2", "Single Block", 4, "single", 3, [
        makeSlot("program-2-day-2-single-2-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-mb-slams-day2", "MB Slams", "Reps", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-2-block-c", "Paired Block C", 5, "paired", 10, [
        makeSlot("program-2-day-2-block-c-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-kbdl", "KBDL", "8", "reps"),
        ]),
        makeSlot("program-2-day-2-block-c-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-pause-1-arm-farmers-march-day2", "PAUSE 1 Arm Farmer's March", "4", "reps"),
        ]),
      ]),
    ]),
    makeRoutine("program-2-day-3", "Day 3", 3, [
      makeBlock("program-2-day-3-block-a", "Paired Block A", 1, "paired", 10, [
        makeSlot("program-2-day-3-block-a-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-goblet-squat", "Goblet Squat", "12 down by 1", "reps"),
        ]),
        makeSlot("program-2-day-3-block-a-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-db-bent-over-row", "DB Bent Over Row", "12 down by 1", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-3-single-1", "Single Block", 2, "single", 3, [
        makeSlot("program-2-day-3-single-1-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-rower-day3", "Rower", "30/30 Calories", "calories"),
        ]),
      ]),
      makeBlock("program-2-day-3-block-b", "Paired Block B", 3, "paired", 10, [
        makeSlot("program-2-day-3-block-b-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-ball-gb-ecc-hc", "Ball GB Ecc. HC", "8", "reps"),
        ]),
        makeSlot("program-2-day-3-block-b-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-plank-march-day3", "Plank March", "5", "reps"),
          makeExercise("program-2-deadbug-legs-only", "Deadbug - legs only", "6", "reps", "diamond"),
        ]),
      ]),
      makeBlock("program-2-day-3-single-2", "Single Block", 4, "single", 3, [
        makeSlot("program-2-day-3-single-2-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-farmers-carry-day3", "Farmer's Carry", "50 yards", "yards"),
        ]),
      ]),
      makeBlock("program-2-day-3-block-c", "Paired Block C", 5, "paired", 10, [
        makeSlot("program-2-day-3-block-c-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-pause-cs-skydivers", "PAUSE CS Skydivers", "10", "reps"),
        ]),
        makeSlot("program-2-day-3-block-c-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-pause-shoulder-taps-day3", "PAUSE Shoulder Taps", "5", "reps"),
        ]),
      ]),
    ]),
    makeRoutine("program-2-day-4", "Day 4", 4, [
      makeBlock("program-2-day-4-block-a", "Paired Block A", 1, "paired", 10, [
        makeSlot("program-2-day-4-block-a-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-db-rdl-day4", "DB RDL", "10", "reps"),
        ]),
        makeSlot("program-2-day-4-block-a-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-bear-mt-climbers", "Bear Mt. Climbers", "5", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-4-single-1", "Single Block", 2, "single", 3, [
        makeSlot("program-2-day-4-single-1-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-mb-slams-day4", "MB Slams", "Reps", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-4-block-b", "Paired Block B", 3, "paired", 10, [
        makeSlot("program-2-day-4-block-b-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-contra-step-ups", "Contra. Step Ups", "8", "reps"),
        ]),
        makeSlot("program-2-day-4-block-b-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-1-arm-db-row-day4", "1 Arm DB Row", "8", "reps"),
        ]),
      ]),
      makeBlock("program-2-day-4-single-2", "Single Block", 4, "single", 3, [
        makeSlot("program-2-day-4-single-2-slot-1", 1, "solid", "triangle", [
          makeExercise("program-2-walk-run-day4", "Walk/run", "Laps", "laps"),
        ]),
      ]),
      makeBlock("program-2-day-4-block-c", "Paired Block C", 5, "paired", 10, [
        makeSlot("program-2-day-4-block-c-slot-1", 1, "solid", "circle", [
          makeExercise("program-2-1-arm-skullcrusher", "1 Arm Skullcrusher", "10", "reps"),
        ]),
        makeSlot("program-2-day-4-block-c-slot-2", 2, "dashed", "square", [
          makeExercise("program-2-pause-1-arm-farmers-march-day4", "PAUSE 1 Arm Farmer's March", "4", "reps"),
        ]),
      ]),
    ]),
  ],
};

// ---------- INITIAL LOAD ----------

const defaultPrograms: ProgramDefinition[] = [PROGRAM_1, PROGRAM_2];

let programDefinitions: ProgramDefinition[] = loadFromStorage(PROGRAM_STORAGE_KEY, []);
const sessionRecords: SessionRecord[] = loadFromStorage(SESSION_STORAGE_KEY, []);
let members: Member[] = loadFromStorage(MEMBER_STORAGE_KEY, []);

// ---------- SEED DEFINITIONS ----------

if (programDefinitions.length === 0) {
  programDefinitions = defaultPrograms;
  saveToStorage(PROGRAM_STORAGE_KEY, programDefinitions);
}

// ---------- MEMBER INIT ----------

if (members.length === 0) {
  members = [
    {
      id: "member-1",
      name: "Default Member",
      createdAt: new Date().toISOString(),
    },
  ];
  saveToStorage(MEMBER_STORAGE_KEY, members);
}

// ---------- DEBUG COUNTS ----------

const totalRoutineCount = programDefinitions.reduce((sum, program) => sum + program.routines.length, 0);
const totalBlockCount = programDefinitions.reduce(
  (sum, program) =>
    sum +
    program.routines.reduce((routineSum, routine) => routineSum + routine.blocks.length, 0),
  0
);
const totalSlotCount = programDefinitions.reduce(
  (sum, program) =>
    sum +
    program.routines.reduce(
      (routineSum, routine) =>
        routineSum +
        routine.blocks.reduce((blockSum, block) => blockSum + block.slots.length, 0),
      0
    ),
  0
);

// ---------- APP SHELL ----------

export default function AppV2() {
  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>Workout App V2 (Program Definitions)</h1>

      <p>Programs loaded: {programDefinitions.length}</p>
      <p>Sessions loaded: {sessionRecords.length}</p>
      <p>Members: {members.length}</p>

      <hr style={{ margin: "20px 0" }} />

      <p>Total routines: {totalRoutineCount}</p>
      <p>Total blocks: {totalBlockCount}</p>
      <p>Total slots: {totalSlotCount}</p>

      <hr style={{ margin: "20px 0" }} />

      {programDefinitions.map((program) => (
        <div
          key={program.id}
          style={{
            marginBottom: 24,
            padding: 16,
            border: "1px solid #ddd",
            borderRadius: 12,
          }}
        >
          <h2 style={{ margin: "0 0 8px 0" }}>{program.name}</h2>
          <p style={{ margin: "4px 0" }}>Routines: {program.routines.length}</p>
          <ul style={{ margin: "8px 0 0 20px" }}>
            {program.routines
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((routine) => (
                <li key={routine.id}>
                  {routine.label} — {routine.blocks.length} blocks
                </li>
              ))}
          </ul>
        </div>
      ))}

      <p style={{ marginTop: 20 }}>
        Step 2 complete. Next step: relay importer + session storage upsert.
      </p>
    </div>
  );
}