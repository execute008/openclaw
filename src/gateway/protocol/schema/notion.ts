import { Type } from "@sinclair/typebox";

export const NotionProjectsParamsSchema = Type.Object({}, { additionalProperties: false });

export const NotionProjectUpdateParamsSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    status: Type.Optional(Type.String({ minLength: 1 })),
    metadata: Type.Optional(
      Type.Object(
        {
          client: Type.Optional(Type.String({ minLength: 1 })),
          deadline: Type.Optional(Type.String({ minLength: 1 })),
          revenue: Type.Optional(Type.Number()),
          impact: Type.Optional(Type.Unknown()),
          techStack: Type.Optional(Type.Array(Type.String())),
          description: Type.Optional(Type.String({ minLength: 1 })),
          customColor: Type.Optional(Type.String({ minLength: 1 })),
          icon: Type.Optional(Type.String({ minLength: 1 })),
          size: Type.Optional(Type.String({ minLength: 1 })),
        },
        { additionalProperties: false },
      ),
    ),
  },
  { additionalProperties: false },
);

export const NotionProjectUpdateResultSchema = Type.Object(
  {
    id: Type.String({ minLength: 1 }),
    updated: Type.Boolean(),
    error: Type.Optional(Type.String()),
  },
  { additionalProperties: false },
);
