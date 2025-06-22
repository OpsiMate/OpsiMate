import { db } from './database';

export interface Service {
    id: number;
    provider_id: number;
    service_name: string;
    service_ip: string | null;
    service_status: string;
    created_at: string;
}

export interface CreateServiceData {
    provider_id: number;
    service_name: string;
    service_ip: string;
}

export class ServiceRepository {
    static async create(data: CreateServiceData): Promise<Service> {
        return new Promise((resolve, reject) => {
            db.run(
                'INSERT INTO services (provider_id, service_name, service_ip) VALUES (?, ?, ?)',
                [data.provider_id, data.service_name, data.service_ip],
                function (err) {
                    if (err) {
                        reject(err);
                        return;
                    }

                    // Get the created service
                    db.get('SELECT * FROM services WHERE id = ?', [this.lastID], (err, row) => {
                        if (err) reject(err);
                        else resolve(row as Service);
                    });
                }
            );
        });
    }

    static async findByProviderId(providerId: number): Promise<Service[]> {
        return new Promise((resolve, reject) => {
            db.all('SELECT * FROM services WHERE provider_id = ? ORDER BY created_at DESC', [providerId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows as Service[]);
            });
        });
    }
}