import { TelegramClient } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { Api } from 'telegram/tl';
import { FloodWaitError } from 'telegram/errors';
import { logger } from './telegram-bot/logger';
import type { ForwardConfig, ForwardJob } from '@shared/schema';
import { createTelegramClient } from './telegram-client-factory';

// Map to store active forwarding jobs
const activeJobs = new Map<string, ForwardJobManager>();

class ForwardJobManager {
  private client: TelegramClient | null = null;
  private isRunning = false;
  private shouldStop = false;
  private logs: string[] = [];
  
  constructor(
    public readonly id: string,
    public readonly config: ForwardConfig,
    private readonly sessionString: string,
    private readonly apiId: number,
    private readonly apiHash: string,
    private readonly onUpdate: (job: Partial<ForwardJob>) => void
  ) {}

  private addLog(message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] ${message}`;
    this.logs.push(logMessage);
    logger.info(`[Forwarder ${this.id}] ${message}`);
    
    // Keep only last 1000 log entries
    if (this.logs.length > 1000) {
      this.logs = this.logs.slice(-1000);
    }

    this.onUpdate({ logs: [...this.logs] });
  }

  private intify(value: string | number): number | string {
    if (typeof value === 'string') {
      const parsed = parseInt(value);
      return isNaN(parsed) ? value : parsed;
    }
    return value;
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      throw new Error('Job is already running');
    }

    this.isRunning = true;
    this.shouldStop = false;
    this.addLog('Starting forwarding job...');

    try {
      // Initialize Telegram client using factory with proper connection options
      this.client = createTelegramClient({
        apiId: this.apiId,
        apiHash: this.apiHash,
        sessionString: this.sessionString
      });

      await this.client.connect();
      this.addLog('Connected to Telegram');

      this.onUpdate({
        status: 'running',
        updatedAt: new Date().toISOString(),
      });

      // Properly resolve entities like Python copier does - this is critical for GramJS
      let fromChatId = this.config.fromChatId;
      let toChatId = this.config.toChatId;
      
      // Convert to proper format if needed (add -100 prefix for groups like Python)
      if (typeof fromChatId === 'string' && fromChatId.match(/^\d+$/)) {
        // If it's a bare number, add -100 prefix for groups
        fromChatId = `-100${fromChatId}`;
      }
      
      this.addLog(`From chat ID: ${fromChatId}`);
      this.addLog(`To chat ID: ${toChatId}`);
      this.addLog(`Starting from offset: ${this.config.offsetFrom}, ending at: ${this.config.offsetTo || 'latest'}`);

      // Resolve entities first - this is what Python does automatically
      this.addLog(`Resolving entities...`);
      let fromEntity, toEntity;
      
      try {
        this.addLog(`Getting entity for source chat: ${fromChatId}`);
        fromEntity = await this.client.getEntity(fromChatId);
        this.addLog(`✅ Source entity resolved: ${fromEntity.id}`);
        
        this.addLog(`Getting entity for destination chat: ${toChatId}`);
        toEntity = await this.client.getEntity(toChatId);
        this.addLog(`✅ Destination entity resolved: ${toEntity.id}`);
      } catch (entityError: any) {
        this.addLog(`❌ Entity resolution failed: ${entityError.message}`);
        this.addLog(`Trying alternative entity resolution methods...`);
        
        // Try alternative methods like dialogs
        try {
          this.addLog(`Getting dialogs to find entities...`);
          const dialogs = await this.client.getDialogs();
          this.addLog(`Found ${dialogs.length} dialogs, searching for matching entities...`);
          
          for (const dialog of dialogs) {
            if (dialog.entity && dialog.entity.id.toString() === fromChatId.toString().replace('-100', '') || 
                dialog.entity && dialog.entity.id.toString() === fromChatId.toString()) {
              fromEntity = dialog.entity;
              this.addLog(`✅ Found source entity in dialogs: ${fromEntity.id}`);
            }
            if (dialog.entity && (dialog.entity.id.toString() === toChatId.toString() || 
                dialog.title === toChatId || 
                ('username' in dialog.entity && dialog.entity.username === toChatId.replace('@', '')))) {
              toEntity = dialog.entity;
              this.addLog(`✅ Found destination entity in dialogs: ${toEntity.id}`);
            }
          }
          
          if (!fromEntity || !toEntity) {
            throw new Error(`Could not resolve entities. From: ${!!fromEntity}, To: ${!!toEntity}`);
          }
        } catch (dialogError: any) {
          throw new Error(`Failed to resolve entities: ${entityError.message}. Dialog fallback: ${dialogError.message}`);
        }
      }

      let messagesProcessed = 0;
      let lastId = this.config.offsetFrom;
      let currentOffset = this.config.offsetFrom;
      
      this.addLog(`Starting continuous iteration from offset ${this.config.offsetFrom}...`);
      this.addLog(`Will process until offset ${this.config.offsetTo || 'latest'}`);
      
      // Continuous iteration like Python copier - keep going until we reach offsetTo or no more messages
      while (!this.shouldStop) {
        this.addLog(`Fetching batch starting from offset ${currentOffset}...`);
        
        let messages;
        try {
          // Use iterMessages for continuous pagination like Python
          const iterator = this.client.iterMessages(fromEntity!, {
            reverse: true,
            offsetId: currentOffset,
            limit: 50 // Process in larger batches like Python
          });
          
          messages = [];
          for await (const msg of iterator) {
            if (this.shouldStop) break;
            
            // Check if we've reached the offsetTo limit
            if (this.config.offsetTo && msg.id >= this.config.offsetTo) {
              this.addLog(`Reached offset limit: ${this.config.offsetTo}`);
              break;
            }
            
            messages.push(msg);
            if (messages.length >= 50) break; // Process in batches
          }
          
          this.addLog(`Found ${messages.length} messages in this batch`);
          
          if (messages.length === 0) {
            this.addLog(`✅ No more messages to process. Reached end of chat.`);
            break;
          }
        } catch (msgError: any) {
          this.addLog(`❌ Error getting messages: ${msgError.message}`);
          break;
        }
        
        // Process each message in the batch
        for (const message of messages) {
          if (this.shouldStop) {
            this.addLog('Stopping due to user request');
            break;
          }

          // Check offset limit again
          if (this.config.offsetTo && message.id >= this.config.offsetTo) {
            this.addLog(`Reached offset limit: ${this.config.offsetTo}, stopping`);
            break;
          }

          // Python: if isinstance(message, MessageService): continue
          if (message.className?.includes('MessageService')) {
            currentOffset = message.id;
            continue;
          }

          try {
            // Use proper forwardMessages to preserve metadata and attribution
            await this.client.forwardMessages(toEntity!, {
              messages: [message.id],
              fromPeer: fromEntity!
            });
            
            lastId = message.id;
            currentOffset = message.id;
            messagesProcessed++;
            
            this.addLog(`Forwarded message ID: ${lastId}`);

            this.onUpdate({
              currentOffset: message.id,
              progress: this.config.offsetTo ? 
                Math.round(((message.id - this.config.offsetFrom) / (this.config.offsetTo - this.config.offsetFrom)) * 100) :
                undefined,
              updatedAt: new Date().toISOString(),
            });

            // Small delay between messages
            await new Promise(resolve => setTimeout(resolve, 150));

          } catch (error) {
            if (error instanceof FloodWaitError) {
              const waitTime = error.seconds;
              this.addLog(`Rate limited, waiting ${waitTime} seconds...`);
              await new Promise(resolve => setTimeout(resolve, waitTime * 1000));
              
              // Retry with proper forwardMessages
              await this.client!.forwardMessages(toEntity!, {
                messages: [message.id],
                fromPeer: fromEntity!
              });
              lastId = message.id;
              currentOffset = message.id;
              messagesProcessed++;
              this.addLog(`Forwarded message ${message.id} after wait`);
            } else {
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              this.addLog(`Error forwarding message ${message.id}: ${errorMessage}`);
              currentOffset = message.id; // Continue with next message
            }
          }
        }
        
        // If we processed fewer messages than requested, we've likely reached the end
        if (messages.length < 50) {
          this.addLog(`✅ Processed final batch of ${messages.length} messages`);
          break;
        }
      }

      if (this.shouldStop) {
        this.addLog('Forwarding stopped by user');
        this.onUpdate({
          status: 'paused',
          updatedAt: new Date().toISOString(),
        });
      } else {
        this.addLog(`Forwarding completed. Processed ${messagesProcessed} messages.`);
        this.onUpdate({
          status: 'completed',
          progress: 100,
          updatedAt: new Date().toISOString(),
        });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.addLog(`Job failed: ${errorMessage}`);
      this.onUpdate({
        status: 'error',
        error: errorMessage,
        updatedAt: new Date().toISOString(),
      });
    } finally {
      this.isRunning = false;
      if (this.client) {
        await this.client.disconnect();
        this.client = null;
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.isRunning) {
      throw new Error('Job is not running');
    }

    this.shouldStop = true;
    this.addLog('Stopping forwarding job...');
  }

  getStatus(): Pick<ForwardJob, 'status' | 'logs'> {
    return {
      status: this.isRunning ? 'running' : 'idle',
      logs: [...this.logs],
    };
  }

  getLogs(): string[] {
    return [...this.logs];
  }
}

export class TelegramForwarder {
  static async startForwarding(
    config: ForwardConfig,
    sessionString: string,
    apiId: number,
    apiHash: string,
    onUpdate: (jobId: string, update: Partial<ForwardJob>) => void
  ): Promise<string> {
    const jobId = `${config.name}_${Date.now()}`;
    
    if (activeJobs.has(jobId)) {
      throw new Error('Job with this ID is already running');
    }

    const jobManager = new ForwardJobManager(
      jobId,
      config,
      sessionString,
      apiId,
      apiHash,
      (update) => onUpdate(jobId, update)
    );

    activeJobs.set(jobId, jobManager);

    // Start the job in background
    jobManager.start().finally(() => {
      // Clean up completed/failed jobs after 1 hour
      setTimeout(() => {
        activeJobs.delete(jobId);
      }, 60 * 60 * 1000);
    });

    return jobId;
  }

  static async stopForwarding(jobId: string): Promise<void> {
    const jobManager = activeJobs.get(jobId);
    if (!jobManager) {
      throw new Error('Job not found');
    }

    await jobManager.stop();
  }

  static getJobStatus(jobId: string): Pick<ForwardJob, 'status' | 'logs'> | null {
    const jobManager = activeJobs.get(jobId);
    return jobManager ? jobManager.getStatus() : null;
  }

  static getJobLogs(jobId: string): string[] {
    const jobManager = activeJobs.get(jobId);
    return jobManager ? jobManager.getLogs() : [];
  }

  static getAllJobs(): string[] {
    return Array.from(activeJobs.keys());
  }

  static stopAllJobs(): Promise<void[]> {
    const stopPromises = Array.from(activeJobs.values()).map(manager => 
      manager.stop().catch(error => {
        logger.error(`Failed to stop job ${manager.id}: ${error}`);
      })
    );
    
    return Promise.all(stopPromises);
  }
}