import { Request, Response } from "express";
import { readFileSync } from "fs";
import { join } from "path";

export class VersionController {
  public getVersionHandler = async (
    req: Request,
    res: Response,
  ): Promise<void> => {
    try {
      const packageJsonPath = join(process.cwd(), "package.json");
      const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf-8"));

      res.json({
        success: true,
        data: {
          version: packageJson.version || "1.0.0",
          name: packageJson.name || "OpsiMate",
          buildDate: new Date().toISOString(),
        },
      });
    } catch (error) {
      console.error("Error getting version:", error);
      res.json({
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
        data: {
          version: "1.0.0",
          name: "OpsiMate",
          buildDate: new Date().toISOString(),
        },
      });
    }
  };
}
