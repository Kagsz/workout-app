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

// ===== TYPES =====

type Role = "admin" | "member";
type Screen = "builder" | "input" | "programs" | "routines" | "routine" | "graph";
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
  status: "active" | "closed";
  routines: Routine[];
};

type Member = {
  id: string;
  clientId: string;
  name: string;
  programClosed?: boolean;
};

type SessionExerciseInput = {
  exerciseId: string;
  exerciseName: string;
  weight: string;
  performance: string;
  setsCompleted: string;
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

const getWeightBucketColor = (weight: string) => {
  const trimmed = weight.trim().toUpperCase();

  if (!trimmed || trimmed === "BW" || trimmed === "B") return "#9ca3af";

  const numericWeight = Number(trimmed);
  if (!Number.isFinite(numericWeight)) return "#9ca3af";
  if (numericWeight < 25) return "#3b82f6";
  if (numericWeight < 50) return "#22c55e";
  return "#ef4444";
};

const buildTrianglePath = (cx: number, cy: number, size: number) => {
  const half = size / 2;
  const height = size * 0.9;
  return `${cx},${cy - height / 2} ${cx - half},${cy + height / 2} ${cx + half},${cy + height / 2}`;
};

function ExerciseDot({
  cx,
  cy,
  payload,
  shape,
}: {
  cx?: number;
  cy?: number;
  payload?: GraphPoint;
  shape: "circle" | "square" | "triangle";
}) {
  if (cx == null || cy == null || !payload) return null;

  const fill = getWeightBucketColor(payload.weight);
  const stroke = "#111827";
  const size = 10;

  if (shape === "square") {
    return <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx={2} fill={fill} stroke={stroke} strokeWidth={1} />;
  }

  if (shape === "triangle") {
    return <polygon points={buildTrianglePath(cx, cy, size)} fill={fill} stroke={stroke} strokeWidth={1} />;
  }

  return <circle cx={cx} cy={cy} r={size / 2} fill={fill} stroke={stroke} strokeWidth={1} />;
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

  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg">
      <div className="font-semibold text-zinc-900">Duration: {point.duration || "—"}</div>
      <div className="mt-1 text-zinc-700">Performance: {point.performance || "—"}</div>
    </div>
  );
}

// ===== HELPERS =====

const uid = () => Math.random().toString(36).slice(2, 9);

const normalizeWeightInput = (value: string) => {
  const trimmed = value.trim();

  if (!trimmed) return "";
  if (/^b$/i.test(trimmed)) return "B";
  if (/^bw$/i.test(trimmed)) return "BW";

  return trimmed.replace(/[^\d.]/g, "");
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
  label: `Day ${String.fromCharCode(65 + index)}`,
  blocks: [createBlock("paired")],
});

const createProgram = (name: string, startedAt: string, routines: Routine[], status: "active" | "closed" = "active"): Program => ({
  id: uid(),
  name,
  startedAt,
  routines,
  status,
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
    })),
  })),
});

function buildInitialPrograms(): Program[] {
  const dayA = createRoutine(0);
  const dayB: Routine = {
    id: uid(),
    label: "Day B",
    blocks: [
      {
        id: uid(),
        type: "paired",
        title: "Paired Block A",
        duration: "10",
        notes: "",
        exercises: [
          { id: uid(), name: "DB RDL", target: "8", metric: "reps" },
          { id: uid(), name: "Plank March", target: "4", metric: "reps" },
        ],
      },
      {
        id: uid(),
        type: "single",
        title: "Single Block",
        duration: "3",
        notes: "",
        exercises: [{ id: uid(), name: "Rower", target: "Calories", metric: "calories" }],
      },
      {
        id: uid(),
        type: "paired",
        title: "Paired Block B",
        duration: "10",
        notes: "",
        exercises: [
          { id: uid(), name: "Goblet Reverse Lunge", target: "8", metric: "reps" },
          { id: uid(), name: "DB Bench Press", target: "8", metric: "reps" },
        ],
      },
      {
        id: uid(),
        type: "single",
        title: "Single Block",
        duration: "3",
        notes: "",
        exercises: [{ id: uid(), name: "Rower", target: "Calories", metric: "calories" }],
      },
      {
        id: uid(),
        type: "paired",
        title: "Paired Block C",
        duration: "10",
        notes: "",
        exercises: [
          { id: uid(), name: "DB Bent Over Row", target: "10", metric: "reps" },
          { id: uid(), name: "Bear to Pushup", target: "5", metric: "reps" },
        ],
      },
    ],
  };

  const olderDayA = createRoutine(0);
  olderDayA.blocks[0].title = "Paired Block A";

  return [
    createProgram("Program 2", "2025-08-01", [dayA, dayB], "active"),
    createProgram("Program 1", "2025-05-01", [olderDayA, createRoutine(1)], "closed"),
  ];
}

// ===== SMALL UI PARTS =====

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-3 text-lg font-semibold text-zinc-900">{title}</div>
      {children}
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

export default function App() {
  const [members, setMembers] = useState<Member[]>([
    { id: uid(), clientId: "100001", name: "Test Subject" },
    { id: uid(), clientId: "100002", name: "Example Member" },
  ]);
  const [memberSearch, setMemberSearch] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [role, setRole] = useState<Role>("admin");
  const [screen, setScreen] = useState<Screen>("builder");
  const [programs, setPrograms] = useState<Program[]>(buildInitialPrograms());
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedRoutineId, setSelectedRoutineId] = useState<string | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [graphAxis, setGraphAxis] = useState<GraphAxis>("date");
  const [sessionDraft, setSessionDraft] = useState<SessionDraft | null>(null);
  const [savedSessions, setSavedSessions] = useState<SavedSession[]>([]);

  const filteredMembers = useMemo(() => {
    const query = memberSearch.trim().toLowerCase();
    if (!query) return members;
    return members.filter((member) => member.name.toLowerCase().includes(query));
  }, [members, memberSearch]);

  const selectedMember = useMemo(
    () => members.find((member) => member.id === selectedMemberId) || members[0] || null,
    [members, selectedMemberId]
  );

  const sortedPrograms = useMemo(
    () => [...programs].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
    [programs]
  );

  const selectedProgram = useMemo(
    () => programs.find((program) => program.id === selectedProgramId) || sortedPrograms[0] || null,
    [programs, selectedProgramId, sortedPrograms]
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
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [savedSessions, selectedMember, selectedProgram, selectedRoutine]);

  const latestSavedSession = matchingSavedSessions[0] || null;

  const graphData = useMemo<GraphSeries[]>(() => {
    if (!selectedBlock || !selectedRoutine || !selectedProgram || !selectedMember) return [];

    const seriesMap: Record<string, GraphSeries> = {};

    const scopedSessions = savedSessions.filter(
      (session) =>
        session.programId === selectedProgram.id &&
        session.routineId === selectedRoutine.id &&
        session.memberId === selectedMember.id
    );

    scopedSessions.forEach((session) => {
      const matchingBlock = session.blocks.find((block) => block.blockId === selectedBlock.id);
      if (!matchingBlock) return;

      matchingBlock.entries.forEach((entry) => {
        const y = Number(entry.setsCompleted);
        const sessionNumber = Number(session.sessionNumber);

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
          weight: entry.weight,
          sessionId: session.id,
          sessionNumber,
          date: session.date,
          performance: entry.performance,
          duration: selectedBlock.duration,
        });
      });
    });

    return Object.values(seriesMap).map((series) => ({
      ...series,
      points: [...series.points].sort((a, b) => {
        if (graphAxis === "date") {
          return new Date(a.date).getTime() - new Date(b.date).getTime();
        }
        return a.sessionNumber - b.sessionNumber;
      }),
    }));
  }, [savedSessions, selectedBlock, selectedRoutine, selectedProgram, selectedMember, graphAxis]);

  const chartSeries = useMemo(() => {
    const dateLabels = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.date))));
    const dateIndexMap = new Map(dateLabels.map((label, index) => [label, index + 1]));
    const pairOffset = selectedBlock?.type === "paired" ? 0.12 : 0;

    return graphData.map((series, seriesIndex) => {
      const shape = selectedBlock?.type === "single" ? "triangle" : seriesIndex === 0 ? "circle" : "square";
      const dash = selectedBlock?.type === "paired" && seriesIndex === 1 ? "5 4" : undefined;
      const offset = selectedBlock?.type === "paired" ? (seriesIndex === 0 ? -pairOffset : pairOffset) : 0;

      const points: ChartPoint[] = series.points.map((point) => {
        const baseX = graphAxis === "date" ? Number(dateIndexMap.get(point.date) || 0) : point.sessionNumber;
        const xLabel = graphAxis === "date" ? point.date : `S${point.sessionNumber}`;

        return {
          ...point,
          chartX: baseX + offset,
          xLabel,
        };
      });

      return {
        ...series,
        shape,
        dash,
        points,
      };
    });
  }, [graphData, graphAxis, selectedBlock]);

  const xAxisTicks = useMemo(() => {
    if (graphAxis === "date") {
      const labels = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.date))));
      return labels.map((_, index) => index + 1);
    }

    const sessions = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.sessionNumber))));
    return sessions.sort((a, b) => a - b);
  }, [graphData, graphAxis]);

  const xAxisLabelMap = useMemo(() => {
    const map = new Map<number, string>();

    if (graphAxis === "date") {
      const labels = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.date))));
      labels.forEach((label, index) => {
        map.set(index + 1, label);
      });
      return map;
    }

    const sessions = Array.from(new Set(graphData.flatMap((series) => series.points.map((point) => point.sessionNumber))));
    sessions.forEach((sessionNumber) => {
      map.set(sessionNumber, `S${sessionNumber}`);
    });
    return map;
  }, [graphData, graphAxis]);

  const yDomain = useMemo(() => {
    const values = graphData.flatMap((series) => series.points.map((point) => point.y));
    if (!values.length) return [0, 4] as [number, number];

    const min = Math.min(...values);
    const max = Math.max(...values);

    return [Math.max(0, Math.floor(min) - 2), Math.ceil(max) + 2] as [number, number];
  }, [graphData]);

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

  const goProgramBuilder = () => {
    setRole("admin");
    setScreen("builder");
  };

  const addMember = () => {
    const nextMemberNumber = members.length + 1;
    const newMember: Member = {
      id: uid(),
      clientId: String(100000 + nextMemberNumber),
      name: `New Member ${nextMemberNumber}`,
      programClosed: false,
    };

    setMembers((prev) => [...prev, newMember]);
    setSelectedMemberId(newMember.id);
    setMemberSearch("");
  };

  const removeMember = (memberId: string) => {
    setMembers((prev) => prev.filter((member) => member.id !== memberId));
    if (selectedMemberId === memberId) setSelectedMemberId(null);
  };

  const toggleProgramClosed = (memberId: string) => {
    setMembers((prev) => prev.map((member) => (member.id === memberId ? { ...member, programClosed: !member.programClosed } : member)));
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
    setScreen("routines");
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

  const pathItems = useMemo(() => {
    if (role === "admin" && screen === "builder") {
      return [{ label: "Admin" }, { label: "Program Builder" }, ...(selectedProgram ? [{ label: selectedProgram.name }] : []), ...(selectedRoutine ? [{ label: selectedRoutine.label }] : [])];
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
  }, [role, screen, selectedProgram, selectedRoutine, selectedBlock]);

  return (
    <div className="min-h-screen bg-zinc-100 p-6 text-zinc-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Prototype</div>
          <h1 className="mt-1 text-3xl font-bold">Workout App V2</h1>
          <p className="mt-1 text-sm text-zinc-600">Phase 2.5 with admin session history layered on top of the locked shell.</p>
        </div>

        <div className="mx-auto w-full max-w-[430px] overflow-hidden rounded-[32px] border border-zinc-300 bg-white shadow-2xl">
          <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-3">
            <div className="mx-auto h-1.5 w-20 rounded-full bg-zinc-300" />
          </div>

          <div className="max-h-[85vh] overflow-y-auto bg-zinc-100 p-4">
            <div className="space-y-6">
              <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500">Workspace</div>
                    <h1 className="text-2xl font-bold">Workout App V2</h1>
                    <p className="mt-1 text-sm text-zinc-600">Mobile shell preview for structure testing.</p>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <ToggleButton active={role === "admin" && screen === "builder"} onClick={goProgramBuilder}>Program Builder</ToggleButton>
                    <ToggleButton active={role === "admin" && screen === "input"} onClick={goAdminInput}>Admin Input</ToggleButton>
                    <ToggleButton active={role === "member" && (screen === "programs" || screen === "routines" || screen === "routine" || screen === "graph")} onClick={goMemberPrograms}>Member View</ToggleButton>
                  </div>
                </div>
              </div>

              {!!pathItems.length && <PathBar items={pathItems} />}

              {role === "admin" && screen === "builder" && (
                <div className="space-y-6">
                  <SectionCard title="Member Workspace">
                    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
                      <div className="space-y-3">
                        <div>
                          <Label>Search Member</Label>
                          <TextInput value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} placeholder="Search for a member" />
                        </div>
                        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-3">
                          <div className="mb-2 text-sm font-semibold text-zinc-900">Selected Member</div>
                          <div className="text-sm text-zinc-600">{selectedMember?.name || "No member selected"}</div>
                          <div className="mt-3 flex gap-2">
                            <SmallButton onClick={() => selectedMember && toggleProgramClosed(selectedMember.id)}>
                              {selectedMember?.programClosed ? "Reopen Program" : "Close Program"}
                            </SmallButton>
                            <div className="self-center text-xs text-zinc-500">Status: {selectedMember?.programClosed ? "Closed" : "Active"}</div>
                          </div>
                        </div>
                      </div>
                      <div className="self-end flex gap-2">
                        <PrimaryButton onClick={addMember}>+ Add Member</PrimaryButton>
                        <PrimaryButton onClick={() => selectedMember && removeMember(selectedMember.id)} className="bg-red-600 hover:bg-red-700">Remove Member</PrimaryButton>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      {filteredMembers.map((member) => (
                        <button key={member.id} onClick={() => setSelectedMemberId(member.id)} className={`rounded-2xl border p-4 text-left transition ${selectedMember?.id === member.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"}`}>
                          <div className="font-semibold">{member.name}</div>
                          <div className={`text-sm ${selectedMember?.id === member.id ? "text-zinc-300" : "text-zinc-500"}`}>Program workspace</div>
                        </button>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Program Library">
                    <div className="space-y-2">
                      {sortedPrograms.map((program) => (
                        <button key={program.id} onClick={() => setSelectedProgramId(program.id)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedProgram?.id === program.id ? "border-zinc-900 bg-zinc-900 text-white" : "border-zinc-200 bg-white text-zinc-900 hover:bg-zinc-50"}`}>
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">{program.name}</div>
                              <div className={`text-sm ${selectedProgram?.id === program.id ? "text-zinc-300" : "text-zinc-500"}`}>Started {program.startedAt}</div>
                            </div>
                            <div className={`text-xs font-semibold uppercase tracking-wide ${selectedProgram?.id === program.id ? "text-zinc-300" : "text-zinc-400"}`}>{program.status}</div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Program Structure">
                    <div className="space-y-3">
                      <div className="rounded-2xl bg-zinc-50 p-3 text-sm text-zinc-600">Build the selected program's routine loop here. Add Day A, Day B, and so on, then stack paired or single blocks inside each routine.</div>
                      <PrimaryButton onClick={addRoutine} className="w-full">+ Add Routine</PrimaryButton>
                      <div className="space-y-2">
                        {selectedProgram?.routines.map((routine) => (
                          <div key={routine.id} className="rounded-2xl border border-zinc-200 bg-white p-2">
                            <button onClick={() => setSelectedRoutineId(routine.id)} className={`w-full rounded-xl px-3 py-3 text-left transition ${selectedRoutine?.id === routine.id ? "bg-zinc-900 text-white" : "bg-white text-zinc-900 hover:bg-zinc-50"}`}>
                              <div className="font-semibold">{routine.label}</div>
                              <div className={`text-xs ${selectedRoutine?.id === routine.id ? "text-zinc-300" : "text-zinc-500"}`}>{routine.blocks.length} blocks</div>
                            </button>
                            <div className="mt-2 flex justify-end">
                              <SmallButton onClick={() => deleteRoutine(routine.id)}>Delete Routine</SmallButton>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </SectionCard>

                  <SectionCard title={selectedRoutine ? `${selectedRoutine.label} Builder` : "Routine Builder"}>
                    {selectedRoutine ? (
                      <div className="space-y-5">
                        <div className="grid gap-3 md:grid-cols-[1fr_auto_auto]">
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
                        </div>

                        <div className="space-y-4">
                          {selectedRoutine.blocks.map((block, index) => (
                            <div key={block.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-zinc-500">Block {index + 1}</div>
                                <div className="flex flex-wrap gap-2">
                                  <SmallButton onClick={() => moveBlock(selectedRoutine.id, block.id, "up")} disabled={index === 0}>Move Up</SmallButton>
                                  <SmallButton onClick={() => moveBlock(selectedRoutine.id, block.id, "down")} disabled={index === selectedRoutine.blocks.length - 1}>Move Down</SmallButton>
                                  <SmallButton onClick={() => deleteBlock(selectedRoutine.id, block.id)}>Delete Block</SmallButton>
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
                <SectionCard title="Admin Data Input">
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-zinc-50 p-4 text-sm text-zinc-600">Builder sets the routine template: exercise names, targets, metrics, block duration, and screen tips. This input tab is where admin logs the actual session performance for a specific program, routine, and session number.</div>
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
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-500">No routine selected yet.</div>
                    )}
                  </div>
                </SectionCard>
              )}

              {role === "member" && screen === "programs" && (
                <SectionCard title="My Programs">
                  <div className="space-y-3">
                    <div className="text-sm text-zinc-600">Members start here and open the most recent program first.</div>
                    <div className="space-y-3">
                      {sortedPrograms.map((program) => (
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

                    {chartSeries.length ? (
                      <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                        <div className="h-[280px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart margin={{ top: 12, right: 12, left: 0, bottom: 42 }}>
                              <CartesianGrid strokeDasharray="3 3" vertical={false} />
                              <XAxis
                                type="number"
                                dataKey="chartX"
                                ticks={xAxisTicks}
                                domain={[Math.min(...xAxisTicks), Math.max(...xAxisTicks)]}
                                tickFormatter={(value) => xAxisLabelMap.get(Number(value)) || ""}
                                angle={-35}
                                textAnchor="end"
                                height={52}
                                tickMargin={10}
                                allowDecimals={false}
                              />
                              <YAxis
                                type="number"
                                domain={yDomain}
                                allowDecimals={false}
                                tickCount={Math.max(4, yDomain[1] - yDomain[0] + 1)}
                                label={{ value: "Sets", angle: -90, position: "insideLeft" }}
                              />
                              <Tooltip content={<GraphTooltip />} />
                              {chartSeries.map((series, seriesIndex) => (
                                <Line
                                  key={series.exerciseId}
                                  type="linear"
                                  data={series.points}
                                  dataKey="y"
                                  name={series.exerciseName}
                                  xAxisId={0}
                                  yAxisId={0}
                                  stroke={seriesIndex === 1 ? "#52525b" : "#111111"}
                                  strokeWidth={2}
                                  strokeDasharray={series.dash}
                                  dot={(props) => <ExerciseDot {...props} payload={props.payload as GraphPoint} shape={series.shape as "circle" | "square" | "triangle"} />}
                                  activeDot={(props) => <ExerciseDot {...props} payload={props.payload as GraphPoint} shape={series.shape as "circle" | "square" | "triangle"} />}
                                  isAnimationActive={false}
                                />
                              ))}
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                        No graph data yet for this block.
                      </div>
                    )}

                    <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                      <div className="mb-2 text-sm font-semibold text-zinc-900">Phase 3 Graph Pipeline</div>
                      <div className="text-sm text-zinc-600">Series Count: {graphData.length}</div>
                      <div className="mt-3 space-y-1 text-sm text-zinc-500">
                        {graphData.length > 0 ? (
                          graphData.map((series) => (
                            <div key={series.exerciseId}>
                              {series.exerciseName}: {series.points.length} {series.points.length === 1 ? "point" : "points"}
                            </div>
                          ))
                        ) : (
                          <div>No scoped graph data yet for this block.</div>
                        )}
                      </div>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="mb-2 text-sm font-semibold text-zinc-900">Exercise Key</div>
                        <div className="space-y-2 text-sm text-zinc-600">
                          {selectedBlock.type === "single" ? (
                            <div className="flex items-center gap-2">
                              <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                                <line x1="2" y1="10" x2="18" y2="10" stroke="#111111" strokeWidth="2" />
                                <polygon points="10,4 5,14 15,14" fill="#9ca3af" stroke="#111827" strokeWidth="1" />
                              </svg>
                              <span>Triangle + solid line</span>
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                                  <line x1="2" y1="10" x2="18" y2="10" stroke="#111111" strokeWidth="2" />
                                  <circle cx="10" cy="10" r="4" fill="#9ca3af" stroke="#111827" strokeWidth="1" />
                                </svg>
                                <span>Circle + solid line</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <svg width="20" height="20" viewBox="0 0 20 20" className="shrink-0">
                                  <line x1="2" y1="10" x2="18" y2="10" stroke="#52525b" strokeWidth="2" strokeDasharray="5 4" />
                                  <rect x="6" y="6" width="8" height="8" rx="1.5" fill="#9ca3af" stroke="#111827" strokeWidth="1" />
                                </svg>
                                <span>Square + dotted line</span>
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-zinc-200 bg-white p-4">
                        <div className="mb-2 text-sm font-semibold text-zinc-900">Weight Key</div>
                        <div className="space-y-2 text-sm text-zinc-600">
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full bg-gray-400" />
                            <span>BW = Gray</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full bg-blue-500" />
                            <span>Lighter load</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full bg-green-500" />
                            <span>Medium load</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="inline-block h-3 w-3 rounded-full bg-red-500" />
                            <span>Heavier load</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </SectionCard>
              )}
			              </div>
          </div>
        </div>
      </div>
    </div>
  );
}
