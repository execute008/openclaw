import { fetch as undiciFetch } from "undici";

import type { OpenClawConfig } from "../../config/config.js";
import { loadConfig } from "../../config/config.js";
import {
  closeDispatcher,
  createPinnedDispatcher,
  resolvePinnedHostname,
} from "../../infra/net/ssrf.js";
import {
  ErrorCodes,
  errorShape,
  formatValidationErrors,
  validateSheetsMetricsParams,
} from "../protocol/index.js";
import type { SheetsMetrics, SheetsMetricsResult, SheetsLead } from "../protocol/schema/sheets.js";
import type { GatewayRequestHandlers } from "./types.js";

type SheetsMetricsMap = {
  monthlyRevenue?: string;
  pipelineValue?: string;
  responseRate?: string;
  activeLeads?: string;
  averageProjectValue?: string;
};

type SheetsLeadsMap = {
  name?: string;
  company?: string;
  value?: string;
  status?: string;
  source?: string;
};

type SheetsConfig = {
  enabled?: boolean;
  apiKey?: string;
  spreadsheetId?: string;
  timeoutSeconds?: number;
  metricsRange?: string;
  leadsRange?: string;
  metricsMap?: SheetsMetricsMap;
  leadsMap?: SheetsLeadsMap;
};

const DEFAULT_TIMEOUT_SECONDS = 10;
const DEFAULT_METRICS_RANGE = "Metrics!A1:B10";
const DEFAULT_LEADS_RANGE = "Leads!A2:F100";

const DEFAULT_METRICS_MAP: SheetsMetricsMap = {
  monthlyRevenue: "Monthly Revenue",
  pipelineValue: "Pipeline Value",
  responseRate: "Response Rate",
  activeLeads: "Active Leads",
  averageProjectValue: "Average Project Value",
};

const DEFAULT_LEADS_MAP: SheetsLeadsMap = {
  name: "Name",
  company: "Company",
  value: "Value",
  status: "Status",
  source: "Source",
};

function resolveSheetsConfig(cfg: OpenClawConfig): SheetsConfig | null {
  const raw = cfg.integrations?.sheets;
  if (!raw || typeof raw !== "object") return null;
  return raw as SheetsConfig;
}

function resolveMetricsMap(cfg: SheetsConfig): SheetsMetricsMap {
  return { ...DEFAULT_METRICS_MAP, ...cfg.metricsMap };
}

function resolveLeadsMap(cfg: SheetsConfig): SheetsLeadsMap {
  return { ...DEFAULT_LEADS_MAP, ...cfg.leadsMap };
}

function buildSheetsApiUrl(spreadsheetId: string, range: string): string {
  const encodedRange = encodeURIComponent(range);
  return `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodedRange}`;
}

async function requestSheetsJson(params: {
  url: string;
  apiKey: string;
  timeoutSeconds: number;
}): Promise<unknown> {
  const parsed = new URL(params.url);
  if (!parsed.protocol.startsWith("http")) {
    throw new Error("Sheets URL must be http or https");
  }
  const urlWithKey = `${params.url}?key=${params.apiKey}`;
  const pinned = await resolvePinnedHostname(parsed.hostname);
  const dispatcher = createPinnedDispatcher(pinned);
  try {
    const res = await undiciFetch(urlWithKey, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      dispatcher,
      signal: AbortSignal.timeout(params.timeoutSeconds * 1000),
    });
    const responseBody = await res.text();
    if (!res.ok) {
      const detail = responseBody.trim();
      throw new Error(
        `Google Sheets API request failed (${res.status}): ${detail || res.statusText}`,
      );
    }
    return responseBody ? JSON.parse(responseBody) : {};
  } finally {
    await closeDispatcher(dispatcher);
  }
}

type SheetsRangeResponse = {
  range?: string;
  majorDimension?: string;
  values?: string[][];
};

function parseMetricsFromRange(
  response: SheetsRangeResponse,
  metricsMap: SheetsMetricsMap,
): SheetsMetrics {
  const metrics: SheetsMetrics = {};
  const values = response.values ?? [];

  // Build a lookup map from label -> value
  const labelToValue: Record<string, string> = {};
  for (const row of values) {
    if (row.length >= 2) {
      const label = row[0]?.trim() ?? "";
      const value = row[1]?.trim() ?? "";
      if (label) labelToValue[label] = value;
    }
  }

  // Map configured labels to metrics
  if (metricsMap.monthlyRevenue) {
    const raw = labelToValue[metricsMap.monthlyRevenue];
    if (raw) {
      const parsed = parseFloat(raw.replace(/[$,]/g, ""));
      if (!Number.isNaN(parsed)) metrics.monthlyRevenue = parsed;
    }
  }

  if (metricsMap.pipelineValue) {
    const raw = labelToValue[metricsMap.pipelineValue];
    if (raw) {
      const parsed = parseFloat(raw.replace(/[$,]/g, ""));
      if (!Number.isNaN(parsed)) metrics.pipelineValue = parsed;
    }
  }

  if (metricsMap.responseRate) {
    const raw = labelToValue[metricsMap.responseRate];
    if (raw) {
      // Handle percentage formats like "85%" or "0.85"
      const cleaned = raw.replace(/%/g, "");
      let parsed = parseFloat(cleaned);
      if (!Number.isNaN(parsed)) {
        // If value is > 1, assume it's a percentage
        if (parsed > 1) parsed = parsed / 100;
        metrics.responseRate = parsed;
      }
    }
  }

  if (metricsMap.activeLeads) {
    const raw = labelToValue[metricsMap.activeLeads];
    if (raw) {
      const parsed = parseInt(raw.replace(/,/g, ""), 10);
      if (!Number.isNaN(parsed)) metrics.activeLeads = parsed;
    }
  }

  if (metricsMap.averageProjectValue) {
    const raw = labelToValue[metricsMap.averageProjectValue];
    if (raw) {
      const parsed = parseFloat(raw.replace(/[$,]/g, ""));
      if (!Number.isNaN(parsed)) metrics.averageProjectValue = parsed;
    }
  }

  return metrics;
}

function parseLeadsFromRange(
  response: SheetsRangeResponse,
  leadsMap: SheetsLeadsMap,
): SheetsLead[] {
  const values = response.values ?? [];
  if (values.length === 0) return [];

  // First row is headers
  const headers = values[0]?.map((h) => h?.trim() ?? "") ?? [];
  const dataRows = values.slice(1);

  // Find column indices based on leadsMap
  const colIndices: Record<string, number> = {};
  const mapKeys = ["name", "company", "value", "status", "source"] as const;
  for (const key of mapKeys) {
    const label = leadsMap[key];
    if (label) {
      const idx = headers.findIndex((h) => h.toLowerCase() === label.toLowerCase());
      if (idx >= 0) colIndices[key] = idx;
    }
  }

  const leads: SheetsLead[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!row || row.length === 0) continue;

    // Skip empty rows
    const hasData = row.some((cell) => cell?.trim());
    if (!hasData) continue;

    const lead: SheetsLead = {
      id: `lead-${i}`,
    };

    if (colIndices.name !== undefined && row[colIndices.name]) {
      lead.name = row[colIndices.name].trim();
    }

    if (colIndices.company !== undefined && row[colIndices.company]) {
      lead.company = row[colIndices.company].trim();
    }

    if (colIndices.value !== undefined && row[colIndices.value]) {
      const raw = row[colIndices.value].trim();
      const parsed = parseFloat(raw.replace(/[$,]/g, ""));
      if (!Number.isNaN(parsed)) lead.value = parsed;
    }

    if (colIndices.status !== undefined && row[colIndices.status]) {
      lead.status = row[colIndices.status].trim();
    }

    if (colIndices.source !== undefined && row[colIndices.source]) {
      lead.source = row[colIndices.source].trim();
    }

    leads.push(lead);
  }

  return leads;
}

export const sheetsHandlers: GatewayRequestHandlers = {
  "sheets.metrics": async ({ params, respond }) => {
    if (!validateSheetsMetricsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid sheets.metrics params: ${formatValidationErrors(
            validateSheetsMetricsParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const sheetsConfig = resolveSheetsConfig(cfg);
    if (!sheetsConfig?.enabled) {
      respond(true, { connected: false } satisfies SheetsMetricsResult, undefined);
      return;
    }

    const apiKey = sheetsConfig.apiKey?.trim() ?? "";
    const spreadsheetId = sheetsConfig.spreadsheetId?.trim() ?? "";
    if (!apiKey || !spreadsheetId) {
      respond(
        true,
        {
          connected: false,
          error: "Google Sheets apiKey or spreadsheetId not configured",
        } satisfies SheetsMetricsResult,
        undefined,
      );
      return;
    }

    const timeoutSeconds =
      typeof sheetsConfig.timeoutSeconds === "number" && sheetsConfig.timeoutSeconds > 0
        ? Math.floor(sheetsConfig.timeoutSeconds)
        : DEFAULT_TIMEOUT_SECONDS;

    const metricsMap = resolveMetricsMap(sheetsConfig);
    const leadsMap = resolveLeadsMap(sheetsConfig);
    const metricsRange = sheetsConfig.metricsRange?.trim() || DEFAULT_METRICS_RANGE;
    const leadsRange = sheetsConfig.leadsRange?.trim() || DEFAULT_LEADS_RANGE;

    try {
      // Fetch metrics and leads in parallel
      const [metricsResponse, leadsResponse] = await Promise.all([
        requestSheetsJson({
          url: buildSheetsApiUrl(spreadsheetId, metricsRange),
          apiKey,
          timeoutSeconds,
        }).catch(() => null),
        requestSheetsJson({
          url: buildSheetsApiUrl(spreadsheetId, leadsRange),
          apiKey,
          timeoutSeconds,
        }).catch(() => null),
      ]);

      const metrics = metricsResponse
        ? parseMetricsFromRange(metricsResponse as SheetsRangeResponse, metricsMap)
        : undefined;

      const leads = leadsResponse
        ? parseLeadsFromRange(leadsResponse as SheetsRangeResponse, leadsMap)
        : undefined;

      respond(
        true,
        {
          connected: true,
          metrics,
          leads,
        } satisfies SheetsMetricsResult,
        undefined,
      );
    } catch (err) {
      respond(
        true,
        {
          connected: false,
          error: err instanceof Error ? err.message : "Failed to fetch Google Sheets data",
        } satisfies SheetsMetricsResult,
        undefined,
      );
    }
  },
};
