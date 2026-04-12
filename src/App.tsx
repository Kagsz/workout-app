import { useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// ===== V2 STEP 4 =====

// ---------- TYPES ----------

type ParsedExercise = {
  name: string;
  weight?: string;
  target?: string;
  value?: number;
};

type ParsedBlock = {
  type: "paired" | "single";
  label?: string;
  exercises: ParsedExercise[];
};

type ParsedSession = {
  sessionNumber: number;
  date: string;
  routine: string;
  blocks: ParsedBlock[];
};

type GraphPoint = {
  x: number;
  label: string;
  date: string;
  exerciseName: string;
  weight?: string;
  value: number;
};

type GraphSeries = {
  exerciseName: string;
  points: GraphPoint[];
};

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
  const sessionNumber = Number(getLineValue(input, "Session #:"));
  const date = getLineValue(input, "Date:");
  const routine = getLineValue(input, "Routine:");

  const blockMatches =
    input.match(
      /(Paired Block [A-Z]|Single Block)[\s\S]*?(?=(Paired Block|Single Block|$))/g
    ) || [];

  const blocks: ParsedBlock[] = blockMatches.map((block) => {
    const isPaired = block.includes("Paired Block");
    const labelMatch = block.match(/Block ([A-Z])/);

    if (isPaired) {
      const ex1Section = block.match(/Exercise 1:[\s\S]*?(?=Exercise 2:|$)/)?.[0] || "";
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
        type: "paired",
        label: labelMatch?.[1],
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
      type: "single",
      exercises: [{ name, weight, target, value }],
    };
  });

  return { sessionNumber, date, routine, blocks };
}

function deriveGraphSeries(session: ParsedSession): GraphSeries[] {
  const map = new Map<string, GraphSeries>();

  for (const block of session.blocks) {
    for (const exercise of block.exercises) {
      if (!exercise.name || exercise.value == null || Number.isNaN(exercise.value)) {
        continue;
      }

      const key = exercise.name;
      if (!map.has(key)) {
        map.set(key, {
          exerciseName: exercise.name,
          points: [],
        });
      }

      map.get(key)!.points.push({
        x: session.sessionNumber,
        label: `S${session.sessionNumber}`,
        date: session.date,
        exerciseName: exercise.name,
        weight: exercise.weight,
        value: exercise.value,
      });
    }
  }

  return Array.from(map.values());
}

function flattenSeriesForChart(series: GraphSeries[]) {
  return series.flatMap((item) =>
    item.points.map((point) => ({
      x: point.x,
      label: point.label,
      exerciseName: point.exerciseName,
      value: point.value,
      date: point.date,
      weight: point.weight || "",
    }))
  );
}

// ---------- TOOLTIP ----------

function GraphTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ payload?: { exerciseName: string; value: number; date: string; weight: string } }>;
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
      <div>Value: {point.value}</div>
      <div>Date: {point.date}</div>
      <div>Weight: {point.weight || "—"}</div>
    </div>
  );
}

// ---------- APP ----------

export default function AppV2() {
  const [input, setInput] = useState("");
  const [parsedSession, setParsedSession] = useState<ParsedSession | null>(null);

  const handleParse = () => {
    const parsed = parseSession(input);
    console.log("PARSED SESSION:", parsed);
    setParsedSession(parsed);
  };

  const graphSeries = parsedSession ? deriveGraphSeries(parsedSession) : [];
  const chartData = flattenSeriesForChart(graphSeries);

  return (
    <div style={{ padding: 20, fontFamily: "Arial, sans-serif" }}>
      <h1>V2 Step 4</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={18}
        style={{ width: "100%", marginBottom: 12 }}
      />

      <button onClick={handleParse} style={{ marginBottom: 20 }}>
        Parse Session + Build Graph
      </button>

      {parsedSession ? (
        <div style={{ marginBottom: 20 }}>
          <div>Session: {parsedSession.sessionNumber}</div>
          <div>Date: {parsedSession.date}</div>
          <div>Routine: {parsedSession.routine}</div>
          <div>Blocks: {parsedSession.blocks.length}</div>
        </div>
      ) : null}

      <div style={{ width: "100%", height: 420, border: "1px solid #ddd", borderRadius: 12, padding: 12 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="label" />
            <YAxis />
            <Tooltip content={<GraphTooltip />} />
            {graphSeries.map((series) => (
              <Line
                key={series.exerciseName}
                type="monotone"
                data={series.points.map((point) => ({
                  x: point.x,
                  label: point.label,
                  exerciseName: point.exerciseName,
                  value: point.value,
                  date: point.date,
                  weight: point.weight || "",
                }))}
                dataKey="value"
                name={series.exerciseName}
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
