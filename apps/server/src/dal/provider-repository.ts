import { Provider } from '@service-peek/shared';
import { db } from './database';

export interface CreateProviderData {
    provider_name: string;
    provider_ip: string;
    username: string;
    private_key_filename: string;
    ssh_port: number;
}

export class ProviderRepository {
    static async create(data: CreateProviderData): Promise<Provider> {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO providers (provider_name, provider_ip, username, private_key_filename, ssh_port) VALUES (?, ?, ?, ?, ?)',
                [data.provider_name, data.provider_ip, data.username, data.private_key_filename, data.ssh_port],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Get the created provider
                    db.get('SELECT * FROM providers WHERE id = ?', [this.lastID], (err, row) => {
                        if (err) reject(err);
                        else resolve(row as Provider);
                    });
                }
            );
        });
    }

    static async findById(id: number): Promise<Provider | null> {
        return new Promise((resolve, reject) => {
            db.get('SELECT * FROM providers WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else resolve(row as Provider | null);
            });
        });
    }

    static async findAll(): Promise<Provider[]> {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM providers ORDER BY created_at DESC', (err, rows) => {
                if (err) reject(err);
                else resolve(rows as Provider[]);
            });
        });
    }
}