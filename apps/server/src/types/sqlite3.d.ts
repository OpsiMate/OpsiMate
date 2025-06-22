declare module 'sqlite3' {
  import { EventEmitter } from 'events';

  export class verbose {
    static Database: typeof Database;
  }

  export class Database extends EventEmitter {
    constructor(filename: string);
    run(sql: string, params: any[], callback?: (this: RunResult, err: Error | null) => void): this;
    get(sql: string, params: any[], callback: (err: Error | null, row: any) => void): void;
    all(sql: string, params: any[], callback: (err: Error | null, rows: any[]) => void): void;
    close(callback?: (err: Error | null) => void): void;
  }

  export interface RunResult {
    lastID: number;
    changes: number;
  }

  const sqlite3: {
    Database: typeof Database;
  };

  export default sqlite3;
}