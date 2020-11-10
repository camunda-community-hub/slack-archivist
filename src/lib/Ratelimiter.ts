interface QueuedTask {
  task: () => any;
  promise: {
    resolve: (res: any) => void;
    reject: (err: any) => void;
  };
}
export class RateLimiter {
  private everyMs: number;
  private priorityQueue: QueuedTask[] = [];
  private lowPriorityQueue: QueuedTask[] = [];
  private rateLimiting?: NodeJS.Timeout;

  constructor(everyMs: number) {
    this.everyMs = everyMs;
  }

  private scheduleNextTask() {
    if (this.rateLimiting) {
      return;
    }
    this.runImmediately();
  }

  private runImmediately() {
    let toRun: QueuedTask | undefined;
    if (this.priorityQueue.length > 0) {
      toRun = this.priorityQueue.pop();
    } else if (this.lowPriorityQueue.length > 0) {
      toRun = this.lowPriorityQueue.pop();
    }
    if (toRun === undefined) {
      return;
    }
    if (this.priorityQueue.length > 0 || this.lowPriorityQueue.length > 0) {
      this.rateLimiting = setTimeout(() => {
        this.rateLimiting = undefined;
        this.runImmediately();
      }, this.everyMs);
    }
    toRun
      .task()
      .then((res) => toRun!.promise.resolve(res))
      .catch((err) => toRun!.promise.reject(err));
  }

  runRateLimited<T>({
    task,
    lowPriority,
  }: {
    task: () => T;
    lowPriority?: boolean;
  }): Promise<T> {
    const result = new Promise<T>((resolve, reject) => {
      if (lowPriority) {
        this.lowPriorityQueue.push({
          task,
          promise: { resolve, reject },
        });
      } else {
        this.priorityQueue.push({
          task,
          promise: { resolve, reject },
        });
      }
    });
    this.scheduleNextTask();
    return result;
  }
}
