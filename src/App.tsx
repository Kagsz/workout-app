import React from "react";

// ===== V2 STEP 3 PHASE 2 =====

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

// ---------- PARSER ----------
function extractNumber(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const match = value.match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : undefined;
}
function getLineValue(input: string, label: string): string {
  const line = input
    .split("\\n")
    .find((l) => l.trim().startsWith(label));

  return line ? line.replace(label, "").trim() : "";
}

function parseSession(input: string): ParsedSession {
  const sessionNumber = Number(getLineValue(input, "Session #:"));
  const date = getLineValue(input, "Date:");
  const routine = getLineValue(input, "Routine:");

  const blockMatches = input.match(/(Paired Block [A-Z]|Single Block)[\\s\\S]*?(?=(Paired Block|Single Block|$))/g) || [];

  const blocks: ParsedBlock[] = blockMatches.map((block) => {
    const isPaired = block.includes("Paired Block");
    const labelMatch = block.match(/Block ([A-Z])/);

    if (isPaired) {
      const ex1Name = getLineValue(block, "Exercise 1:");
      const ex1Weight = getLineValue(block, "Weight:");
      const ex1Value = extractNumber(getLineValue(block, "Sets Complete:"));

      const ex2Name = block.match(/Exercise 2:\\s*([^\\n]+)/)?.[1] || "";
      const ex2Weight = block.match(/Exercise 2:[\\s\\S]*?Weight:\\s*([^\\n]+)/)?.[1];
      const ex2Value = extractNumber(block.match(/Exercise 2:[\\s\\S]*?Sets Complete:\\s*([^\\n]+)/)?.[1]);

      return {
        type: "paired",
        label: labelMatch?.[1],
        exercises: [
          { name: ex1Name, weight: ex1Weight, value: ex1Value },
          { name: ex2Name, weight: ex2Weight, value: ex2Value },
        ],
      };
    } else {
      const name = getLineValue(block, "Exercise:");
      const weight = getLineValue(block, "Weight:");
      const value = extractNumber(getLineValue(block, "Performance:"));

      return {
        type: "single",
        exercises: [{ name, weight, value }],
      };
    }
  });

  return { sessionNumber, date, routine, blocks };
}

// ---------- APP ----------

export default function AppV2() {
  const [input, setInput] = React.useState("");

  const handleParse = () => {
    const parsed = parseSession(input);
    console.log("PARSED SESSION:", parsed);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>V2 Phase 2 Parser</h1>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={12}
        style={{ width: "100%" }}
      />

      <button onClick={handleParse} style={{ marginTop: 10 }}>
        Parse Session
      </button>
    </div>
  );
}
