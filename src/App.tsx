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

// ===== V2 STEP 6 (POLISH) =====

// ---------- TYPES ----------

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

// ---------- COLOR SYSTEM ----------

function getWeightColor(weight?: string) {
  if (!weight || weight === "BW") return "#9ca3af";

  const num = Number(weight);
  if (Number.isNaN(num)) return "#9ca3af";

  // spaced buckets for clarity
  const buckets = [0, 10, 20, 30, 40, 50, 60];
  const index = buckets.findIndex((b) => num <= b);

  const colors = [
    "#3b82f6",
    "#10b981",
    "#f59e0b",
    "#ef4444",
    "#8b5cf6",
    "#ec4899",
    "#14b8a6",
  ];

  return colors[index >= 0 ? index : colors.length - 1];
}

// ---------- TOOLTIP ----------

function GraphTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div style={{ background: "white", padding: 10, border: "1px solid #ddd", borderRadius: 8 }}>
      {payload.map((entry: any) => (
        <div key={entry.name} style={{ marginBottom: 6 }}>
          <div style={{ fontWeight: 600 }}>{entry.name}</div>
          <div>Value: {entry.value}</div>
          <div>Date: {entry.payload.date}</div>
          <div>Weight: {entry.payload.weight || "—"}</div>
        </div>
      ))}
    </div>
  );
}

// ---------- APP ----------

export default function AppV2() {
  const [series, setSeries] = useState<GraphSeries[]>([]);

  // TEMP mock data (replace with real pipeline)
  useEffect(() => {
    const mock: GraphSeries[] = [
      {
        exerciseName: "Row",
        points: [
          { sessionNumber: 1, date: "Aug 1", value: 5, weight: "20", exerciseName: "Row" },
          { sessionNumber: 2, date: "Aug 3", value: 6, weight: "25", exerciseName: "Row" },
          { sessionNumber: 3, date: "Aug 5", value: 4, weight: "25", exerciseName: "Row" },
        ],
      },
      {
        exerciseName: "Squat",
        points: [
          { sessionNumber: 1, date: "Aug 1", value: 4, weight: "10", exerciseName: "Squat" },
          { sessionNumber: 2, date: "Aug 3", value: 5, weight: "15", exerciseName: "Squat" },
          { sessionNumber: 3, date: "Aug 5", value: 5, weight: "20", exerciseName: "Squat" },
        ],
      },
    ];
    setSeries(mock);
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h1>V2 Polish Graph</h1>

      <div style={{ width: "100%", height: 420 }}>
        <ResponsiveContainer>
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

            {series.map((s) => (
              <Line
                key={s.exerciseName}
                data={s.points}
                dataKey="value"
                name={s.exerciseName}
                stroke={getWeightColor(s.points[0]?.weight)}
                dot
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
