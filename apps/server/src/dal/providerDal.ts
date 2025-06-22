import db from './db';
import { Provider } from '@service-peek/shared';
import type { RunResult } from 'sqlite3';

export interface NewProviderInput {
  provider_name: string;
  provider_ip: string;
  username: string;
  private_key_filename: string;
  ssh_port?: number;
}

export const insertProvider = (input: NewProviderInput): Promise<Provider> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO providers (provider_name, provider_ip, username, private_key_filename, ssh_port) VALUES (?, ?, ?, ?, ?)`,
      [input.provider_name, input.provider_ip, input.username, input.private_key_filename, input.ssh_port ?? 22],
      function (this: RunResult, err: Error | null) {
        if (err) return reject(err);

        db.get('SELECT * FROM providers WHERE id = ?', [this.lastID], (err: Error | null, row: unknown) => {
          if (err) return reject(err);
          resolve(row as Provider);
        });
      }
    );
  });
};

export const getProviderById = (id: number): Promise<Provider | null> => {
  return new Promise((resolve, reject) => {
    db.get('SELECT * FROM providers WHERE id = ?', [id], (err: Error | null, row: unknown) => {
      if (err) return reject(err);
      resolve(row as Provider | null);
    });
  });
};

export const getAllProviders = (): Promise<Provider[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM providers ORDER BY created_at DESC', (err: Error | null, rows: unknown[]) => {
      if (err) return reject(err);
      resolve(rows as Provider[]);
    });
  });
};