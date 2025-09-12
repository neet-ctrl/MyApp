// Simple storage interface for Telegram Manager
// All data is handled by IndexedDB on the frontend

import { 
  GitHubSettings, 
  InsertGitHubSettings, 
  GitTokenConfig, 
  InsertGitTokenConfig,
  GitRepository,
  InsertGitRepository,
  LiveCloningInstance,
  InsertLiveCloningInstance,
  EntityLink,
  InsertEntityLink,
  WordFilter,
  InsertWordFilter,
  LiveCloningMessage,
  InsertLiveCloningMessage
} from "@shared/schema";

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
  
  // Live Cloning Management
  getLiveCloningInstance(instanceId: string): Promise<LiveCloningInstance | null>;
  saveLiveCloningInstance(instance: InsertLiveCloningInstance): Promise<LiveCloningInstance>;
  updateLiveCloningInstance(instanceId: string, updates: Partial<LiveCloningInstance>): Promise<LiveCloningInstance | null>;
  deleteLiveCloningInstance(instanceId: string): Promise<boolean>;
  getAllLiveCloningInstances(): Promise<LiveCloningInstance[]>;
  
  // Entity Links Management
  getEntityLinks(instanceId: string): Promise<EntityLink[]>;
  saveEntityLink(link: InsertEntityLink): Promise<EntityLink>;
  deleteEntityLink(id: number): Promise<boolean>;
  deleteEntityLinksByInstance(instanceId: string): Promise<number>;
  
  // Word Filters Management
  getWordFilters(instanceId: string): Promise<WordFilter[]>;
  saveWordFilter(filter: InsertWordFilter): Promise<WordFilter>;
  deleteWordFilter(id: number): Promise<boolean>;
  deleteWordFiltersByInstance(instanceId: string): Promise<number>;
  
  // Message Mappings Management
  saveLiveCloningMessage(message: InsertLiveCloningMessage): Promise<LiveCloningMessage>;
  getLiveCloningMessages(instanceId: string): Promise<LiveCloningMessage[]>;
  deleteLiveCloningMessagesByInstance(instanceId: string): Promise<number>;
}

export class MemStorage implements IStorage {
  private githubSettings: Map<string, GitHubSettings> = new Map();
  private gitTokenConfigs: Map<number, GitTokenConfig> = new Map();
  private cachedRepositories: Map<string, GitRepository> = new Map();
  private tokenIdCounter: number = 1;
  private defaultPAT: string = process.env.GITHUB_PAT || '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';
  
  // Live Cloning storage maps
  private liveCloningInstances: Map<string, LiveCloningInstance> = new Map();
  private entityLinks: Map<number, EntityLink> = new Map();
  private wordFilters: Map<number, WordFilter> = new Map();
  private liveCloningMessages: Map<number, LiveCloningMessage> = new Map();
  private entityLinkIdCounter: number = 1;
  private wordFilterIdCounter: number = 1;
  private liveCloningMessageIdCounter: number = 1;

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

  async deleteEntityLink(id: number): Promise<boolean> {
    return this.entityLinks.delete(id);
  }

  async deleteEntityLinksByInstance(instanceId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, link] of this.entityLinks.entries()) {
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

  async deleteWordFilter(id: number): Promise<boolean> {
    return this.wordFilters.delete(id);
  }

  async deleteWordFiltersByInstance(instanceId: string): Promise<number> {
    let deletedCount = 0;
    for (const [id, filter] of this.wordFilters.entries()) {
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
    for (const [id, message] of this.liveCloningMessages.entries()) {
      if (message.instanceId === instanceId) {
        this.liveCloningMessages.delete(id);
        deletedCount++;
      }
    }
    return deletedCount;
  }
}

export const storage = new MemStorage();
