import React from "react";

// ===== CLEAN V2 (STEP 2) =====

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
    {
      id: "p1-d1",
      label: "Day 1",
      order: 1,
      blocks: [
        {
          id: "p1-d1-a",
          label: "Block A",
          order: 1,
          type: "paired",
          slots: [
            {
              id: "p1-d1-a-1",
              order: 1,
              lineStyle: "solid",
              baseShape: "circle",
              allowedExercises: [{ id: "skydivers", name: "Skydivers" }],
            },
            {
              id: "p1-d1-a-2",
              order: 2,
              lineStyle: "dashed",
              baseShape: "square",
              allowedExercises: [{ id: "goblet", name: "Goblet Squat" }],
            },
          ],
        },
      ],
    },
    {
      id: "p1-d2",
      label: "Day 2",
      order: 2,
      blocks: [],
    },
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

// ---------- APP ----------

export default function AppV2() {
  const programs = [PROGRAM_1, PROGRAM_2];

  return (
    <div style={{ padding: 20 }}>
      <h1>V2 Clean Build</h1>
      <p>Programs: {programs.length}</p>

      {programs.map((p) => (
        <div key={p.id} style={{ marginBottom: 20 }}>
          <h2>{p.name}</h2>
          <p>Routines: {p.routines.length}</p>
        </div>
      ))}
    </div>
  );
}
