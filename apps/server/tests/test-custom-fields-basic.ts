import Database from 'better-sqlite3';
import { ServiceCustomFieldRepository } from '../src/dal/serviceCustomFieldRepository';
import { ServiceCustomFieldValueRepository } from '../src/dal/serviceCustomFieldValueRepository';

async function testCustomFieldsBasic() {
  console.log('Testing basic custom fields table creation...');

  let db: Database.Database | null = null;

  try {
    // Create in-memory database
    db = new Database(':memory:');

    // Create repositories
    const fieldRepo = new ServiceCustomFieldRepository(db);
    const valueRepo = new ServiceCustomFieldValueRepository(db);

    // Initialize tables
    console.log('Initializing tables...');
    await fieldRepo.initServiceCustomFieldTable();

    // Also create services table for foreign key constraint
    db.exec(`
      CREATE TABLE IF NOT EXISTS services (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        service_name TEXT NOT NULL,
        service_ip TEXT,
        service_status TEXT NOT NULL,
        service_type TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        container_details TEXT
      )
    `);

    await valueRepo.initServiceCustomFieldValueTable();

    console.log('✅ Tables initialized successfully');

    // Create a test service
    console.log('Creating test service...');
    const serviceResult = db.prepare(
      'INSERT INTO services (provider_id, service_name, service_status, service_type) VALUES (?, ?, ?, ?)'
    ).run(1, 'Test Service', 'running', 'DOCKER');
    console.log(`✅ Test service created with ID: ${serviceResult.lastInsertRowid}`);

    // Test creating a custom field
    console.log('Creating custom field...');
    const result = await fieldRepo.createCustomField({ name: 'Test Field' });
    console.log(`✅ Custom field created with ID: ${result.lastID}`);

    // Test getting custom fields
    console.log('Getting custom fields...');
    const fields = await fieldRepo.getCustomFields();
    console.log(`✅ Found ${fields.length} custom fields`);

    // Test creating a custom field value
    console.log('Creating custom field value...');
    await valueRepo.upsertCustomFieldValue(serviceResult.lastInsertRowid as number, result.lastID, 'test value');
    console.log('✅ Custom field value created successfully');

    // Test getting custom field values
    console.log('Getting custom field values...');
    const values = await valueRepo.getCustomFieldValuesByServiceId(serviceResult.lastInsertRowid as number);
    console.log(`✅ Found ${values.length} custom field values`);

    console.log('✅ All basic tests passed!');

  } catch (error) {
    console.error('❌ Basic test failed:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

testCustomFieldsBasic();
