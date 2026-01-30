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
  validateN8nTriggerParams,
  validateN8nWorkflowsParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

type N8nWorkflow = {
  id: string;
  name?: string | null;
  active?: boolean | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  tags?: Array<{ id?: string | null; name?: string | null } | string> | null;
  lastExecution?: {
    status?: string | null;
    startedAt?: string | null;
    finishedAt?: string | null;
  } | null;
};

type N8nWorkflowsResult = {
  connected: boolean;
  workflows: N8nWorkflow[];
  error?: string;
};

type N8nTriggerResult = {
  workflowId: string;
  triggered: boolean;
  executionId?: string;
};

type N8nConfig = {
  enabled?: boolean;
  baseUrl?: string;
  apiKey?: string;
  apiPath?: string;
  workflowIds?: string[];
  includeInactive?: boolean;
  timeoutSeconds?: number;
};

const DEFAULT_API_PATH = "/api/v1";
const DEFAULT_TIMEOUT_SECONDS = 10;

function resolveN8nConfig(cfg: OpenClawConfig): N8nConfig | null {
  const raw = cfg.integrations?.n8n;
  if (!raw || typeof raw !== "object") return null;
  return raw as N8nConfig;
}

function buildN8nApiUrl(params: { baseUrl: string; apiPath?: string; resource: string }): string {
  const base = new URL(params.baseUrl);
  const basePath = base.pathname.replace(/\/$/, "");
  const apiPath = (params.apiPath || DEFAULT_API_PATH).trim();
  const normalizedApi = apiPath.startsWith("/") ? apiPath : `/${apiPath}`;
  const normalizedResource = params.resource.startsWith("/")
    ? params.resource
    : `/${params.resource}`;
  base.pathname = `${basePath}${normalizedApi}${normalizedResource}`;
  return base.toString();
}

async function requestN8nJson(params: {
  url: string;
  apiKey: string;
  timeoutSeconds: number;
  method?: "GET" | "POST";
  body?: Record<string, unknown> | null;
}): Promise<unknown> {
  const parsed = new URL(params.url);
  if (!parsed.protocol.startsWith("http")) {
    throw new Error("n8n URL must be http or https");
  }
  const pinned = await resolvePinnedHostname(parsed.hostname);
  const dispatcher = createPinnedDispatcher(pinned);
  const method = params.method ?? "GET";
  const body = method === "GET" ? undefined : JSON.stringify(params.body ?? {});
  try {
    const res = await undiciFetch(params.url, {
      method,
      headers: {
        Accept: "application/json",
        "X-N8N-API-KEY": params.apiKey,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      body,
      dispatcher,
      signal: AbortSignal.timeout(params.timeoutSeconds * 1000),
    });
    const responseBody = await res.text();
    if (!res.ok) {
      const detail = responseBody.trim();
      throw new Error(`n8n API request failed (${res.status}): ${detail || res.statusText}`);
    }
    return responseBody ? JSON.parse(responseBody) : {};
  } finally {
    await closeDispatcher(dispatcher);
  }
}

function extractWorkflows(payload: unknown): N8nWorkflow[] {
  if (Array.isArray(payload)) {
    return payload.filter((entry) => entry && typeof entry === "object") as N8nWorkflow[];
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const data = record.data;
  if (Array.isArray(data)) {
    return data.filter((entry) => entry && typeof entry === "object") as N8nWorkflow[];
  }
  const workflows = record.workflows;
  if (Array.isArray(workflows)) {
    return workflows.filter((entry) => entry && typeof entry === "object") as N8nWorkflow[];
  }
  return [];
}

function filterWorkflows(workflows: N8nWorkflow[], cfg: N8nConfig): N8nWorkflow[] {
  const normalizedIds = new Set((cfg.workflowIds ?? []).map((id) => id.trim()).filter(Boolean));
  const filtered = normalizedIds.size
    ? workflows.filter((workflow) => normalizedIds.has(String(workflow.id)))
    : workflows;
  if (cfg.includeInactive) return filtered;
  return filtered.filter((workflow) => workflow.active !== false);
}

export const n8nHandlers: GatewayRequestHandlers = {
  "n8n.workflows": async ({ params, respond }) => {
    if (!validateN8nWorkflowsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid n8n.workflows params: ${formatValidationErrors(
            validateN8nWorkflowsParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const n8nConfig = resolveN8nConfig(cfg);
    if (!n8nConfig?.enabled) {
      respond(true, { connected: false, workflows: [] } satisfies N8nWorkflowsResult, undefined);
      return;
    }

    const baseUrl = n8nConfig.baseUrl?.trim() ?? "";
    const apiKey = n8nConfig.apiKey?.trim() ?? "";
    if (!baseUrl || !apiKey) {
      respond(
        true,
        {
          connected: false,
          workflows: [],
          error: "n8n baseUrl or apiKey not configured",
        } satisfies N8nWorkflowsResult,
        undefined,
      );
      return;
    }

    const timeoutSeconds =
      typeof n8nConfig.timeoutSeconds === "number" && n8nConfig.timeoutSeconds > 0
        ? Math.floor(n8nConfig.timeoutSeconds)
        : DEFAULT_TIMEOUT_SECONDS;

    try {
      const url = buildN8nApiUrl({
        baseUrl,
        apiPath: n8nConfig.apiPath,
        resource: "/workflows",
      });
      const payload = await requestN8nJson({ url, apiKey, timeoutSeconds, method: "GET" });
      const workflows = filterWorkflows(extractWorkflows(payload), n8nConfig);
      respond(true, { connected: true, workflows } satisfies N8nWorkflowsResult, undefined);
    } catch (err) {
      respond(
        true,
        {
          connected: false,
          workflows: [],
          error: err instanceof Error ? err.message : "Failed to fetch n8n workflows",
        } satisfies N8nWorkflowsResult,
        undefined,
      );
    }
  },
  "n8n.trigger": async ({ params, respond }) => {
    if (!validateN8nTriggerParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid n8n.trigger params: ${formatValidationErrors(validateN8nTriggerParams.errors)}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const n8nConfig = resolveN8nConfig(cfg);
    if (!n8nConfig?.enabled) {
      respond(false, undefined, errorShape(ErrorCodes.UNAVAILABLE, "n8n integration is disabled"));
      return;
    }

    const baseUrl = n8nConfig.baseUrl?.trim() ?? "";
    const apiKey = n8nConfig.apiKey?.trim() ?? "";
    if (!baseUrl || !apiKey) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "n8n baseUrl or apiKey not configured"),
      );
      return;
    }

    const timeoutSeconds =
      typeof n8nConfig.timeoutSeconds === "number" && n8nConfig.timeoutSeconds > 0
        ? Math.floor(n8nConfig.timeoutSeconds)
        : DEFAULT_TIMEOUT_SECONDS;
    const p = params as { id: string; payload?: Record<string, unknown> };
    const workflowId = p.id.trim();
    if (!workflowId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid n8n.trigger params: missing id"),
      );
      return;
    }

    try {
      const url = buildN8nApiUrl({
        baseUrl,
        apiPath: n8nConfig.apiPath,
        resource: `/workflows/${encodeURIComponent(workflowId)}/run`,
      });
      const payload = await requestN8nJson({
        url,
        apiKey,
        timeoutSeconds,
        method: "POST",
        body: p.payload ?? {},
      });
      const rawExecutionId =
        payload && typeof payload === "object" && "id" in payload
          ? (payload as { id?: unknown }).id
          : undefined;
      const executionId =
        typeof rawExecutionId === "string"
          ? rawExecutionId
          : typeof rawExecutionId === "number"
            ? String(rawExecutionId)
            : undefined;
      respond(
        true,
        {
          workflowId,
          triggered: true,
          executionId: executionId?.trim() ? executionId : undefined,
        } satisfies N8nTriggerResult,
        undefined,
      );
    } catch (err) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.UNAVAILABLE,
          err instanceof Error ? err.message : "Failed to trigger n8n workflow",
        ),
      );
    }
  },
};
