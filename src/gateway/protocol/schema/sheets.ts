import { Type } from "@sinclair/typebox";

export const SheetsMetricsParamsSchema = Type.Object({}, { additionalProperties: false });

export type SheetsMetricsParams = {
  // Empty params - uses config from moltbot.yml
};

export type SheetsMetrics = {
  monthlyRevenue?: number;
  pipelineValue?: number;
  responseRate?: number;
  activeLeads?: number;
  averageProjectValue?: number;
};

export type SheetsLead = {
  id: string;
  name?: string;
  company?: string;
  value?: number;
  status?: string;
  source?: string;
};

export type SheetsMetricsResult = {
  connected: boolean;
  metrics?: SheetsMetrics;
  leads?: SheetsLead[];
  error?: string;
};
