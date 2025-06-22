import sqlite3 from 'sqlite3';

// Initialize SQLite database connection
export const db = new sqlite3.Database('./service_peek.db');

// Run initial migration / schema setup only once
export const initializeSchema = () => {
  db.serialize(() => {
    // Providers table
    db.run(`
      CREATE TABLE IF NOT EXISTS providers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_name TEXT NOT NULL,
        provider_ip TEXT NOT NULL,
        username TEXT NOT NULL,
        private_key_filename TEXT NOT NULL,
        ssh_port INTEGER DEFAULT 22,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Services table
    db.run(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        service_name TEXT NOT NULL,
        service_ip TEXT,
        service_status TEXT DEFAULT 'unknown',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES providers(id)
      )
    `);
  });
};

// Call initialization immediately so importing the module makes sure the schema exists.
initializeSchema();

export default db;