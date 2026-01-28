import { fetch as undiciFetch } from "undici";
import type { MoltbotConfig } from "../../config/config.js";
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
  validateNotionDatabasesParams,
  validateNotionProjectUpdateParams,
  validateNotionProjectsParams,
} from "../protocol/index.js";
import type { GatewayRequestHandlers } from "./types.js";

type NotionPropertyValue = {
  type?: string;
  [key: string]: unknown;
};

type NotionPage = {
  id: string;
  created_time?: string | null;
  last_edited_time?: string | null;
  url?: string | null;
  icon?: { type?: string; emoji?: string | null } | null;
  properties?: Record<string, NotionPropertyValue> | null;
};

type NotionDatabase = {
  properties?: Record<string, { type?: string }>;
};

type NotionDatabaseEntry = {
  id: string;
  title?: unknown;
  url?: string | null;
  icon?: { type?: string; emoji?: string | null } | null;
  created_time?: string | null;
  last_edited_time?: string | null;
};

type NotionProjectMetadata = {
  client?: string;
  deadline?: string;
  revenue?: number;
  impact?: string | number;
  techStack?: string[];
  description?: string;
  customColor?: string;
  icon?: string;
  size?: string;
};

type NotionProject = {
  id: string;
  name?: string | null;
  status?: string | null;
  type?: string | null;
  url?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
  metadata?: NotionProjectMetadata;
};

type NotionProjectsResult = {
  connected: boolean;
  projects: NotionProject[];
  error?: string;
};

type NotionDatabasesResult = {
  connected: boolean;
  databases: Array<{
    id: string;
    title?: string | null;
    url?: string | null;
    icon?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
  }>;
  error?: string;
};

type NotionProjectUpdateResult = {
  id: string;
  updated: boolean;
  error?: string;
};

type NotionPropertyMap = {
  name?: string;
  status?: string;
  type?: string;
  client?: string;
  deadline?: string;
  revenue?: string;
  impact?: string;
  techStack?: string;
  description?: string;
  customColor?: string;
  icon?: string;
  size?: string;
};

type NotionConfig = {
  enabled?: boolean;
  apiKey?: string;
  databaseId?: string;
  timeoutSeconds?: number;
  propertyMap?: NotionPropertyMap;
};

const DEFAULT_NOTION_VERSION = "2022-06-28";
const DEFAULT_TIMEOUT_SECONDS = 12;
const DEFAULT_PROPERTY_MAP: NotionPropertyMap = {
  name: "Name",
  status: "Status",
  type: "Type",
  client: "Client",
  deadline: "Deadline",
  revenue: "Revenue",
  impact: "Impact",
  techStack: "Tech Stack",
  description: "Description",
  customColor: "Color",
  icon: "Icon",
  size: "Size",
};

function resolveNotionConfig(cfg: MoltbotConfig): NotionConfig | null {
  const raw = cfg.integrations?.notion;
  if (!raw || typeof raw !== "object") return null;
  return raw as NotionConfig;
}

function resolvePropertyMap(cfg: NotionConfig): NotionPropertyMap {
  return { ...DEFAULT_PROPERTY_MAP, ...cfg.propertyMap };
}

function buildNotionUrl(resource: string): string {
  const base = new URL("https://api.notion.com/v1");
  const normalized = resource.startsWith("/") ? resource : `/${resource}`;
  base.pathname = normalized;
  return base.toString();
}

async function requestNotionJson(params: {
  url: string;
  apiKey: string;
  timeoutSeconds: number;
  method?: "GET" | "POST" | "PATCH";
  body?: Record<string, unknown> | null;
}): Promise<unknown> {
  const parsed = new URL(params.url);
  if (!parsed.protocol.startsWith("http")) {
    throw new Error("Notion URL must be http or https");
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
        Authorization: `Bearer ${params.apiKey}`,
        "Notion-Version": DEFAULT_NOTION_VERSION,
        ...(method === "GET" ? {} : { "Content-Type": "application/json" }),
      },
      body,
      dispatcher,
      signal: AbortSignal.timeout(params.timeoutSeconds * 1000),
    });
    const responseBody = await res.text();
    if (!res.ok) {
      const detail = responseBody.trim();
      throw new Error(`Notion API request failed (${res.status}): ${detail || res.statusText}`);
    }
    return responseBody ? JSON.parse(responseBody) : {};
  } finally {
    await closeDispatcher(dispatcher);
  }
}

function getRichTextText(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((entry) => {
      if (!entry || typeof entry !== "object") return "";
      const record = entry as { plain_text?: string };
      return record.plain_text ?? "";
    })
    .filter(Boolean)
    .join("");
}

function getPropertyText(property: NotionPropertyValue | undefined): string | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  const type = record.type;
  if (type === "title") return getRichTextText(record.title);
  if (type === "rich_text") return getRichTextText(record.rich_text);
  if (type === "select") return (record.select as { name?: string } | undefined)?.name ?? null;
  if (type === "status") return (record.status as { name?: string } | undefined)?.name ?? null;
  if (type === "url") return (record.url as string | null) ?? null;
  return null;
}

function getPropertyNumber(property: NotionPropertyValue | undefined): number | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (record.type !== "number") return null;
  return typeof record.number === "number" ? record.number : null;
}

function getPropertyDate(property: NotionPropertyValue | undefined): string | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (record.type !== "date") return null;
  const date = record.date as { start?: string | null } | undefined;
  return date?.start ?? null;
}

function getPropertyMultiSelect(property: NotionPropertyValue | undefined): string[] | null {
  if (!property || typeof property !== "object") return null;
  const record = property as Record<string, unknown>;
  if (record.type !== "multi_select") return null;
  const entries = record.multi_select as Array<{ name?: string | null }> | undefined;
  if (!Array.isArray(entries)) return null;
  const names = entries.map((entry) => entry?.name ?? "").filter(Boolean);
  return names.length ? names : null;
}

function normalizeSize(value: string | null): string | undefined {
  if (!value) return undefined;
  const lower = value.toLowerCase();
  if (lower.includes("small")) return "small";
  if (lower.includes("large")) return "large";
  if (lower.includes("medium") || lower.includes("med")) return "medium";
  return undefined;
}

function parseNotionProject(page: NotionPage, map: NotionPropertyMap): NotionProject {
  const props = page.properties ?? {};
  const name = getPropertyText(props[map.name ?? "Name"]);
  const status = getPropertyText(props[map.status ?? "Status"]);
  const type = getPropertyText(props[map.type ?? "Type"]);

  const metadata: NotionProjectMetadata = {};
  const client = getPropertyText(props[map.client ?? "Client"]);
  if (client) metadata.client = client;

  const deadline = getPropertyDate(props[map.deadline ?? "Deadline"]);
  if (deadline) metadata.deadline = deadline;

  const revenue = getPropertyNumber(props[map.revenue ?? "Revenue"]);
  if (typeof revenue === "number") metadata.revenue = revenue;

  const impactValue = getPropertyNumber(props[map.impact ?? "Impact"]);
  const impactText = getPropertyText(props[map.impact ?? "Impact"]);
  if (typeof impactValue === "number") metadata.impact = impactValue;
  else if (impactText) metadata.impact = impactText;

  const techStack = getPropertyMultiSelect(props[map.techStack ?? "Tech Stack"]);
  if (techStack) metadata.techStack = techStack;

  const description = getPropertyText(props[map.description ?? "Description"]);
  if (description) metadata.description = description;

  const customColor = getPropertyText(props[map.customColor ?? "Color"]);
  if (customColor) metadata.customColor = customColor;

  const iconProperty = getPropertyText(props[map.icon ?? "Icon"]);
  const iconEmoji = page.icon?.type === "emoji" ? (page.icon.emoji ?? null) : null;
  const resolvedIcon = iconProperty || iconEmoji;
  if (resolvedIcon) metadata.icon = resolvedIcon;

  const sizeValue = getPropertyText(props[map.size ?? "Size"]);
  const size = normalizeSize(sizeValue);
  if (size) metadata.size = size;

  return {
    id: page.id,
    name: name ?? null,
    status: status ?? null,
    type: type ?? null,
    url: page.url ?? null,
    createdAt: page.created_time ?? null,
    updatedAt: page.last_edited_time ?? null,
    metadata: Object.keys(metadata).length ? metadata : undefined,
  };
}

function parseNotionDatabase(entry: NotionDatabaseEntry): {
  id: string;
  title?: string | null;
  url?: string | null;
  icon?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
} | null {
  if (!entry.id) return null;
  const title = getRichTextText(entry.title);
  const icon = entry.icon?.type === "emoji" ? (entry.icon.emoji ?? null) : null;
  return {
    id: entry.id,
    title: title || null,
    url: entry.url ?? null,
    icon,
    createdAt: entry.created_time ?? null,
    updatedAt: entry.last_edited_time ?? null,
  };
}

async function fetchNotionDatabases(params: {
  apiKey: string;
  timeoutSeconds: number;
}): Promise<NotionDatabasesResult["databases"]> {
  const databases: NotionDatabasesResult["databases"] = [];
  const url = buildNotionUrl("/search");
  let cursor: string | null = null;
  let hasMore = true;

  while (hasMore) {
    const payload = await requestNotionJson({
      url,
      apiKey: params.apiKey,
      timeoutSeconds: params.timeoutSeconds,
      method: "POST",
      body: {
        page_size: 100,
        filter: { property: "object", value: "database" },
        ...(cursor ? { start_cursor: cursor } : {}),
      },
    });

    if (!payload || typeof payload !== "object") break;
    const record = payload as Record<string, unknown>;
    const results = Array.isArray(record.results) ? (record.results as NotionDatabaseEntry[]) : [];
    for (const entry of results) {
      if (!entry || typeof entry !== "object") continue;
      const parsed = parseNotionDatabase(entry);
      if (parsed) databases.push(parsed);
    }
    hasMore = Boolean(record.has_more);
    cursor = typeof record.next_cursor === "string" ? record.next_cursor : null;
    if (hasMore && !cursor) break;
  }

  return databases;
}

function extractNotionPages(payload: unknown): NotionPage[] {
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  const results = record.results;
  if (!Array.isArray(results)) return [];
  return results.filter((entry) => entry && typeof entry === "object") as NotionPage[];
}

function buildPropertyUpdate(
  type: string | undefined,
  value: string | number | string[] | null | undefined,
): Record<string, unknown> | null {
  if (value === undefined) return null;
  if (type === "status") {
    return { status: value === null ? null : { name: String(value) } };
  }
  if (type === "select") {
    return { select: value === null ? null : { name: String(value) } };
  }
  if (type === "multi_select") {
    if (value === null) return { multi_select: [] };
    if (Array.isArray(value)) {
      return { multi_select: value.map((entry) => ({ name: entry })) };
    }
    return { multi_select: [{ name: String(value) }] };
  }
  if (type === "number") {
    if (value === null) return { number: null };
    return typeof value === "number" ? { number: value } : null;
  }
  if (type === "date") {
    if (value === null) return { date: null };
    return typeof value === "string" ? { date: { start: value } } : null;
  }
  if (type === "title") {
    if (value === null) return { title: [] };
    return { title: [{ text: { content: String(value) } }] };
  }
  if (type === "rich_text") {
    if (value === null) return { rich_text: [] };
    return { rich_text: [{ text: { content: String(value) } }] };
  }
  return null;
}

async function fetchDatabaseSchema(params: {
  apiKey: string;
  databaseId: string;
  timeoutSeconds: number;
}): Promise<NotionDatabase> {
  const url = buildNotionUrl(`/databases/${params.databaseId}`);
  const payload = await requestNotionJson({
    url,
    apiKey: params.apiKey,
    timeoutSeconds: params.timeoutSeconds,
    method: "GET",
  });
  return (payload ?? {}) as NotionDatabase;
}

function buildNotionUpdateProperties(params: {
  status?: string;
  metadata?: NotionProjectMetadata;
  propertyMap: NotionPropertyMap;
  database: NotionDatabase;
}): Record<string, unknown> {
  const properties: Record<string, unknown> = {};
  const dbProps = params.database.properties ?? {};
  const map = params.propertyMap;

  const statusName = map.status ?? "Status";
  if (params.status) {
    const statusType = dbProps[statusName]?.type;
    const update = buildPropertyUpdate(statusType, params.status);
    if (update) properties[statusName] = update;
  }

  const metadata = params.metadata ?? {};
  const metadataEntries: Array<
    [keyof NotionProjectMetadata, string, string | number | string[] | null | undefined]
  > = [
    ["client", map.client ?? "Client", metadata.client],
    ["deadline", map.deadline ?? "Deadline", metadata.deadline],
    ["revenue", map.revenue ?? "Revenue", metadata.revenue],
    ["impact", map.impact ?? "Impact", metadata.impact],
    ["techStack", map.techStack ?? "Tech Stack", metadata.techStack],
    ["description", map.description ?? "Description", metadata.description],
    ["customColor", map.customColor ?? "Color", metadata.customColor],
    ["icon", map.icon ?? "Icon", metadata.icon],
    ["size", map.size ?? "Size", metadata.size],
  ];

  for (const [, propName, value] of metadataEntries) {
    if (value === undefined) continue;
    const propType = dbProps[propName]?.type;
    const update = buildPropertyUpdate(
      propType,
      value as string | number | string[] | null | undefined,
    );
    if (update) properties[propName] = update;
  }

  return properties;
}

function normalizeMetadataInput(value: unknown): NotionProjectMetadata {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const record = value as Record<string, unknown>;
  const metadata: NotionProjectMetadata = {};
  if (typeof record.client === "string" && record.client.trim()) metadata.client = record.client;
  if (typeof record.deadline === "string" && record.deadline.trim())
    metadata.deadline = record.deadline;
  if (typeof record.revenue === "number" && Number.isFinite(record.revenue)) {
    metadata.revenue = record.revenue;
  }
  if (typeof record.impact === "string" && record.impact.trim()) metadata.impact = record.impact;
  if (typeof record.impact === "number" && Number.isFinite(record.impact)) {
    metadata.impact = record.impact;
  }
  if (Array.isArray(record.techStack)) {
    const techStack = record.techStack.filter((entry) => typeof entry === "string" && entry.trim());
    if (techStack.length) metadata.techStack = techStack as string[];
  }
  if (typeof record.description === "string" && record.description.trim()) {
    metadata.description = record.description;
  }
  if (typeof record.customColor === "string" && record.customColor.trim()) {
    metadata.customColor = record.customColor;
  }
  if (typeof record.icon === "string" && record.icon.trim()) metadata.icon = record.icon;
  if (typeof record.size === "string" && record.size.trim()) metadata.size = record.size;
  return metadata;
}

export const notionHandlers: GatewayRequestHandlers = {
  "notion.databases": async ({ params, respond }) => {
    if (!validateNotionDatabasesParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid notion.databases params: ${formatValidationErrors(
            validateNotionDatabasesParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const notionConfig = resolveNotionConfig(cfg);
    if (!notionConfig?.enabled) {
      respond(true, { connected: false, databases: [] } satisfies NotionDatabasesResult, undefined);
      return;
    }

    const apiKey = notionConfig.apiKey?.trim() ?? "";
    if (!apiKey) {
      respond(
        true,
        {
          connected: false,
          databases: [],
          error: "Notion apiKey not configured",
        } satisfies NotionDatabasesResult,
        undefined,
      );
      return;
    }

    const timeoutSeconds =
      typeof notionConfig.timeoutSeconds === "number" && notionConfig.timeoutSeconds > 0
        ? Math.floor(notionConfig.timeoutSeconds)
        : DEFAULT_TIMEOUT_SECONDS;

    try {
      const databases = await fetchNotionDatabases({ apiKey, timeoutSeconds });
      respond(true, { connected: true, databases } satisfies NotionDatabasesResult, undefined);
    } catch (err) {
      respond(
        true,
        {
          connected: false,
          databases: [],
          error: err instanceof Error ? err.message : "Failed to fetch Notion databases",
        } satisfies NotionDatabasesResult,
        undefined,
      );
    }
  },
  "notion.projects": async ({ params, respond }) => {
    if (!validateNotionProjectsParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid notion.projects params: ${formatValidationErrors(
            validateNotionProjectsParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const notionConfig = resolveNotionConfig(cfg);
    if (!notionConfig?.enabled) {
      respond(true, { connected: false, projects: [] } satisfies NotionProjectsResult, undefined);
      return;
    }

    const apiKey = notionConfig.apiKey?.trim() ?? "";
    const databaseId = notionConfig.databaseId?.trim() ?? "";
    if (!apiKey || !databaseId) {
      respond(
        true,
        {
          connected: false,
          projects: [],
          error: "Notion apiKey or databaseId not configured",
        } satisfies NotionProjectsResult,
        undefined,
      );
      return;
    }

    const timeoutSeconds =
      typeof notionConfig.timeoutSeconds === "number" && notionConfig.timeoutSeconds > 0
        ? Math.floor(notionConfig.timeoutSeconds)
        : DEFAULT_TIMEOUT_SECONDS;
    const propertyMap = resolvePropertyMap(notionConfig);

    try {
      const url = buildNotionUrl(`/databases/${databaseId}/query`);
      const payload = await requestNotionJson({
        url,
        apiKey,
        timeoutSeconds,
        method: "POST",
        body: { page_size: 100 },
      });
      const pages = extractNotionPages(payload);
      const projects = pages.map((page) => parseNotionProject(page, propertyMap));
      respond(true, { connected: true, projects } satisfies NotionProjectsResult, undefined);
    } catch (err) {
      respond(
        true,
        {
          connected: false,
          projects: [],
          error: err instanceof Error ? err.message : "Failed to fetch Notion projects",
        } satisfies NotionProjectsResult,
        undefined,
      );
    }
  },
  "notion.project.update": async ({ params, respond }) => {
    if (!validateNotionProjectUpdateParams(params)) {
      respond(
        false,
        undefined,
        errorShape(
          ErrorCodes.INVALID_REQUEST,
          `invalid notion.project.update params: ${formatValidationErrors(
            validateNotionProjectUpdateParams.errors,
          )}`,
        ),
      );
      return;
    }

    const cfg = loadConfig();
    const notionConfig = resolveNotionConfig(cfg);
    if (!notionConfig?.enabled) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.UNAVAILABLE, "Notion integration is disabled"),
      );
      return;
    }

    const apiKey = notionConfig.apiKey?.trim() ?? "";
    const databaseId = notionConfig.databaseId?.trim() ?? "";
    if (!apiKey || !databaseId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "Notion apiKey or databaseId not configured"),
      );
      return;
    }

    const timeoutSeconds =
      typeof notionConfig.timeoutSeconds === "number" && notionConfig.timeoutSeconds > 0
        ? Math.floor(notionConfig.timeoutSeconds)
        : DEFAULT_TIMEOUT_SECONDS;

    const payload = params as { id: string; status?: string; metadata?: unknown };
    const pageId = payload.id.trim();
    if (!pageId) {
      respond(
        false,
        undefined,
        errorShape(ErrorCodes.INVALID_REQUEST, "invalid notion.project.update params: missing id"),
      );
      return;
    }

    const propertyMap = resolvePropertyMap(notionConfig);
    const metadata = normalizeMetadataInput(payload.metadata);

    try {
      const database = await fetchDatabaseSchema({ apiKey, databaseId, timeoutSeconds });
      const properties = buildNotionUpdateProperties({
        status: payload.status?.trim() || undefined,
        metadata,
        propertyMap,
        database,
      });

      if (Object.keys(properties).length === 0) {
        respond(
          true,
          {
            id: pageId,
            updated: false,
            error: "No Notion properties to update",
          } satisfies NotionProjectUpdateResult,
          undefined,
        );
        return;
      }

      const url = buildNotionUrl(`/pages/${pageId}`);
      await requestNotionJson({
        url,
        apiKey,
        timeoutSeconds,
        method: "PATCH",
        body: { properties },
      });

      respond(true, { id: pageId, updated: true } satisfies NotionProjectUpdateResult, undefined);
    } catch (err) {
      respond(
        true,
        {
          id: pageId,
          updated: false,
          error: err instanceof Error ? err.message : "Failed to update Notion project",
        } satisfies NotionProjectUpdateResult,
        undefined,
      );
    }
  },
};
