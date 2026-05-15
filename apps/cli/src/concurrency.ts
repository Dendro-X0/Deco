/**
 * A lightweight task queue to limit the number of concurrent asynchronous operations.
 */
export class TaskQueue {
    private readonly queue: (() => Promise<void>)[] = [];
    private activeCount = 0;

    constructor(private readonly concurrency: number) { }

    /**
     * Executes a task with concurrency limiting.
     */
    async run<T>(fn: () => Promise<T>): Promise<T> {
        if (this.activeCount < this.concurrency) {
            return this.execute(fn);
        }
        return new Promise<T>((resolve, reject) => {
            this.queue.push(async () => {
                try {
                    resolve(await this.execute(fn));
                } catch (err) {
                    reject(err);
                }
            });
        });
    }

    private async execute<T>(fn: () => Promise<T>): Promise<T> {
        this.activeCount += 1;
        try {
            return await fn();
        } finally {
            this.activeCount -= 1;
            this.next();
        }
    }

    private next(): void {
        const task = this.queue.shift();
        if (task) {
            void task();
        }
    }
}
