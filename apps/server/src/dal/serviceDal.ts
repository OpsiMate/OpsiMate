import db from './db';
import type { RunResult } from 'sqlite3';

export interface NewServiceInput {
  provider_id: number;
  service_name: string;
  service_ip?: string;
  service_status?: string;
}

export const insertService = (input: NewServiceInput): Promise<any> => {
  return new Promise((resolve, reject) => {
    db.run(
      `INSERT INTO services (provider_id, service_name, service_ip, service_status) VALUES (?, ?, ?, ?)`,
      [input.provider_id, input.service_name, input.service_ip ?? null, input.service_status ?? 'unknown'],
      function (this: RunResult, err: Error | null) {
        if (err) return reject(err);
        db.get('SELECT * FROM services WHERE id = ?', [this.lastID], (err: Error | null, row: unknown) => {
          if (err) return reject(err);
          resolve(row);
        });
      }
    );
  });
};

export const getServicesByProvider = (providerId: number): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    db.all('SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC', [providerId], (err: Error | null, rows: unknown[]) => {
      if (err) return reject(err);
      resolve(rows as any[]);
    });
  });
};