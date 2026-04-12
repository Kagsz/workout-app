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
      // --- Exercise 1 ---
      const ex1Section = block.match(
        /Exercise 1:[\s\S]*?(?=Exercise 2:|$)/
      )?.[0] || "";

      const ex1Name = getLineValue(ex1Section, "Exercise 1:");
      const ex1Weight = getLineValue(ex1Section, "Weight:");
      const ex1Value = extractNumber(
        getLineValue(ex1Section, "Sets Complete:")
      );

      // --- Exercise 2 ---
      const ex2Section = block.match(
        /Exercise 2:[\s\S]*?$/
      )?.[0] || "";

      const ex2Name = getLineValue(ex2Section, "Exercise 2:");
      const ex2Weight = getLineValue(ex2Section, "Weight:");
      const ex2Value = extractNumber(
        getLineValue(ex2Section, "Sets Complete:")
      );

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
