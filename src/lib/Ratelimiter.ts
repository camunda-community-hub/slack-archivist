interface QueuedTask<T> {
  task: () => T;
  promise: {
    resolve: (res: any) => void;
    reject: (err: any) => void;
  };
}

interface RateLimitedTask<T> {
  task: () => T;
  /**
   * Default: false. Set true to allow this to be bumped by other operations.
   * Use this, for example, for non-UI background async tasks.
   */
  preemptible?: boolean;
}

/**
 * Rate limit operations, for example: to avoid saturating an API with calls
 */
export class RateLimiter {
  private debounceMs: number;
  private priorityQueue: QueuedTask<any>[] = [];
  private preemptibleQueue: QueuedTask<any>[] = [];
  private rateLimiting?: NodeJS.Timeout;

  /**
   *
   * @param rateLimitToMs minimum number of milliseconds between operations
   */
  constructor(rateLimitToMs: number) {
    this.debounceMs = rateLimitToMs;
  }

  /**
   *
   * @param req {RateLimitedTask}
   */
  runRateLimited<T>(req: RateLimitedTask<T>): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      const queue = req.preemptible
        ? this.preemptibleQueue
        : this.priorityQueue;
      queue.push({
        task: req.task,
        promise: { resolve, reject },
      });
    });
    this.scheduleNextTask();
    return result;
  }

  private scheduleNextTask() {
    if (!this.rateLimiting) {
      this.runImmediately();
    }
  }

  private runImmediately() {
    const toRun: QueuedTask<any> | undefined = this.priorityQueue.length
      ? this.priorityQueue.pop()
      : this.preemptibleQueue.pop();

    if (!toRun) {
      return;
    }

    const hasQueuedTasks =
      !!this.priorityQueue.length || !!this.preemptibleQueue.length;

    if (hasQueuedTasks) {
      this.rateLimiting = setTimeout(() => {
        this.rateLimiting = undefined;
        this.runImmediately();
      }, this.debounceMs);
    }
    const promise = toRun.promise;
    toRun.task().then(promise.resolve).catch(promise.reject);
  }
}
