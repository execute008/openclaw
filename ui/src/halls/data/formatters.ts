import type { ProjectType } from "./types";

export function formatProjectTypeLabel(type: ProjectType): string {
  switch (type) {
    case "client":
      return "Client";
    case "personal":
      return "Personal";
    case "experiment":
      return "Experiment";
    default:
      return type;
  }
}
