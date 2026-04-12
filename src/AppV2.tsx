// ===== V2 FOUNDATION =====

// ---------- TYPES ----------

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
  type: "paired" | "single";
  durationMinutes?: number;
  notes?: string;
  slots: ExerciseSlotDefinition[];
};

type ExerciseSlotDefinition = {
  id: string;
  order: number;
  allowedExercises: ExerciseDefinition[];
};

type ExerciseDefinition = {
  id: string;
  name: string;
  targetLabel: string;
  metric: string;
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
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ---------- INITIAL LOAD ----------

const programDefinitions: ProgramDefinition[] = loadFromStorage(
  PROGRAM_STORAGE_KEY,
  []
);

const sessionRecords: SessionRecord[] = loadFromStorage(
  SESSION_STORAGE_KEY,
  []
);

let members: Member[] = loadFromStorage(MEMBER_STORAGE_KEY, []);

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

// ---------- APP SHELL ----------

export default function AppV2() {
  return (
    <div style={{ padding: 20 }}>
      <h1>Workout App V2 (Foundation)</h1>

      <p>Programs loaded: {programDefinitions.length}</p>
      <p>Sessions loaded: {sessionRecords.length}</p>
      <p>Members: {members.length}</p>

      <p style={{ marginTop: 20 }}>
        Foundation layer is running. Next step: Program Definitions.
      </p>
    </div>
  );
}