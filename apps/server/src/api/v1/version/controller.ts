import { Request, Response } from 'express';
import { readFileSync } from 'fs';
import { join } from 'path';

export class VersionController {
    public getVersionHandler = async (req: Request, res: Response): Promise<void> => {
        try {
            // Read package.json to get version
            const packageJsonPath = join(process.cwd(), 'package.json');
            const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
            
            res.json({
                success: true,
                data: {
                    version: packageJson.version || '1.0.0',
                    name: packageJson.name || 'OpsiMate',
                    buildDate: new Date().toISOString() // Could be replaced with actual build date
                }
            });
        } catch (error) {
            console.error('Error getting version:', error);
            res.json({
                success: true,
                data: {
                    version: '1.0.0',
                    name: 'OpsiMate',
                    buildDate: new Date().toISOString()
                }
            });
        }
    }
}