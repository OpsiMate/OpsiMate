import { Mutex } from 'async-mutex';
import { Logger } from '@OpsiMate/shared';

const logger = new Logger('jobs/AsyncQueue');

type BaseQueueOptions = {
  timeThreshold?: number;
  countThreshold?: number;
  queueName?: string;
  retryAttempts?: number;
  retryDelay?: number;
};

export class AsyncQueue<T> {
  private readonly timeThreshold: number;
  private timer: NodeJS.Timeout | null = null;
  private readonly countThreshold: number;
  private readonly retryAttempts: number;
  private readonly retryDelay: number;

  private mutex: Mutex;
  private readonly queueName: string;

  private readonly processJobs: (jobs: T[]) => Promise<void>;

  private jobQueue: T[];
  private isProcessing: boolean;
  private deadLetterQueue: T[];

  constructor(
    jobProcessor: (jobs: T[]) => Promise<void>,
    options?: BaseQueueOptions
  ) {
    this.timeThreshold = options?.timeThreshold ?? 10_000; // defaults to 10 seconds
    this.retryAttempts = options?.retryAttempts ?? 1; // no retry by default
    this.retryDelay = options?.retryDelay ?? 2500; // 2.5 seconds of retry delay (base delay for exponential backoff)
    this.countThreshold = options?.countThreshold ?? 2; // defaults to 10 jobs
    this.processJobs = jobProcessor;
    this.queueName = options?.queueName ?? 'Unnamed Queue';

    this.mutex = new Mutex();
    this.jobQueue = [];
    this.isProcessing = false;
    this.deadLetterQueue = [];
  }

  public async add(job: T) {
    const release = await this.mutex.acquire();
    try {
      this.jobQueue.push(job);
      if (this.jobQueue.length < this.countThreshold) this.resetTimer();
      else {
        logger.info(
          `Count threshold reached for ${this.queueName}. Processing queue`
        );
        await this.processQueue();
      }
    } finally {
      release();
    }
  }

  public getDeadLetterQueue() {
    return [...this.deadLetterQueue];
  }

  public clearDeadLetterQueue() {
    this.deadLetterQueue = [];
  }

  private resetTimer() {
    if (this.timer) clearTimeout(this.timer);

    this.timer = setTimeout(() => {
      logger.info(
        `Time threshold reached for ${this.queueName}. Processing queue`
      );
      void this.processQueue();
    }, this.timeThreshold);
  }

  private async attemptProcessingWithRetries(jobs: T[]) {
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        await this.processJobs(jobs);
        return; // If it succeeds, exit the loop
      } catch (error) {
        logger.warn(
          `Attempt ${attempt} failed for batch of ${jobs.length} jobs.`
        );

        attempt++;
        if (attempt === this.retryAttempts) throw error; // If this was the last attempt, re-throw the error

        // Wait before the next retry, with exponential backoff
        const delay = this.retryDelay * Math.pow(2, attempt);
        logger.info(`Waiting ${delay}ms before next retry...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private async getJobsForProcessing(): Promise<T[]> {
    const release = await this.mutex.acquire();
    try {
      return [...this.jobQueue]; // a copy of the jobs currently in the queue
    } finally {
      release();
    }
  }

  private async removeProcessedJobs(count: number): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.jobQueue.splice(0, count);
    } finally {
      release();
    }
  }

  private async moveJobsToDLQ(failedJobs: T[]): Promise<void> {
    const release = await this.mutex.acquire();
    try {
      this.deadLetterQueue.push(...failedJobs);
      this.jobQueue.splice(0, failedJobs.length);
    } finally {
      release();
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessing) return; // Prevent concurrent processing runs

    const jobsToProcess = await this.getJobsForProcessing();
    if (jobsToProcess.length === 0) return;

    this.isProcessing = true;
    if (this.timer) clearTimeout(this.timer);

    try {
      await this.attemptProcessingWithRetries(jobsToProcess);
      await this.removeProcessedJobs(jobsToProcess.length);
      logger.info(
        `Successfully processed and removed ${jobsToProcess.length} jobs.`
      );
    } catch (error) {
      logger.error(
        `All retry attempts failed for a batch of ${jobsToProcess.length} jobs. Moving to Dead-Letter Queue.`,
        error
      );
      await this.moveJobsToDLQ(jobsToProcess);
    } finally {
      this.isProcessing = false;
      if (this.jobQueue.length > 0) void this.processQueue();
    }
  }
}
