export type N8nIntegrationConfig = {
  /** Enable n8n workflow sync. */
  enabled?: boolean;
  /** Base URL for the n8n instance (no /api suffix). */
  baseUrl?: string;
  /** API key from n8n user settings. */
  apiKey?: string;
  /** API base path (default: /api/v1). */
  apiPath?: string;
  /** Optional allowlist of workflow IDs to show in Halls. */
  workflowIds?: string[];
  /** Include inactive workflows in the Halls view. */
  includeInactive?: boolean;
  /** Timeout for n8n API requests (seconds). */
  timeoutSeconds?: number;
};

export type NotionIntegrationConfig = {
  /** Enable Notion project sync. */
  enabled?: boolean;
  /** Notion API key from the integration settings. */
  apiKey?: string;
  /** Notion database ID containing projects. */
  databaseId?: string;
  /** Timeout for Notion API requests (seconds). */
  timeoutSeconds?: number;
  /** Optional property name overrides for project fields. */
  propertyMap?: {
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
};

export type IntegrationsConfig = {
  n8n?: N8nIntegrationConfig;
  notion?: NotionIntegrationConfig;
};
