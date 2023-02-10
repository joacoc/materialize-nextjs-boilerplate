interface Update {
    key?: string;
    value: any;
    diff: number;
}

export default class State {
    private state: Record<string, any>;
    private stateCount: Record<string, number>;
    private timestamp: number;
    private valid: boolean;

    constructor() {
      this.state = {};
      this.stateCount = {};
      this.timestamp = 0;
      this.valid = true;
    }

    get(key: string) {
      return this.state[key];
    }

    getKeys(): Array<String> {
      return Object.keys(this.state);
    }

    getValues(): Array<any> {
      return Object.values(this.state);
    }

    isValid(): Boolean {
      return this.valid;
    }

    getTimestamp(): Number {
      return this.timestamp;
    }

    getState(): Readonly<Record<string, any>> {
      return structuredClone(this.state);
    }

    private apply_diff(key: string, diff: number) {
      // Count value starts as a NaN
      this.stateCount[key] = this.stateCount[key] + diff || 1;
    }

    private hash(value: any): string {
      return JSON.stringify(value);
    }

    private validate(timestamp: number) {
      if (!this.valid) {
        throw new Error("Invalid state.");
      } else if (timestamp < this.timestamp) {
        console.error("Invalid timestamp.");
        this.valid = false;
        throw new Error(
          `Update with timestamp (${timestamp}) is lower than the last timestamp (${
            this.timestamp
          }). Invalid state.`
        );
      }
    }

    private process({ key, value, diff }: Update) {
      const _key = key || this.hash(value);
      this.apply_diff(_key, diff);
      const count = this.stateCount[_key];

      if (count <= 0) {
        delete this.state[_key];
        delete this.stateCount[_key];
      } else {
        this.state[_key] = value;
      }
    }

    update(update: Update, timestamp: number) {
      this.validate(timestamp);
      this.timestamp = timestamp;
      this.process(update);
    }

    batchUpdate(updates: Array<Update>, timestamp: number) {
      if (Array.isArray(updates) && updates.length > 0) {
        this.validate(timestamp);
        this.timestamp = timestamp;
        updates.forEach(this.process.bind(this));
      }
    }

    toString() {
      return JSON.stringify(this.state);
    }
  };
