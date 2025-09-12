import { db } from './db';
import { 
  entityLinks, 
  wordFilters, 
  liveCloningInstances,
  liveCloningMessages,
  type EntityLink,
  type InsertEntityLink,
  type WordFilter,
  type InsertWordFilter,
  type LiveCloningInstance,
  type InsertLiveCloningInstance,
  type LiveCloningMessage,
  type InsertLiveCloningMessage,
  type GitHubSettings,
  type InsertGitHubSettings,
  type GitTokenConfig,
  type InsertGitTokenConfig,
  type GitRepository,
  type InsertGitRepository
} from '@shared/schema';
import { eq, desc, and } from 'drizzle-orm';
import { IStorage } from './storage';

/**
 * Database storage implementation for Live Cloning with full persistence
 * Ensures entity links survive server restarts, matching Python copier behavior
 */
export class DatabaseLiveCloningStorage implements IStorage {
  // GitHub PAT settings (inherit from MemStorage for backward compatibility)
  private githubSettings: Map<string, GitHubSettings> = new Map();
  private gitTokenConfigs: Map<number, GitTokenConfig> = new Map();
  private cachedRepositories: Map<string, GitRepository> = new Map();
  private tokenIdCounter: number = 1;
  private defaultPAT: string = process.env.GITHUB_PAT || '';

  // Non-critical storage methods (using in-memory for now)
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
    return this.defaultPAT || null;
  }

  async getGitTokenConfigs(): Promise<GitTokenConfig[]> {
    return Array.from(this.gitTokenConfigs.values());
  }

  async saveGitTokenConfig(config: InsertGitTokenConfig): Promise<GitTokenConfig> {
    const savedConfig: GitTokenConfig = {
      id: this.tokenIdCounter++,
      label: config.label,
      tokenHash: config.tokenHash,
      scopes: config.scopes || null,
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
    }
  }

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
      topics: repo.topics || null,
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

  // CRITICAL: Live Cloning Database Storage (Persistent)
  // These methods use PostgreSQL database for full persistence

  async getLiveCloningInstance(instanceId: string): Promise<LiveCloningInstance | null> {
    const [instance] = await db
      .select()
      .from(liveCloningInstances)
      .where(eq(liveCloningInstances.instanceId, instanceId));
    
    return instance || null;
  }

  async saveLiveCloningInstance(instance: InsertLiveCloningInstance): Promise<LiveCloningInstance> {
    // Try to update existing instance first
    const existing = await this.getLiveCloningInstance(instance.instanceId);
    
    if (existing) {
      const [updated] = await db
        .update(liveCloningInstances)
        .set({
          ...instance,
          updatedAt: new Date(),
        })
        .where(eq(liveCloningInstances.instanceId, instance.instanceId))
        .returning();
      
      return updated;
    } else {
      const [created] = await db
        .insert(liveCloningInstances)
        .values({
          ...instance,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        .returning();
      
      return created;
    }
  }

  async updateLiveCloningInstance(instanceId: string, updates: Partial<LiveCloningInstance>): Promise<LiveCloningInstance | null> {
    const [updated] = await db
      .update(liveCloningInstances)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(liveCloningInstances.instanceId, instanceId))
      .returning();
    
    return updated || null;
  }

  async deleteLiveCloningInstance(instanceId: string): Promise<boolean> {
    // Also delete all related data
    await this.deleteEntityLinksByInstance(instanceId);
    await this.deleteWordFiltersByInstance(instanceId);
    await this.deleteLiveCloningMessagesByInstance(instanceId);
    
    const result = await db
      .delete(liveCloningInstances)
      .where(eq(liveCloningInstances.instanceId, instanceId));
    
    return result.rowCount > 0;
  }

  async getAllLiveCloningInstances(): Promise<LiveCloningInstance[]> {
    return db
      .select()
      .from(liveCloningInstances)
      .orderBy(desc(liveCloningInstances.updatedAt));
  }

  // CRITICAL: Entity Links Database Storage (Persistent)
  async getEntityLinks(instanceId: string): Promise<EntityLink[]> {
    return db
      .select()
      .from(entityLinks)
      .where(eq(entityLinks.instanceId, instanceId))
      .orderBy(desc(entityLinks.createdAt));
  }

  async saveEntityLink(link: InsertEntityLink): Promise<EntityLink> {
    const [saved] = await db
      .insert(entityLinks)
      .values({
        ...link,
        createdAt: new Date(),
      })
      .returning();
    
    return saved;
  }

  async updateEntityLink(id: number, updates: Partial<Omit<EntityLink, 'id' | 'instanceId'>>): Promise<EntityLink | null> {
    const [updated] = await db
      .update(entityLinks)
      .set(updates)
      .where(eq(entityLinks.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteEntityLink(id: number): Promise<boolean> {
    const result = await db
      .delete(entityLinks)
      .where(eq(entityLinks.id, id));
    
    return result.rowCount > 0;
  }

  async deleteEntityLinksByInstance(instanceId: string): Promise<number> {
    const result = await db
      .delete(entityLinks)
      .where(eq(entityLinks.instanceId, instanceId));
    
    return result.rowCount;
  }

  // CRITICAL: Word Filters Database Storage (Persistent)
  async getWordFilters(instanceId: string): Promise<WordFilter[]> {
    return db
      .select()
      .from(wordFilters)
      .where(eq(wordFilters.instanceId, instanceId))
      .orderBy(desc(wordFilters.createdAt));
  }

  async saveWordFilter(filter: InsertWordFilter): Promise<WordFilter> {
    const [saved] = await db
      .insert(wordFilters)
      .values({
        ...filter,
        createdAt: new Date(),
      })
      .returning();
    
    return saved;
  }

  async updateWordFilter(id: number, updates: Partial<Omit<WordFilter, 'id' | 'instanceId'>>): Promise<WordFilter | null> {
    const [updated] = await db
      .update(wordFilters)
      .set(updates)
      .where(eq(wordFilters.id, id))
      .returning();
    
    return updated || null;
  }

  async deleteWordFilter(id: number): Promise<boolean> {
    const result = await db
      .delete(wordFilters)
      .where(eq(wordFilters.id, id));
    
    return result.rowCount > 0;
  }

  async deleteWordFiltersByInstance(instanceId: string): Promise<number> {
    const result = await db
      .delete(wordFilters)
      .where(eq(wordFilters.instanceId, instanceId));
    
    return result.rowCount;
  }

  // CRITICAL: Live Cloning Messages Database Storage (Persistent)
  async saveLiveCloningMessage(message: InsertLiveCloningMessage): Promise<LiveCloningMessage> {
    const [saved] = await db
      .insert(liveCloningMessages)
      .values({
        ...message,
        createdAt: new Date(),
      })
      .returning();
    
    return saved;
  }

  async getLiveCloningMessages(instanceId: string): Promise<LiveCloningMessage[]> {
    return db
      .select()
      .from(liveCloningMessages)
      .where(eq(liveCloningMessages.instanceId, instanceId))
      .orderBy(desc(liveCloningMessages.createdAt));
  }

  async deleteLiveCloningMessagesByInstance(instanceId: string): Promise<number> {
    const result = await db
      .delete(liveCloningMessages)
      .where(eq(liveCloningMessages.instanceId, instanceId));
    
    return result.rowCount;
  }
}