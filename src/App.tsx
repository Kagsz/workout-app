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

function parseSession(input: string): ParsedSession {
  const sessionNumber = Number(input.match(/Session #:\s*(\d+)/)?.[1] || 0);
  const date = input.match(/Date:\s*([^\n]+)/)?.[1]?.trim() || "";
  const routine = input.match(/Routine:\s*([^\n]+)/)?.[1]?.trim() || "";

  const blockSections = input.split(/Paired Block|Single Block/).slice(1);

  const blockHeaders = input.match(/Paired Block [A-Z]|Single Block/g) || [];

  const blocks: ParsedBlock[] = blockSections.map((section, index) => {
    const header = blockHeaders[index];

    const isPaired = header.includes("Paired");
    const labelMatch = header.match(/Block ([A-Z])/);

    if (isPaired) {
      const ex1Name = section.match(/Exercise 1:\s*([^\n]+)/)?.[1];
      const ex1Weight = section.match(/Exercise 1:[\s\S]*?Weight:\s*([^\n]+)/)?.[1];
      const ex1Value = extractNumber(section.match(/Exercise 1:[\s\S]*?Sets Complete:\s*([^\n]+)/)?.[1]);

      const ex2Name = section.match(/Exercise 2:\s*([^\n]+)/)?.[1];
      const ex2Weight = section.match(/Exercise 2:[\s\S]*?Weight:\s*([^\n]+)/)?.[1];
      const ex2Value = extractNumber(section.match(/Exercise 2:[\s\S]*?Sets Complete:\s*([^\n]+)/)?.[1]);

      return {
        type: "paired",
        label: labelMatch?.[1],
        exercises: [
          { name: ex1Name || "", weight: ex1Weight, value: ex1Value },
          { name: ex2Name || "", weight: ex2Weight, value: ex2Value },
        ],
      };
    } else {
      const name = section.match(/Exercise:\s*([^\n]+)/)?.[1];
      const weight = section.match(/Weight:\s*([^\n]+)/)?.[1];
      const value = extractNumber(section.match(/Performance:\s*([^\n]+)/)?.[1]);

      return {
        type: "single",
        exercises: [{ name: name || "", weight, value }],
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
