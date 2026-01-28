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

export type SheetsIntegrationConfig = {
  /** Enable Google Sheets metrics import. */
  enabled?: boolean;
  /** Google API key for Sheets access. */
  apiKey?: string;
  /** The spreadsheet ID from the Google Sheets URL. */
  spreadsheetId?: string;
  /** Timeout for Sheets API requests (seconds). */
  timeoutSeconds?: number;
  /** Sheet range for metrics data (default: Metrics!A1:B10). */
  metricsRange?: string;
  /** Sheet range for leads data (default: Leads!A2:F100). */
  leadsRange?: string;
  /** Mapping of metric labels to standard fields. */
  metricsMap?: {
    monthlyRevenue?: string;
    pipelineValue?: string;
    responseRate?: string;
    activeLeads?: string;
    averageProjectValue?: string;
  };
  /** Mapping of column headers to lead fields. */
  leadsMap?: {
    name?: string;
    company?: string;
    value?: string;
    status?: string;
    source?: string;
  };
};

export type IntegrationsConfig = {
  n8n?: N8nIntegrationConfig;
  notion?: NotionIntegrationConfig;
  sheets?: SheetsIntegrationConfig;
};
