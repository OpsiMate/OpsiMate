import Database from "better-sqlite3";
import { runAsync } from "./db.js";
import { ResetPassword, ResetPasswordType } from "@OpsiMate/shared";
import { ResetPasswordRow } from "./models.js";

export class PasswordResetsRepository {
  private db: Database.Database;

  constructor(db: Database.Database) {
    this.db = db;
  }

  async initPasswordResetsTable(): Promise<void> {
    return runAsync(() => {
      this.db
        .prepare(
          `
                CREATE TABLE IF NOT EXISTS password_resets (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    user_id INTEGER NOT NULL,
                    token_hash TEXT NOT NULL,
                    expires_at DATETIME NOT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                )
            `
        )
        .run();
    });
  }

  async createPasswordResetToken(
    resetPassword: ResetPasswordType
  ): Promise<void> {
    return runAsync(() => {
      const transaction = this.db.transaction(() => {
        this.db
          .prepare("DELETE FROM password_resets WHERE user_id = ?")
          .run(resetPassword.userId);
        this.db
          .prepare(
            "INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES (?, ?, ?)"
          )
          .run(
            resetPassword.userId,
            resetPassword.tokenHash,
            resetPassword.expiresAt.toISOString()
          );
      });
      transaction();
    });
  }

  async getPasswordResetByTokenHash(tokenHash: string): Promise<ResetPassword | null> {
    return runAsync((): ResetPassword | null => {
      const row = this.db
        .prepare("SELECT * FROM password_resets WHERE token_hash = ?")
        .get(tokenHash) as ResetPasswordRow | undefined;

      return row ? this.toSharedResetPassword(row) : null;
    });
  }

  private toSharedResetPassword = (row: ResetPasswordRow): ResetPassword => {
    return {
      id: row.id,
      userId: row.user_id,
      tokenHash: row.token_hash,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    };
  }

  async deletePasswordResetsByUserId(userId: number): Promise<void> {
    return runAsync(() => {
      this.db
        .prepare("DELETE FROM password_resets WHERE user_id = ?")
        .run(userId);
    });
  }
}
