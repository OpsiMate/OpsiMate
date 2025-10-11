export const DUMMY_EXPORT = true; // Added this line to prevent the transpiler from injecting the fatal 'export {};' at the end.
const request = require('supertest');
const Database = require('better-sqlite3');

// Convert internal imports to require
const { createApp } = require('../src/app'); 
const { Role, ProviderType } = require('@OpsiMate/shared');

// Import the ProviderBL class
const { ProviderBL } = require('../src/bl/providers/provider.bl'); 

// Set a longer timeout for tests (30 seconds), as network operations 
// (SSH/K8s discovery/refresh) can be slow in integration tests.
jest.setTimeout(30000);

// NOTE: We rely on the SuperTest type cast below and omit the type import entirely.
describe('Providers API', () => {
    // We use 'any' for the type here since we can no longer import 'SuperTest<Test>'
    let app: any; 
    let db: any;

    beforeAll(async () => {
        db = new Database(':memory:');
        // We cast the request object to the expected type for better runtime compatibility
        const expressApp = await createApp(db);
        app = request(expressApp); // The original type cast is no longer needed here but in the usage below
    });

    beforeEach(() => {
        db.exec('DELETE FROM users');
        db.exec('DELETE FROM providers');
        jest.clearAllMocks(); 
    });

    afterAll(() => {
        db.close();
    });

    // --- DISCOVER SERVICES TEST SUITE ---
    describe('GET /api/v1/providers/:providerId/discover-services', () => {
        let adminToken: string;
        let providerId: number;

        beforeEach(async () => {
            // Register admin
            await app.post('/api/v1/users/register').send({
                email: 'admin@example.com',
                fullName: 'Admin User',
                password: 'securepassword'
            });
            const loginRes = await app.post('/api/v1/users/login').send({
                email: 'admin@example.com',
                password: 'securepassword'
            });
            adminToken = loginRes.body.token;

            // Create a provider
            const providerRes = await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
                name: 'Test Provider',
                providerIP: '192.168.1.100',
                username: 'testuser',
                password: 'testpass',
                SSHPort: 22,
                providerType: ProviderType.VM
            });
            providerId = providerRes.body.data.id;
        });

        test('should successfully discover services from valid provider', async () => {
            const res = await app.get(`/api/v1/providers/${providerId}/discover-services`).set('Authorization', `Bearer ${adminToken}`);

            expect([200, 500]).toContain(res.status);

            if (res.status === 200) {
                expect(res.body.success).toBe(true);
                expect(Array.isArray(res.body.data)).toBe(true);
                if (res.body.data.length > 0) {
                    expect(res.body.data[0]).toMatchObject({
                        name: expect.any(String),
                        serviceStatus: expect.any(String),
                        serviceIP: expect.any(String),
                        namespace: expect.any(String) // optional
                    });
                }
            } else {
                expect(res.body.success).toBe(false);
                expect(res.body.error).toBe('Internal server error');
            }
        });

        test('should return error for non-existent provider', async () => {
            const nonExistentId = 9999;
            const res = await app.get(`/api/v1/providers/${nonExistentId}/discover-services`).set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(500);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Internal server error');
        });

        test('should return 400 for invalid provider ID', async () => {
            const res = await app.get('/api/v1/providers/invalid/discover-services').set('Authorization', `Bearer ${adminToken}`);

            expect(res.status).toBe(400);
            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Invalid provider ID');
        });

        test('should reject access for non-admin user', async () => {
            // Create a viewer user
            await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
                email: 'viewer@example.com',
                fullName: 'Viewer User',
                password: 'securepassword',
                role: Role.Viewer
            });
            const viewerLogin = await app.post('/api/v1/users/login').send({
                email: 'viewer@example.com',
                password: 'securepassword'
            });
            const viewerToken = viewerLogin.body.token;

            // Attempt to discover services as viewer
            const res = await app.get(`/api/v1/providers/${providerId}/discover-services`).set('Authorization', `Bearer ${viewerToken}`);

            expect(res.status).toBe(403);
            expect(res.body.success).toBe(false);
        });

        test('should reject access for unauthenticated request', async () => {
            const res = await app.get(`/api/v1/providers/${providerId}/discover-services`);

            expect(res.status).toBe(401);
            expect(res.body.success).toBe(false);
        });

        test('should not modify existing data (read-only operation)', async () => {
            // Get initial provider state
            const initialProvidersRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);
            const initialProviders = initialProvidersRes.body.data.providers;

            // Attempt discovery
            await app.get(`/api/v1/providers/${providerId}/discover-services`).set('Authorization', `Bearer ${adminToken}`);

            // Check that providers are unchanged
            const afterProvidersRes = await app.get('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`);
            const afterProviders = afterProvidersRes.body.data.providers;

            expect(afterProviders).toEqual(initialProviders);
        });
    });

    // --- REFRESH TEST SUITE ---
    describe('POST /api/v1/providers/:providerId/refresh', () => {
        let adminToken: string;
        let providerId: number;

        // Use jest.spyOn on the ProviderBL class prototype to mock the instance method
        const mockRefreshProvider = jest.spyOn(ProviderBL.prototype, 'refreshProvider') as jest.Mock;

        beforeEach(async () => {
            // Register admin (using a distinct email for isolation)
            await app.post('/api/v1/users/register').send({
                email: 'refresh_admin@example.com',
                fullName: 'Refresh Admin',
                password: 'securepassword'
            });
            const loginRes = await app.post('/api/v1/users/login').send({
                email: 'refresh_admin@example.com',
                password: 'securepassword'
            });
            adminToken = loginRes.body.token;
            
            // Create a provider
            const providerRes = await app.post('/api/v1/providers').set('Authorization', `Bearer ${adminToken}`).send({
                name: 'Refresh Test Provider',
                providerIP: '192.168.1.101',
                username: 'refreshuser',
                password: 'refreshpass',
                SSHPort: 22,
                providerType: ProviderType.K8S
            });
            providerId = providerRes.body.data.id;

            // Clear mock call count before each test
            mockRefreshProvider.mockClear();
        });

        // ✅ SCENARIO 1: Successful refresh with valid ID and proper permissions (200 OK)
        test('should successfully refresh provider data and return 200 OK', async () => {
            // Mock the service call success, returning the expected structure from ProviderBL.refreshProvider
            mockRefreshProvider.mockResolvedValue({
                provider: { id: providerId, status: 'synchronized', lastSyncTime: new Date().toISOString() },
                services: [],
            });

            const res = await app.post(`/api/v1/providers/${providerId}/refresh`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(200);

            // Validate response structure (status code, refresh status, updated data)
            expect(res.body.success).toBe(true);
            expect(res.body).toHaveProperty('data');
            // Assuming the controller returns the provider and services directly from BL:
            expect(res.body.data.provider.id).toBe(providerId);
            expect(res.body.data.provider.status).toBe('synchronized');

            // Provider data is properly synchronized and Audit log records the action (implied by service call)
            expect(mockRefreshProvider).toHaveBeenCalledTimes(1);
            expect(mockRefreshProvider).toHaveBeenCalledWith(providerId); // Check arguments: expects only providerId
        });

        // ❌ SCENARIO 2: Attempt to refresh non-existent provider (should return 404)
        test('should return 404 Not Found for a non-existent provider ID', async () => {
            const nonExistentId = providerId + 100;

            // NOTE: We rely on the internal Express/DB handling to check for existence before the BL is called.
            // Since we're not mocking the DB/router logic, this test relies on the non-mocked flow to hit 404.
            // If the provider *were* found (which it won't be in a real run against the DB), the mock would be used.
            // For now, we trust the DB interaction outside the mock for this negative test case.
            
            const res = await app.post(`/api/v1/providers/${nonExistentId}/refresh`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(404);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Provider not found');
            // Ensure the BL method wasn't called because the provider shouldn't exist in the DB.
            expect(mockRefreshProvider).not.toHaveBeenCalled(); 
        });

        // 🔒 SCENARIO 3: Verify correct permissions - 403 Forbidden for Viewer
        test('should return 403 Forbidden if a non-admin user attempts refresh', async () => {
            // Create a viewer user
            await app.post('/api/v1/users').set('Authorization', `Bearer ${adminToken}`).send({
                email: 'viewer_refresh@example.com',
                fullName: 'Viewer User',
                password: 'securepassword',
                role: Role.Viewer 
            });
            const viewerLogin = await app.post('/api/v1/users/login').send({
                email: 'viewer_refresh@example.com',
                password: 'securepassword'
            });
            const viewerToken = viewerLogin.body.token;

            // Attempt to refresh as viewer
            const res = await app.post(`/api/v1/providers/${providerId}/refresh`)
                .set('Authorization', `Bearer ${viewerToken}`)
                .expect(403);

            expect(res.body.success).toBe(false);
            expect(mockRefreshProvider).not.toHaveBeenCalled();
        });

        // 🔒 SCENARIO 3b: Verify correct permissions - 401 Unauthorized
        test('should return 401 Unauthorized if no token is provided', async () => {
            const res = await app.post(`/api/v1/providers/${providerId}/refresh`)
                .expect(401); 

            expect(res.body.success).toBe(false);
            expect(mockRefreshProvider).not.toHaveBeenCalled();
        });
        
        // ⚠️ SCENARIO 4: Validate handling of internal synchronization errors (500)
        test('should return 500 Internal Server Error if synchronization fails', async () => {
            // Mock the service layer to throw an error 
            mockRefreshProvider.mockRejectedValue(new Error('Upstream credentials expired.'));

            const res = await app.post(`/api/v1/providers/${providerId}/refresh`)
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(500);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toBe('Internal server error');
            expect(mockRefreshProvider).toHaveBeenCalledTimes(1);
        });
        
        // 🧾 SCENARIO 5: Invalid Provider ID (400)
        test('should return 400 Bad Request for an invalid provider ID format', async () => {
            const res = await app.post('/api/v1/providers/invalid_id_format/refresh')
                .set('Authorization', `Bearer ${adminToken}`)
                .expect(400);

            expect(res.body.success).toBe(false);
            expect(res.body.error).toContain('Invalid provider ID'); 
            expect(mockRefreshProvider).not.toHaveBeenCalled();
        });
    });
});
