import { Type } from "@sinclair/typebox";

export const N8nWorkflowsParamsSchema = Type.Object({}, { additionalProperties: false });

export const N8nTriggerParamsSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    payload: Type.Optional(Type.Record(Type.String(), Type.Unknown())),
  },
  { additionalProperties: false },
);

export const N8nTriggerResultSchema = Type.Object(
  {
    workflowId: Type.String({ minLength: 1 }),
    triggered: Type.Boolean(),
    executionId: Type.Optional(Type.String({ minLength: 1 })),
  },
  { additionalProperties: false },
);
