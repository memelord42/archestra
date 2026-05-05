import { and, desc, eq, ilike, inArray, isNull, or } from "drizzle-orm";
import db, { schema } from "@/database";
import { secretManager } from "@/secrets-manager";
import type {
  CatalogPreset,
  InsertInternalMcpCatalog,
  InternalMcpCatalog,
  LocalConfig,
  UpdateInternalMcpCatalog,
  UserConfig,
} from "@/types";
import McpCatalogLabelModel from "./mcp-catalog-label";
import McpCatalogTeamModel from "./mcp-catalog-team";
import McpServerModel from "./mcp-server";
import SecretModel from "./secret";

class InternalMcpCatalogModel {
  static async create(
    catalogItem: InsertInternalMcpCatalog,
    context?: { organizationId: string; authorId?: string },
  ): Promise<InternalMcpCatalog> {
    const { labels, teams, ...dbValues } = catalogItem;

    const insertValues = {
      ...dbValues,
      ...(context?.organizationId
        ? { organizationId: context.organizationId }
        : {}),
      ...(context?.authorId ? { authorId: context.authorId } : {}),
    };

    const [createdItem] = await db
      .insert(schema.internalMcpCatalogTable)
      .values(insertValues)
      .returning();

    if (labels && labels.length > 0) {
      await McpCatalogLabelModel.syncCatalogLabels(
        createdItem.id,
        labels.map((l) => ({ key: l.key, value: l.value })),
      );
    }

    if (teams && teams.length > 0) {
      await McpCatalogTeamModel.syncCatalogTeams(createdItem.id, teams);
    }

    const itemLabels = await McpCatalogLabelModel.getLabelsForCatalogItem(
      createdItem.id,
    );
    const itemTeams = await McpCatalogTeamModel.getTeamDetailsForCatalog(
      createdItem.id,
    );

    await InternalMcpCatalogModel.syncPresetChildren(createdItem);
    const childrenMap = await InternalMcpCatalogModel.getChildrenSummaries([
      createdItem.id,
    ]);
    const result: InternalMcpCatalog = {
      ...createdItem,
      labels: itemLabels,
      teams: itemTeams,
      children: childrenMap.get(createdItem.id) ?? [],
    };
    await InternalMcpCatalogModel.populateAuthorNames([result]);
    return result;
  }

  static async findAll(options?: {
    expandSecrets?: boolean;
    userId?: string;
    isAdmin?: boolean;
  }): Promise<InternalMcpCatalog[]> {
    const { expandSecrets = true, userId, isAdmin } = options ?? {};

    let dbItems: Array<typeof schema.internalMcpCatalogTable.$inferSelect>;

    if (userId && !isAdmin) {
      const accessibleIds =
        await McpCatalogTeamModel.getUserAccessibleCatalogIds(userId, false);
      if (accessibleIds.length === 0) return [];
      dbItems = await db
        .select()
        .from(schema.internalMcpCatalogTable)
        .where(
          and(
            inArray(schema.internalMcpCatalogTable.id, accessibleIds),
            isNull(schema.internalMcpCatalogTable.parentCatalogId),
          ),
        )
        .orderBy(desc(schema.internalMcpCatalogTable.createdAt));
    } else {
      dbItems = await db
        .select()
        .from(schema.internalMcpCatalogTable)
        .where(isNull(schema.internalMcpCatalogTable.parentCatalogId))
        .orderBy(desc(schema.internalMcpCatalogTable.createdAt));
    }

    const catalogItems =
      await InternalMcpCatalogModel.attachLabelsAndTeams(dbItems);

    if (expandSecrets) {
      await InternalMcpCatalogModel.expandSecrets(catalogItems);
    }

    await InternalMcpCatalogModel.populateAuthorNames(catalogItems);

    return catalogItems;
  }

  static async searchByQuery(
    query: string,
    options?: {
      expandSecrets?: boolean;
      userId?: string;
      isAdmin?: boolean;
    },
  ): Promise<InternalMcpCatalog[]> {
    const { expandSecrets = true, userId, isAdmin } = options ?? {};

    let dbItems: Array<typeof schema.internalMcpCatalogTable.$inferSelect>;

    const searchCondition = or(
      ilike(schema.internalMcpCatalogTable.name, `%${query}%`),
      ilike(schema.internalMcpCatalogTable.description, `%${query}%`),
    );

    if (userId && !isAdmin) {
      const accessibleIds =
        await McpCatalogTeamModel.getUserAccessibleCatalogIds(userId, false);
      if (accessibleIds.length === 0) return [];
      dbItems = await db
        .select()
        .from(schema.internalMcpCatalogTable)
        .where(
          and(
            inArray(schema.internalMcpCatalogTable.id, accessibleIds),
            isNull(schema.internalMcpCatalogTable.parentCatalogId),
            searchCondition,
          ),
        );
    } else {
      dbItems = await db
        .select()
        .from(schema.internalMcpCatalogTable)
        .where(
          and(
            isNull(schema.internalMcpCatalogTable.parentCatalogId),
            searchCondition,
          ),
        );
    }

    const catalogItems =
      await InternalMcpCatalogModel.attachLabelsAndTeams(dbItems);

    if (expandSecrets) {
      await InternalMcpCatalogModel.expandSecrets(catalogItems);
    }

    await InternalMcpCatalogModel.populateAuthorNames(catalogItems);

    return catalogItems;
  }

  static async findById(
    id: string,
    options?: {
      expandSecrets?: boolean;
      userId?: string;
      isAdmin?: boolean;
    },
  ): Promise<InternalMcpCatalog | null> {
    const { expandSecrets = true, userId, isAdmin } = options ?? {};

    if (userId && !isAdmin) {
      const hasAccess = await McpCatalogTeamModel.userHasCatalogAccess(
        userId,
        id,
        false,
      );
      if (!hasAccess) return null;
    }

    const [dbItem] = await db
      .select()
      .from(schema.internalMcpCatalogTable)
      .where(eq(schema.internalMcpCatalogTable.id, id));

    if (!dbItem) {
      return null;
    }

    const labels = await McpCatalogLabelModel.getLabelsForCatalogItem(id);
    const teams = await McpCatalogTeamModel.getTeamDetailsForCatalog(id);
    const childrenMap = await InternalMcpCatalogModel.getChildrenSummaries([
      id,
    ]);
    const catalogItem: InternalMcpCatalog = {
      ...dbItem,
      labels,
      teams,
      children: childrenMap.get(id) ?? [],
    };

    if (expandSecrets) {
      await InternalMcpCatalogModel.expandSecrets([catalogItem]);
    }

    await InternalMcpCatalogModel.populateAuthorNames([catalogItem]);

    return catalogItem;
  }

  /**
   * Find catalog item by ID with all secrets resolved to actual values.
   * Use this for runtime flows (OAuth, MCP server startup).
   */
  static async findByIdWithResolvedSecrets(
    id: string,
  ): Promise<InternalMcpCatalog | null> {
    const [dbItem] = await db
      .select()
      .from(schema.internalMcpCatalogTable)
      .where(eq(schema.internalMcpCatalogTable.id, id));

    if (!dbItem) {
      return null;
    }

    const labels = await McpCatalogLabelModel.getLabelsForCatalogItem(id);
    const teams = await McpCatalogTeamModel.getTeamDetailsForCatalog(id);
    const catalogItem: InternalMcpCatalog = {
      ...dbItem,
      labels,
      teams,
      children: [],
    };

    await InternalMcpCatalogModel.expandSecretsAndAlwaysResolveValues([
      catalogItem,
    ]);

    return catalogItem;
  }

  /**
   * Batch fetch multiple catalog items by IDs.
   * Returns a Map of catalog ID to catalog item.
   */
  static async getByIds(
    ids: string[],
  ): Promise<Map<string, InternalMcpCatalog>> {
    if (ids.length === 0) {
      return new Map();
    }

    const dbItems = await db
      .select()
      .from(schema.internalMcpCatalogTable)
      .where(inArray(schema.internalMcpCatalogTable.id, ids));

    const catalogItems =
      await InternalMcpCatalogModel.attachLabelsAndTeams(dbItems);

    const result = new Map<string, InternalMcpCatalog>();
    for (const item of catalogItems) {
      result.set(item.id, item);
    }

    return result;
  }

  static async findByName(name: string): Promise<InternalMcpCatalog | null> {
    const [dbItem] = await db
      .select()
      .from(schema.internalMcpCatalogTable)
      .where(eq(schema.internalMcpCatalogTable.name, name));

    if (!dbItem) {
      return null;
    }

    const labels = await McpCatalogLabelModel.getLabelsForCatalogItem(
      dbItem.id,
    );
    const teams = await McpCatalogTeamModel.getTeamDetailsForCatalog(dbItem.id);
    const childrenMap = await InternalMcpCatalogModel.getChildrenSummaries([
      dbItem.id,
    ]);
    return {
      ...dbItem,
      labels,
      teams,
      children: childrenMap.get(dbItem.id) ?? [],
    };
  }

  static async update(
    id: string,
    catalogItem: Partial<UpdateInternalMcpCatalog>,
  ): Promise<InternalMcpCatalog | null> {
    const { labels, teams, ...dbValues } = catalogItem;

    let dbItem: typeof schema.internalMcpCatalogTable.$inferSelect | undefined;

    if (Object.keys(dbValues).length > 0) {
      [dbItem] = await db
        .update(schema.internalMcpCatalogTable)
        .set(dbValues)
        .where(eq(schema.internalMcpCatalogTable.id, id))
        .returning();
    } else {
      [dbItem] = await db
        .select()
        .from(schema.internalMcpCatalogTable)
        .where(eq(schema.internalMcpCatalogTable.id, id));
    }

    if (!dbItem) {
      return null;
    }

    if (labels !== undefined) {
      await McpCatalogLabelModel.syncCatalogLabels(
        id,
        labels.map((l) => ({ key: l.key, value: l.value })),
      );
    }

    if (teams !== undefined) {
      await McpCatalogTeamModel.syncCatalogTeams(id, teams);
    }

    const itemLabels = await McpCatalogLabelModel.getLabelsForCatalogItem(id);
    const itemTeams = await McpCatalogTeamModel.getTeamDetailsForCatalog(id);
    await InternalMcpCatalogModel.syncPresetChildren(dbItem);
    const childrenMap = await InternalMcpCatalogModel.getChildrenSummaries([
      id,
    ]);
    const result: InternalMcpCatalog = {
      ...dbItem,
      labels: itemLabels,
      teams: itemTeams,
      children: childrenMap.get(id) ?? [],
    };
    await InternalMcpCatalogModel.populateAuthorNames([result]);
    return result;
  }

  static async delete(id: string): Promise<boolean> {
    // First, find all servers associated with this catalog item
    const servers = await McpServerModel.findByCatalogId(id);

    // Delete each server (which will cascade to tools)
    for (const server of servers) {
      await McpServerModel.delete(server.id);
    }

    // Then delete the catalog entry itself
    const deletedRows = await db
      .delete(schema.internalMcpCatalogTable)
      .where(eq(schema.internalMcpCatalogTable.id, id))
      .returning({ id: schema.internalMcpCatalogTable.id });

    return deletedRows.length > 0;
  }

  // ===== Private methods =====

  /**
   * Reconciles the hidden child catalog rows that materialize a parent's
   * `presets` jsonb. Each preset becomes a child row with
   * `parentCatalogId = parent.id`, inheriting parent's config and baking in
   * preset values for prompt-on-install fields. Children whose name no longer
   * matches a preset are deleted (cascades to their installs).
   *
   * No-op when the row is itself a child (no grandchildren).
   */
  private static async syncPresetChildren(
    parent: typeof schema.internalMcpCatalogTable.$inferSelect,
  ): Promise<void> {
    if (parent.parentCatalogId) return;

    const presets = (parent.presets ?? []) as CatalogPreset[];
    const existingChildren = await db
      .select()
      .from(schema.internalMcpCatalogTable)
      .where(eq(schema.internalMcpCatalogTable.parentCatalogId, parent.id));
    const childByName = new Map(existingChildren.map((c) => [c.name, c]));
    const expectedNames = new Set(
      presets.map((p) => buildPresetChildName(parent.name, p.name)),
    );

    for (const preset of presets) {
      const childName = buildPresetChildName(parent.name, preset.name);
      const existing = childByName.get(childName);
      const childPayload = buildPresetChildPayload(parent, preset);
      if (existing) {
        await db
          .update(schema.internalMcpCatalogTable)
          .set(childPayload)
          .where(eq(schema.internalMcpCatalogTable.id, existing.id));
      } else {
        await db.insert(schema.internalMcpCatalogTable).values({
          ...childPayload,
          parentCatalogId: parent.id,
        });
      }
    }

    const orphaned = existingChildren.filter((c) => !expectedNames.has(c.name));
    for (const child of orphaned) {
      await InternalMcpCatalogModel.delete(child.id);
    }
  }

  /**
   * Expands secrets and adds them to the catalog items, mutating the items.
   * For BYOS secrets (isByosVault=true), returns vault references / paths as-is.
   * For non-BYOS secrets, resolves actual values via secretManager().
   */
  private static async expandSecrets(
    catalogItems: InternalMcpCatalog[],
  ): Promise<void> {
    // Collect all unique secret IDs
    const secretIds = new Set<string>();
    for (const item of catalogItems) {
      if (item.clientSecretId) secretIds.add(item.clientSecretId);
      if (item.localConfigSecretId) secretIds.add(item.localConfigSecretId);
    }

    if (secretIds.size === 0) return;

    // Fetch raw secret records e.g. vault paths, not resolved to actual value)
    const unresolvedSecretPromises = Array.from(secretIds).map((id) =>
      SecretModel.findById(id).then((secret) => [id, secret] as const),
    );
    const unresolvedSecretEntries = await Promise.all(unresolvedSecretPromises);
    const unresolvedSecretMap = new Map(
      unresolvedSecretEntries.filter(
        (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
          entry[1] !== null,
      ),
    );

    // For non-BYOS secrets, resolve them using secretManager
    const nonByosSecretIds = Array.from(secretIds).filter(
      (id) => !unresolvedSecretMap.get(id)?.isByosVault,
    );
    const resolvedSecretPromises = nonByosSecretIds.map((id) =>
      secretManager()
        .getSecret(id)
        .then((secret) => [id, secret] as const),
    );
    const resolvedSecretEntries = await Promise.all(resolvedSecretPromises);
    const resolvedSecretMap = new Map(
      resolvedSecretEntries.filter(
        (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
          entry[1] !== null,
      ),
    );

    // Enrich each catalog item
    for (const catalogItem of catalogItems) {
      // Enrich OAuth client_secret
      if (catalogItem.clientSecretId && catalogItem.oauthConfig) {
        const unresolvedSecret = unresolvedSecretMap.get(
          catalogItem.clientSecretId,
        );
        // For BYOS: use raw vault reference, for non-BYOS: use resolved value
        const secret = unresolvedSecret?.isByosVault
          ? unresolvedSecret
          : resolvedSecretMap.get(catalogItem.clientSecretId);
        const value = secret?.secret.client_secret;
        if (value) {
          catalogItem.oauthConfig.client_secret = String(value);
        }
      }

      // Enrich local config secret env vars
      if (
        catalogItem.localConfigSecretId &&
        catalogItem.localConfig?.environment
      ) {
        const unresolvedSecret = unresolvedSecretMap.get(
          catalogItem.localConfigSecretId,
        );
        // For BYOS: use raw vault reference, for non-BYOS: use resolved value
        const secret = unresolvedSecret?.isByosVault
          ? unresolvedSecret
          : resolvedSecretMap.get(catalogItem.localConfigSecretId);
        if (secret) {
          for (const envVar of catalogItem.localConfig.environment) {
            const value = secret.secret[envVar.key];
            if (envVar.type === "secret" && value) {
              envVar.value = String(value);
            }
          }
        }
      }
    }
  }

  /**
   * Always resolves all secrets to their actual values.
   * Use this for runtime flows (OAuth, MCP server startup) that need real secret values.
   */
  private static async expandSecretsAndAlwaysResolveValues(
    catalogItems: InternalMcpCatalog[],
  ): Promise<void> {
    const secretIds = new Set<string>();
    for (const item of catalogItems) {
      if (item.clientSecretId) secretIds.add(item.clientSecretId);
      if (item.localConfigSecretId) secretIds.add(item.localConfigSecretId);
    }

    if (secretIds.size === 0) return;

    // Always resolve using secretManager (resolves BYOS vault references to actual values)
    const secretPromises = Array.from(secretIds).map((id) =>
      secretManager()
        .getSecret(id)
        .then((secret) => [id, secret] as const),
    );
    const secretEntries = await Promise.all(secretPromises);
    const secretMap = new Map(
      secretEntries.filter(
        (entry): entry is [string, NonNullable<(typeof entry)[1]>] =>
          entry[1] !== null,
      ),
    );

    for (const catalogItem of catalogItems) {
      if (catalogItem.clientSecretId && catalogItem.oauthConfig) {
        const secret = secretMap.get(catalogItem.clientSecretId);
        const value = secret?.secret.client_secret;
        if (value) {
          catalogItem.oauthConfig.client_secret = String(value);
        }
      }

      if (
        catalogItem.localConfigSecretId &&
        catalogItem.localConfig?.environment
      ) {
        const secret = secretMap.get(catalogItem.localConfigSecretId);
        if (secret) {
          for (const envVar of catalogItem.localConfig.environment) {
            const value = secret.secret[envVar.key];
            if (envVar.type === "secret" && value) {
              envVar.value = String(value);
            }
          }
        }
      }
    }
  }

  /**
   * Bulk-load labels and teams for an array of DB rows and attach them.
   */
  private static async attachLabelsAndTeams(
    dbItems: Array<typeof schema.internalMcpCatalogTable.$inferSelect>,
  ): Promise<InternalMcpCatalog[]> {
    if (dbItems.length === 0) {
      return [];
    }

    const ids = dbItems.map((item) => item.id);
    const [labelsMap, teamsMap, childrenMap] = await Promise.all([
      McpCatalogLabelModel.getLabelsForCatalogItems(ids),
      McpCatalogTeamModel.getTeamDetailsForCatalogs(ids),
      InternalMcpCatalogModel.getChildrenSummaries(ids),
    ]);

    return dbItems.map((item) => ({
      ...item,
      labels: labelsMap.get(item.id) || [],
      teams: teamsMap.get(item.id) || [],
      children: childrenMap.get(item.id) ?? [],
    }));
  }

  /**
   * Bulk-load child summaries grouped by parent id. Returns one entry per
   * parent that has children; parents with no children are absent from the
   * map.
   */
  private static async getChildrenSummaries(
    parentIds: string[],
  ): Promise<
    Map<string, Array<{ id: string; name: string; description: string | null }>>
  > {
    const result = new Map<
      string,
      Array<{ id: string; name: string; description: string | null }>
    >();
    if (parentIds.length === 0) return result;
    const rows = await db
      .select({
        id: schema.internalMcpCatalogTable.id,
        name: schema.internalMcpCatalogTable.name,
        description: schema.internalMcpCatalogTable.description,
        parentCatalogId: schema.internalMcpCatalogTable.parentCatalogId,
      })
      .from(schema.internalMcpCatalogTable)
      .where(
        inArray(schema.internalMcpCatalogTable.parentCatalogId, parentIds),
      );
    for (const row of rows) {
      if (!row.parentCatalogId) continue;
      const list = result.get(row.parentCatalogId) ?? [];
      list.push({
        id: row.id,
        name: row.name,
        description: row.description,
      });
      result.set(row.parentCatalogId, list);
    }
    return result;
  }

  /**
   * Populate authorName for catalog items that have an authorId.
   */
  private static async populateAuthorNames(
    catalogItems: InternalMcpCatalog[],
  ): Promise<void> {
    const authorIds = new Set<string>();
    for (const item of catalogItems) {
      if (item.authorId) authorIds.add(item.authorId);
    }

    if (authorIds.size === 0) return;

    const users = await db
      .select({ id: schema.usersTable.id, name: schema.usersTable.name })
      .from(schema.usersTable)
      .where(inArray(schema.usersTable.id, Array.from(authorIds)));

    const nameMap = new Map(users.map((u) => [u.id, u.name]));

    for (const item of catalogItems) {
      item.authorName = item.authorId
        ? (nameMap.get(item.authorId) ?? null)
        : null;
    }
  }
}

export default InternalMcpCatalogModel;

function buildPresetChildName(parentName: string, presetName: string): string {
  return `${parentName} ${presetName}`;
}

function buildPresetChildPayload(
  parent: typeof schema.internalMcpCatalogTable.$inferSelect,
  preset: CatalogPreset,
) {
  const userConfig = applyPresetToUserConfig(
    parent.userConfig as UserConfig | null | undefined,
    preset.values,
  );
  const localConfig = applyPresetToLocalConfig(
    parent.localConfig as LocalConfig | null | undefined,
    preset.values,
  );

  return {
    name: buildPresetChildName(parent.name, preset.name),
    description: preset.description ?? parent.description,
    instructions: parent.instructions,
    version: parent.version,
    repository: parent.repository,
    installationCommand: parent.installationCommand,
    requiresAuth: parent.requiresAuth,
    authDescription: parent.authDescription,
    authFields: parent.authFields,
    serverType: parent.serverType,
    multitenant: parent.multitenant,
    serverUrl: parent.serverUrl,
    docsUrl: parent.docsUrl,
    clientSecretId: parent.clientSecretId,
    localConfigSecretId: parent.localConfigSecretId,
    localConfig,
    deploymentSpecYaml: parent.deploymentSpecYaml,
    userConfig,
    presets: [],
    oauthConfig: parent.oauthConfig,
    enterpriseManagedConfig: parent.enterpriseManagedConfig,
    icon: parent.icon,
    organizationId: parent.organizationId,
    authorId: parent.authorId,
    scope: parent.scope,
    parentCatalogId: parent.id,
  };
}

function applyPresetToUserConfig(
  userConfig: UserConfig | null | undefined,
  values: CatalogPreset["values"],
): UserConfig | null {
  if (!userConfig) return null;
  const next: UserConfig = {};
  for (const [key, field] of Object.entries(userConfig)) {
    if (key in values) {
      next[key] = {
        ...field,
        default: values[key],
        promptOnInstallation: false,
      };
    } else {
      next[key] = { ...field };
    }
  }
  return next;
}

function applyPresetToLocalConfig(
  localConfig: LocalConfig | null | undefined,
  values: CatalogPreset["values"],
): LocalConfig | null {
  if (!localConfig) return null;
  const environment = localConfig.environment?.map((env) => {
    if (env.key in values) {
      const raw = values[env.key];
      return {
        ...env,
        value: typeof raw === "string" ? raw : String(raw),
        promptOnInstallation: false,
      };
    }
    return env;
  });
  return { ...localConfig, environment };
}
