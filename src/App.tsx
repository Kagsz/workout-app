import React from "react";

// ===== V2 STEP 3 (IMPORTER ADDED) =====

// ---------- TYPES ----------

type BlockType = "paired" | "single";

type ProgramDefinition = {
  id: string;
  name: string;
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
  slots: ExerciseSlotDefinition[];
};

type ExerciseSlotDefinition = {
  id: string;
  order: number;
  lineStyle: "solid" | "dashed";
  baseShape: "circle" | "square";
  allowedExercises: ExerciseDefinition[];
};

type ExerciseDefinition = {
  id: string;
  name: string;
};

// ---------- PROGRAMS ----------

const PROGRAM_1: ProgramDefinition = {
  id: "program-1",
  name: "Program 1",
  routines: [
    { id: "p1-d1", label: "Day 1", order: 1, blocks: [] },
    { id: "p1-d2", label: "Day 2", order: 2, blocks: [] },
  ],
};

const PROGRAM_2: ProgramDefinition = {
  id: "program-2",
  name: "Program 2",
  routines: [
    { id: "p2-d1", label: "Day 1", order: 1, blocks: [] },
    { id: "p2-d2", label: "Day 2", order: 2, blocks: [] },
    { id: "p2-d3", label: "Day 3", order: 3, blocks: [] },
    { id: "p2-d4", label: "Day 4", order: 4, blocks: [] },
  ],
};

// ---------- IMPORTER ----------

type ImportDraft = {
  sessionNumber: number;
  date: string;
  routineLabel: string;
};

type SessionRecord = {
  sessionNumber: number;
  date: string;
  routineLabel: string;
};

let sessionStore: SessionRecord[] = [];

function parseRelayText(input: string): ImportDraft[] {
  const blocks = input.split("Program:").filter(Boolean);

  return blocks.map((block) => {
    const sessionMatch = block.match(/Session #:\s*(\d+)/);
    const dateMatch = block.match(/Date:\s*([^\n]+)/);
    const routineMatch = block.match(/Routine:\s*([^\n]+)/);

    return {
      sessionNumber: sessionMatch ? Number(sessionMatch[1]) : 0,
      date: dateMatch ? dateMatch[1].trim() : "",
      routineLabel: routineMatch ? routineMatch[1].trim() : "",
    };
  });
}

function upsertSessions(newSessions: SessionRecord[]) {
  newSessions.forEach((incoming) => {
    const index = sessionStore.findIndex(
      (s) => s.sessionNumber === incoming.sessionNumber
    );

    if (index >= 0) {
      sessionStore[index] = incoming;
    } else {
      sessionStore.push(incoming);
    }
  });
}

// ---------- APP ----------

export default function AppV2() {
  const programs = [PROGRAM_1, PROGRAM_2];
  const [input, setInput] = React.useState("");

  const handleImport = () => {
    const drafts = parseRelayText(input);

    const sessions: SessionRecord[] = drafts.map((d) => ({
      sessionNumber: d.sessionNumber,
      date: d.date,
      routineLabel: d.routineLabel,
    }));

    upsertSessions(sessions);

    console.log("Imported Sessions:", sessionStore);
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>V2 Step 3</h1>

      <p>Programs: {programs.length}</p>

      {programs.map((p) => (
        <div key={p.id}>
          <h2>{p.name}</h2>
          <p>Routines: {p.routines.length}</p>
        </div>
      ))}

      <hr />

      <h3>Importer</h3>

      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={10}
        style={{ width: "100%" }}
      />

      <button onClick={handleImport} style={{ marginTop: 10 }}>
        Import Sessions
      </button>
    </div>
  );
}
