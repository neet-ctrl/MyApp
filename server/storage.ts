// Simple storage interface for Telegram Manager
// All data is handled by IndexedDB on the frontend

import { 
  GitHubSettings, 
  InsertGitHubSettings, 
  GitTokenConfig, 
  InsertGitTokenConfig,
  GitRepository,
  InsertGitRepository,
  TextMemo,
  InsertTextMemo,
  LiveCloningInstance,
  InsertLiveCloningInstance,
  EntityLink,
  InsertEntityLink,
  WordFilter,
  InsertWordFilter,
  LiveCloningMessage,
  InsertLiveCloningMessage,
  ConsoleLog,
  InsertConsoleLog
} from "@shared/schema";

import { desc, eq, lt } from "drizzle-orm";
import { consoleLogs, logCollections } from "@shared/schema";

export interface IStorage {
  // This storage is primarily for backend session management if needed
  // Most storage operations happen in the frontend with IndexedDB

  // GitHub PAT settings (existing)
  getGitHubSettings(userId: string): Promise<GitHubSettings | null>;
  saveGitHubSettings(userId: string, settings: InsertGitHubSettings): Promise<GitHubSettings>;
  getDefaultGitHubPAT(): Promise<string | null>;

  // Git Control - Token Management
  getGitTokenConfigs(): Promise<GitTokenConfig[]>;
  saveGitTokenConfig(config: InsertGitTokenConfig): Promise<GitTokenConfig>;
  deleteGitTokenConfig(id: number): Promise<boolean>;
  updateTokenLastUsed(id: number): Promise<void>;

  // Git Control - Repository Cache
  getCachedRepositories(): Promise<GitRepository[]>;
  saveCachedRepository(repo: InsertGitRepository): Promise<GitRepository>;
  deleteCachedRepository(fullName: string): Promise<boolean>;
  clearRepositoryCache(): Promise<void>;

  // TextMemo Management
  getAllTextMemos(): Promise<TextMemo[]>;
  getTextMemo(id: number): Promise<TextMemo | null>;
  saveTextMemo(memo: InsertTextMemo): Promise<TextMemo>;
  updateTextMemo(id: number, updates: Partial<TextMemo>): Promise<TextMemo | null>;
  deleteTextMemo(id: number): Promise<boolean>;

  // Live Cloning Management
  getLiveCloningInstance(instanceId: string): Promise<LiveCloningInstance | null>;
  saveLiveCloningInstance(instance: InsertLiveCloningInstance): Promise<LiveCloningInstance>;
  updateLiveCloningInstance(instanceId: string, updates: Partial<LiveCloningInstance>): Promise<LiveCloningInstance | null>;
  deleteLiveCloningInstance(instanceId: string): Promise<boolean>;
  getAllLiveCloningInstances(): Promise<LiveCloningInstance[]>;

  // Entity Links Management
  getEntityLinks(instanceId: string): Promise<EntityLink[]>;
  saveEntityLink(link: InsertEntityLink): Promise<EntityLink>;
  updateEntityLink(id: number, updates: Partial<Omit<EntityLink, 'id' | 'instanceId'>>): Promise<EntityLink | null>;
  deleteEntityLink(id: number): Promise<boolean>;
  deleteEntityLinksByInstance(instanceId: string): Promise<number>;

  // Word Filters Management
  getWordFilters(instanceId: string): Promise<WordFilter[]>;
  saveWordFilter(filter: InsertWordFilter): Promise<WordFilter>;
  updateWordFilter(id: number, updates: Partial<Omit<WordFilter, 'id' | 'instanceId'>>): Promise<WordFilter | null>;
  deleteWordFilter(id: number): Promise<boolean>;
  deleteWordFiltersByInstance(instanceId: string): Promise<number>;

  // Message Mappings Management
  saveLiveCloningMessage(message: InsertLiveCloningMessage): Promise<LiveCloningMessage>;
  getLiveCloningMessages(instanceId: string): Promise<LiveCloningMessage[]>;
  deleteLiveCloningMessagesByInstance(instanceId: string): Promise<number>;

  // Console Logs Management
  saveConsoleLog(log: InsertConsoleLog): Promise<ConsoleLog>;
  getConsoleLogs(limit?: number, offset?: number): Promise<ConsoleLog[]>;
  getConsoleLogsByLevel(level: string, limit?: number): Promise<ConsoleLog[]>;
  clearOldConsoleLogs(olderThanDays: number): Promise<number>;

  // Log Collection Management
  saveLogCollection(data: {
    name: string;
    totalEntries: number;
    savedAt: string;
    logsData: string;
  }): Promise<any>;
  getLogCollections(): Promise<any[]>;
  getLogCollection(id: number): Promise<any | undefined>;
  deleteLogCollection(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private githubSettings: Map<string, GitHubSettings> = new Map();
  private gitTokenConfigs: Map<number, GitTokenConfig> = new Map();
  private cachedRepositories: Map<string, GitRepository> = new Map();
  private tokenIdCounter: number = 1;
  private defaultPAT: string = process.env.GITHUB_PERSONAL_ACCESS_TOKEN || process.env.GITHUB_PAT || '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';

  // TextMemo storage maps
  private textMemos: Map<number, TextMemo> = new Map();
  private textMemoIdCounter: number = 1;

  // Live Cloning storage maps
  private liveCloningInstances: Map<string, LiveCloningInstance> = new Map();
  private entityLinks: Map<number, EntityLink> = new Map();
  private wordFilters: Map<number, WordFilter> = new Map();
  private liveCloningMessages: Map<number, LiveCloningMessage> = new Map();
  private entityLinkIdCounter: number = 1;
  private wordFilterIdCounter: number = 1;
  private liveCloningMessageIdCounter: number = 1;

  // Console Logs storage maps
  private consoleLogs: Map<number, ConsoleLog> = new Map();
  private consoleLogIdCounter: number = 1;

  constructor() {
    // Backend storage placeholder - main storage is client-side IndexedDB
  }

  // Existing GitHub settings methods
  async getGitHubSettings(userId: string): Promise<GitHubSettings | null> {
    return this.githubSettings.get(userId) || null;
  }

  async saveGitHubSettings(userId: string, settings: InsertGitHubSettings): Promise<GitHubSettings> {
    const savedSettings: GitHubSettings = {
      id: this.githubSettings.size + 1,
      userId,
      personalAccessToken: settings.personalAccessToken || null,
      isDefault: settings.isDefault || false,
      updatedAt: new Date(),
    };
    this.githubSettings.set(userId, savedSettings);
    return savedSettings;
  }

  async getDefaultGitHubPAT(): Promise<string | null> {
    return this.defaultPAT;
  }

  // Git Control - Token Management
  async getGitTokenConfigs(): Promise<GitTokenConfig[]> {
    return Array.from(this.gitTokenConfigs.values());
  }

  async saveGitTokenConfig(config: InsertGitTokenConfig): Promise<GitTokenConfig> {
    const savedConfig: GitTokenConfig = {
      id: this.tokenIdCounter++,
      label: config.label,
      tokenHash: config.tokenHash,
      scopes: config.scopes || [],
      createdAt: new Date(),
      lastUsed: null,
    };
    this.gitTokenConfigs.set(savedConfig.id, savedConfig);
    return savedConfig;
  }

  async deleteGitTokenConfig(id: number): Promise<boolean> {
    return this.gitTokenConfigs.delete(id);
  }

  async updateTokenLastUsed(id: number): Promise<void> {
    const config = this.gitTokenConfigs.get(id);
    if (config) {
      config.lastUsed = new Date();
      this.gitTokenConfigs.set(id, config);
    }
  }

  // Git Control - Repository Cache
  async getCachedRepositories(): Promise<GitRepository[]> {
    return Array.from(this.cachedRepositories.values());
  }

  async saveCachedRepository(repo: InsertGitRepository): Promise<GitRepository> {
    const savedRepo: GitRepository = {
      id: this.cachedRepositories.size + 1,
      owner: repo.owner,
      name: repo.name,
      fullName: repo.fullName,
      private: repo.private || false,
      description: repo.description || null,
      defaultBranch: repo.defaultBranch || 'main',
      homepage: repo.homepage || null,
      topics: repo.topics || [],
      cachedAt: new Date(),
    };
    this.cachedRepositories.set(repo.fullName, savedRepo);
    return savedRepo;
  }

  async deleteCachedRepository(fullName: string): Promise<boolean> {
    return this.cachedRepositories.delete(fullName);
  }

  async clearRepositoryCache(): Promise<void> {
    this.cachedRepositories.clear();
  }

  // TextMemo Management
  async getAllTextMemos(): Promise<TextMemo[]> {
    return Array.from(this.textMemos.values()).sort((a, b) => {
      const aDate = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }

  async getTextMemo(id: number): Promise<TextMemo | null> {
    return this.textMemos.get(id) || null;
  }

  async saveTextMemo(memo: InsertTextMemo): Promise<TextMemo> {
    const savedMemo: TextMemo = {
      id: this.textMemoIdCounter++,
      title: memo.title,
      description: memo.description || null,
      hint: memo.hint || null,
      content: memo.content || "",
      createdAt: new Date(),
    };
    this.textMemos.set(savedMemo.id, savedMemo);
    return savedMemo;
  }

  async updateTextMemo(id: number, updates: Partial<TextMemo>): Promise<TextMemo | null> {
    const existingMemo = this.textMemos.get(id);
    if (!existingMemo) return null;

    const updatedMemo: TextMemo = {
      ...existingMemo,
      ...updates,
      id: existingMemo.id, // Preserve original ID
      createdAt: existingMemo.createdAt, // Preserve creation date
    };

    this.textMemos.set(id, updatedMemo);
    return updatedMemo;
  }

  async deleteTextMemo(id: number): Promise<boolean> {
    return this.textMemos.delete(id);
  }

  // Live Cloning Management
  async getLiveCloningInstance(instanceId: string): Promise<LiveCloningInstance | null> {
    return this.liveCloningInstances.get(instanceId) || null;
  }

  async saveLiveCloningInstance(instance: InsertLiveCloningInstance): Promise<LiveCloningInstance> {
    const savedInstance: LiveCloningInstance = {
      id: this.liveCloningInstances.size + 1,
      instanceId: instance.instanceId,
      sessionString: instance.sessionString,
      config: instance.config,
      status: instance.status || 'inactive',
      botEnabled: instance.botEnabled ?? true,
      filterWords: instance.filterWords ?? true,
      addSignature: instance.addSignature ?? false,
      signature: instance.signature || null,
      lastError: instance.lastError || null,
      processedMessages: instance.processedMessages || 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.liveCloningInstances.set(instance.instanceId, savedInstance);
    return savedInstance;
  }

  async updateLiveCloningInstance(instanceId: string, updates: Partial<LiveCloningInstance>): Promise<LiveCloningInstance | null> {
    const instance = this.liveCloningInstances.get(instanceId);
    if (!instance) return null;

    const updatedInstance = { ...instance, ...updates, updatedAt: new Date() };
    this.liveCloningInstances.set(instanceId, updatedInstance);
    return updatedInstance;
  }

  async deleteLiveCloningInstance(instanceId: string): Promise<boolean> {
    // Also delete all related data
    await this.deleteEntityLinksByInstance(instanceId);
    await this.deleteWordFiltersByInstance(instanceId);
    await this.deleteLiveCloningMessagesByInstance(instanceId);
    return this.liveCloningInstances.delete(instanceId);
  }

  async getAllLiveCloningInstances(): Promise<LiveCloningInstance[]> {
    return Array.from(this.liveCloningInstances.values());
  }

  // Entity Links Management
  async getEntityLinks(instanceId: string): Promise<EntityLink[]> {
    return Array.from(this.entityLinks.values()).filter(link => link.instanceId === instanceId);
  }

  async saveEntityLink(link: InsertEntityLink): Promise<EntityLink> {
    const savedLink: EntityLink = {
      id: this.entityLinkIdCounter++,
      instanceId: link.instanceId,
      fromEntity: link.fromEntity,
      toEntity: link.toEntity,
      isActive: link.isActive ?? true,
      createdAt: new Date(),
    };
    this.entityLinks.set(savedLink.id, savedLink);
    return savedLink;
  }

  async updateEntityLink(id: number, updates: Partial<Omit<EntityLink, 'id' | 'instanceId'>>): Promise<EntityLink | null> {
    const existingLink = this.entityLinks.get(id);
    if (!existingLink) return null;

    const updatedLink: EntityLink = {
      ...existingLink,
      ...updates,
      id: existingLink.id, // Preserve original ID
      instanceId: existingLink.instanceId, // Preserve original instanceId
    };

    this.entityLinks.set(id, updatedLink);
    return updatedLink;
  }

  async deleteEntityLink(id: number): Promise<boolean> {
    return this.entityLinks.delete(id);
  }

  async deleteEntityLinksByInstance(instanceId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, link] of Array.from(this.entityLinks.entries())) {
      if (link.instanceId === instanceId) {
        this.entityLinks.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  // Word Filters Management
  async getWordFilters(instanceId: string): Promise<WordFilter[]> {
    return Array.from(this.wordFilters.values()).filter(filter => filter.instanceId === instanceId);
  }

  async saveWordFilter(filter: InsertWordFilter): Promise<WordFilter> {
    const savedFilter: WordFilter = {
      id: this.wordFilterIdCounter++,
      instanceId: filter.instanceId,
      fromWord: filter.fromWord,
      toWord: filter.toWord,
      isActive: filter.isActive ?? true,
      createdAt: new Date(),
    };
    this.wordFilters.set(savedFilter.id, savedFilter);
    return savedFilter;
  }

  async updateWordFilter(id: number, updates: Partial<Omit<WordFilter, 'id' | 'instanceId'>>): Promise<WordFilter | null> {
    const existingFilter = this.wordFilters.get(id);
    if (!existingFilter) return null;

    const updatedFilter: WordFilter = {
      ...existingFilter,
      ...updates,
      id: existingFilter.id, // Preserve original ID
      instanceId: existingFilter.instanceId, // Preserve original instanceId
    };

    this.wordFilters.set(id, updatedFilter);
    return updatedFilter;
  }

  async deleteWordFilter(id: number): Promise<boolean> {
    return this.wordFilters.delete(id);
  }

  async deleteWordFiltersByInstance(instanceId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, filter] of Array.from(this.wordFilters.entries())) {
      if (filter.instanceId === instanceId) {
        this.wordFilters.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  // Message Mappings Management
  async saveLiveCloningMessage(message: InsertLiveCloningMessage): Promise<LiveCloningMessage> {
    const savedMessage: LiveCloningMessage = {
      id: this.liveCloningMessageIdCounter++,
      instanceId: message.instanceId,
      baseEntity: message.baseEntity,
      baseMessageId: message.baseMessageId,
      targetEntity: message.targetEntity,
      targetMessageId: message.targetMessageId,
      createdAt: new Date(),
    };
    this.liveCloningMessages.set(savedMessage.id, savedMessage);
    return savedMessage;
  }

  async getLiveCloningMessages(instanceId: string): Promise<LiveCloningMessage[]> {
    return Array.from(this.liveCloningMessages.values()).filter(msg => msg.instanceId === instanceId);
  }

  async deleteLiveCloningMessagesByInstance(instanceId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, message] of Array.from(this.liveCloningMessages.entries())) {
      if (message.instanceId === instanceId) {
        this.liveCloningMessages.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }

  // Console Logs Management
  async saveConsoleLog(log: InsertConsoleLog): Promise<ConsoleLog> {
    const savedLog: ConsoleLog = {
      id: this.consoleLogIdCounter++,
      level: log.level,
      message: log.message,
      source: log.source || 'application',
      metadata: log.metadata || null,
      timestamp: new Date(),
    };
    this.consoleLogs.set(savedLog.id, savedLog);
    return savedLog;
  }

  async getConsoleLogs(limit: number = 100, offset: number = 0): Promise<ConsoleLog[]> {
    const logs = Array.from(this.consoleLogs.values())
      .sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      })
      .slice(offset, offset + limit);
    return logs;
  }

  async getConsoleLogsByLevel(level: string, limit: number = 100): Promise<ConsoleLog[]> {
    const logs = Array.from(this.consoleLogs.values())
      .filter(log => log.level === level)
      .sort((a, b) => {
        const aTime = a.timestamp ? new Date(a.timestamp).getTime() : 0;
        const bTime = b.timestamp ? new Date(b.timestamp).getTime() : 0;
        return bTime - aTime;
      })
      .slice(0, limit);
    return logs;
  }

  async clearOldConsoleLogs(olderThanDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);
    
    const { db } = await import('./db');
    const result = await db.delete(consoleLogs)
      .where(lt(consoleLogs.timestamp, cutoffDate.toISOString()));

    return result.rowCount || 0;
  }

  // Log Collections storage maps
  private logCollections: Map<number, any> = new Map();
  private logCollectionIdCounter: number = 1;

  // Log Collections for persistent storage
  async saveLogCollection(data: {
    name: string;
    totalEntries: number;
    savedAt: string;
    logsData: string;
  }) {
    try {
      const { db } = await import('./db');
      const [collection] = await db.insert(logCollections)
        .values({
          name: data.name,
          totalEntries: data.totalEntries,
          savedAt: data.savedAt,
          logsData: data.logsData,
        })
        .returning();
      return collection;
    } catch (error) {
      // Fallback to memory storage
      const collection = {
        id: this.logCollectionIdCounter++,
        name: data.name,
        totalEntries: data.totalEntries,
        savedAt: data.savedAt,
        logsData: data.logsData,
      };
      this.logCollections.set(collection.id, collection);
      return collection;
    }
  }

  async getLogCollections() {
    try {
      const { db } = await import('./db');
      return await db.select({
        id: logCollections.id,
        name: logCollections.name,
        totalEntries: logCollections.totalEntries,
        savedAt: logCollections.savedAt,
      }).from(logCollections)
        .orderBy(desc(logCollections.savedAt));
    } catch (error) {
      // Fallback to memory storage
      return Array.from(this.logCollections.values())
        .map(collection => ({
          id: collection.id,
          name: collection.name,
          totalEntries: collection.totalEntries,
          savedAt: collection.savedAt,
        }))
        .sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    }
  }

  async getLogCollection(id: number) {
    try {
      const { db } = await import('./db');
      const [collection] = await db.select()
        .from(logCollections)
        .where(eq(logCollections.id, id));
      return collection;
    } catch (error) {
      // Fallback to memory storage
      return this.logCollections.get(id);
    }
  }

  async deleteLogCollection(id: number): Promise<boolean> {
    try {
      const { db } = await import('./db');
      const result = await db.delete(logCollections)
        .where(eq(logCollections.id, id));
      return (result.rowCount || 0) > 0;
    } catch (error) {
      // Fallback to memory storage
      return this.logCollections.delete(id);
    }
  }
}

import { DatabaseLiveCloningStorage } from './DatabaseLiveCloningStorage';

// Use database storage for full persistence across server restarts
// This ensures entity links survive restarts like the Python copier
export const storage = new DatabaseLiveCloningStorage();