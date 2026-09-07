export class ManualClock {
  constructor() {
    this.now = 0;
    this.nextId = 1;
    this.tasks = new Map();
  }

  setTimeout(callback, delay) {
    const id = this.nextId++;
    this.tasks.set(id, { at: this.now + Math.max(0, delay), callback });
    return id;
  }

  clearTimeout(id) {
    this.tasks.delete(id);
  }

  async advance(ms) {
    const target = this.now + ms;
    while (true) {
      const ready = [...this.tasks.entries()]
        .filter(([, task]) => task.at <= target)
        .sort((a, b) => a[1].at - b[1].at)[0];
      if (!ready) break;
      const [id, task] = ready;
      this.tasks.delete(id);
      this.now = task.at;
      await task.callback();
    }
    this.now = target;
  }
}
