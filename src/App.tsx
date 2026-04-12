import { useEffect, useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ===== V2 STEP 5 =====
// Multi-session import + accumulation + graph progression

type ParsedExercise = {
  name: string;
  weight?: string;
  target?: string;
  value?: number;
};

type ParsedBlock = {
  type: "paired" | "single";
  label?: string;
  blockIndex: number;
  exercises: ParsedExercise[];
};

type ParsedSession = {
  program: string;
  sessionNumber: number;
  date: string;
  routine: string;
  blocks: ParsedBlock[];
};

type GraphPoint = {
  sessionNumber: number;
  date: string;
  value: number;
  exerciseName: string;
  weight?: string;
};

type GraphSeries = {
  exerciseName: string;
  points: GraphPoint[];
};

const SESSION_STORAGE_KEY = "workout-app-v2-parsed-sessions";

// ---------- HELPERS ----------

function extractNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}

function getLineValue(input: string, label: string): string {
  const lines = input.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(label)) {
      return trimmed.replace(label, "").trim();
    }
  }

  return "";
}

function parseSession(input: string): ParsedSession {
  const program = getLineValue(input, "Program:");
  const sessionNumber = Number(getLineValue(input, "Session #:"));
  const date = getLineValue(input, "Date:");
  const routine = getLineValue(input, "Routine:");

  const blockMatches =
    input.match(
      /(Paired Block [A-Z]|Single Block)[\s\S]*?(?=(Paired Block|Single Block|$))/g
    ) || [];

  const blocks: ParsedBlock[] = blockMatches.map((block, index) => {
    const isPaired = block.includes("Paired Block");
    const labelMatch = block.match(/Block ([A-Z])/);

    if (isPaired) {
      const ex1Section =
        block.match(/Exercise 1:[\s\S]*?(?=Exercise 2:|$)/)?.[0] || "";
      const ex1Name = getLineValue(ex1Section, "Exercise 1:");
      const ex1Weight = getLineValue(ex1Section, "Weight:");
      const ex1Target = getLineValue(ex1Section, "Target:");
      const ex1Value = extractNumber(getLineValue(ex1Section, "Sets Complete:"));

      const ex2Section = block.match(/Exercise 2:[\s\S]*?$/)?.[0] || "";
      const ex2Name = getLineValue(ex2Section, "Exercise 2:");
      const ex2Weight = getLineValue(ex2Section, "Weight:");
      const ex2Target = getLineValue(ex2Section, "Target:");
      const ex2Value = extractNumber(getLineValue(ex2Section, "Sets Complete:"));

      return {
        type: "paired" as const,
        label: labelMatch?.[1],
        blockIndex: index,
        exercises: [
          { name: ex1Name, weight: ex1Weight, target: ex1Target, value: ex1Value },
          { name: ex2Name, weight: ex2Weight, target: ex2Target, value: ex2Value },
        ],
      };
    }

    const name = getLineValue(block, "Exercise:");
    const weight = getLineValue(block, "Weight:");
    const target = getLineValue(block, "Target:");
    const value = extractNumber(getLineValue(block, "Performance:"));

    return {
      type: "single" as const,
      blockIndex: index,
      exercises: [{ name, weight, target, value }],
    };
  });

  return { program, sessionNumber, date, routine, blocks };
}

function parseMultipleSessions(input: string): ParsedSession[] {
  const sections = input
    .split(/(?=^\s*Program:)/gm)
    .map((section) => section.trim())
    .filter((section) => section && section.includes("Session #:"));

  return sections
    .map(parseSession)
    .filter(
      (session) =>
        Number.isFinite(session.sessionNumber) &&
        session.sessionNumber > 0 &&
        session.routine.length > 0
    )
    .sort((a, b) => a.sessionNumber - b.sessionNumber);
}

function upsertSessions(
  current: ParsedSession[],
  incoming: ParsedSession[]
): ParsedSession[] {
  const map = new Map<string, ParsedSession>();

  current.forEach((session) => {
    map.set(`${session.program}|${session.sessionNumber}`, session);
  });

  incoming.forEach((session) => {
    map.set(`${session.program}|${session.sessionNumber}`, session);
  });

  return Array.from(map.values()).sort((a, b) => a.sessionNumber - b.sessionNumber);
}

function deriveGraphSeries(
  sessions: ParsedSession[],
  routine: string,
  blockIndex: number
): GraphSeries[] {
  const seriesMap = new Map<string, GraphSeries>();

  sessions
    .filter((session) => session.routine === routine)
    .forEach((session) => {
      const block = session.blocks.find((item) => item.blockIndex === blockIndex);
      if (!block) return;

      block.exercises.forEach((exercise) => {
        if (!exercise.name || exercise.value == null || Number.isNaN(exercise.value)) {
          return;
        }

        if (!seriesMap.has(exercise.name)) {
          seriesMap.set(exercise.name, {
            exerciseName: exercise.name,
            points: [],
          });
        }

        seriesMap.get(exercise.name)?.points.push({
          sessionNumber: session.sessionNumber,
          date: session.date,
          value: exercise.value,
          exerciseName: exercise.name,
          weight: exercise.weight,
        });
      });
    });

  return Array.from(seriesMap.values()).map((series) => ({
    ...series,
    points: [...series.points].sort((a, b) => a.sessionNumber - b.sessionNumber),
  }));
}

function getBlockTitle(block: ParsedBlock): string {
  return block.type === "paired"
    ? `Paired Block ${block.label || "?"}`
    : `Single Block ${block.blockIndex + 1}`;
}

function GraphTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{
    payload?: {
      sessionNumber: number;
      date: string;
      value: number;
      exerciseName: string;
      weight?: string;
    };
  }>;
}) {
  if (!active || !payload?.length) return null;

  const point = payload[0]?.payload;
  if (!point) return null;

  return (
    <div
      style={{
        background: "white",
        border: "1px solid #ddd",
        borderRadius: 12,
        padding: 10,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>{point.exerciseName}</div>
      <div>Session: {point.sessionNumber}</div>
      <div>Value: {point.value}</div>
      <div>Date: {point.date}</div>
      <div>Weight: {point.weight || "—"}</div>
    </div>
  );
}

// ---------- APP ----------

export default function AppV2() {
  const [input, setInput] = useState("");
  const [sessions, setSessions] = useState<ParsedSession[]>([]);
  const [selectedRoutine, setSelectedRoutine] = useState("");
  const [selectedBlockIndex, setSelectedBlockIndex] = useState<number>(0);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;

      const stored = JSON.parse(raw) as ParsedSession[];
      setSessions(stored);

      if (stored.length > 0) {
        setSelectedRoutine(stored[0].routine);
        setSelectedBlockIndex(0);
      }
    } catch {
      // ignore bad storage
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  const handleImport = () => {
    const parsed = parseMultipleSessions(input);
    console.log("PARSED SESSIONS:", parsed);

    const merged = upsertSessions(sessions, parsed);
    setSessions(merged);

    if (parsed.length > 0) {
      setSelectedRoutine(parsed[0].routine);
      setSelectedBlockIndex(0);
    }
  };

  const handleClear = () => {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    setSessions([]);
    setSelectedRoutine("");
    setSelectedBlockIndex(0);
  };

  const routineOptions = useMemo(
    () => Array.from(new Set(sessions.map((session) => session.routine))),
    [sessions]
  );

  const blockOptions = useMemo(() => {
    const firstSessionForRoutine = sessions.find(
      (session) => session.routine === selectedRoutine
    );
    return firstSessionForRoutine?.blocks || [];
  }, [sessions, selectedRoutine]);

  const graphSeries = useMemo(
    () => deriveGraphSeries(sessions, selectedRoutine, selectedBlockIndex),
    [sessions, selectedRoutine, selectedBlockIndex]
  );

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>V2 Step 5</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={18}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
        <button onClick={handleImport}>Import All Sessions</button>
        <button onClick={handleClear}>Clear Stored Sessions</button>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div>Stored sessions: {sessions.length}</div>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <div>
          <div style={{ marginBottom: 4 }}>Routine</div>
          <select
            value={selectedRoutine}
            onChange={(e) => {
              setSelectedRoutine(e.target.value);
              setSelectedBlockIndex(0);
            }}
          >
            {routineOptions.map((routine) => (
              <option key={routine} value={routine}>
                {routine}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ marginBottom: 4 }}>Block</div>
          <select
            value={selectedBlockIndex}
            onChange={(e) => setSelectedBlockIndex(Number(e.target.value))}
          >
            {blockOptions.map((block) => (
              <option key={block.blockIndex} value={block.blockIndex}>
                {getBlockTitle(block)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div
        style={{
          width: "100%",
          height: 420,
          border: "1px solid #ddd",
          borderRadius: 12,
          padding: 12,
        }}
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              type="number"
              dataKey="sessionNumber"
              domain={["dataMin", "dataMax"]}
              allowDecimals={false}
            />
            <YAxis />
            <Tooltip content={<GraphTooltip />} />
            {graphSeries.map((series) => (
              <Line
                key={series.exerciseName}
                type="monotone"
                data={series.points}
                dataKey="value"
                name={series.exerciseName}
                xAxisId={0}
                yAxisId={0}
                dot
                connectNulls={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
