/**
 * Seed Photos Script
 * 
 * Seeds test photos for the HITL workflow testing.
 * Uses pg directly (not drizzle) to match production DB connection pattern.
 */

import pg from "pg";
import * as dotenv from "dotenv";
import path from "path";

// Load .env.local for DATABASE_URL
dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const { Client } = pg;

async function seedPhotos() {
  console.log("📸 Starting photo seeding...\n");

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error("❌ DATABASE_URL not found in environment");
    process.exit(1);
  }

  const client = new Client({
    connectionString: databaseUrl,
  });

  try {
    await client.connect();
    console.log("✅ Connected to database");

    // 1. Get tenant_id for 'envivo-tandil'
    console.log("\n📋 Step 1: Finding tenant 'envivo-tandil'...");
    const tenantResult = await client.query(
      `SELECT id FROM tenants WHERE slug = 'envivo-tandil' LIMIT 1`
    );

    if (tenantResult.rows.length === 0) {
      console.error("❌ Tenant 'envivo-tandil' not found. Run seed-test-data.ts first.");
      process.exit(1);
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`   ✅ Tenant ID: ${tenantId}`);

    // 2. Get source_id for 'manual-test'
    console.log("\n📋 Step 2: Finding source 'manual-test'...");
    const sourceResult = await client.query(
      `SELECT id FROM sources WHERE slug = 'manual-test' AND tenant_id = $1 LIMIT 1`,
      [tenantId]
    );

    if (sourceResult.rows.length === 0) {
      console.error("❌ Source 'manual-test' not found. Run seed-test-data.ts first.");
      process.exit(1);
    }
    const sourceId = sourceResult.rows[0].id;
    console.log(`   ✅ Source ID: ${sourceId}`);

    // 3. Get all event IDs
    console.log("\n📋 Step 3: Fetching all events...");
    const eventsResult = await client.query(
      `SELECT id, title FROM events WHERE tenant_id = $1`,
      [tenantId]
    );

    if (eventsResult.rows.length === 0) {
      console.error("❌ No events found. Run seed-test-data.ts first.");
      process.exit(1);
    }
    console.log(`   ✅ Found ${eventsResult.rows.length} events:`);
    eventsResult.rows.forEach((event) => {
      console.log(`      - ${event.title} (${event.id})`);
    });

    // 4. Photo data to insert
    const photoData = [
      {
        originalUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
        storageKey: "test/photo-1.jpg",
        width: 1200,
        height: 800,
      },
      {
        originalUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
        storageKey: "test/photo-2.jpg",
        width: 1200,
        height: 800,
      },
      {
        originalUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
        storageKey: "test/photo-3.jpg",
        width: 1200,
        height: 800,
      },
      {
        originalUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
        storageKey: "test/photo-4.jpg",
        width: 1200,
        height: 800,
      },
      {
        originalUrl: "https://images.unsplash.com/photo-1470229722913-7c0e2dbbafd3?w=1200",
        storageKey: "test/photo-5.jpg",
        width: 1200,
        height: 800,
      },
    ];

    // 5. Distribute photos across events (1-2 per event, cycling through)
    console.log("\n📋 Step 4: Inserting photos...");
    const insertedPhotos = [];
    
    for (let i = 0; i < photoData.length; i++) {
      const photo = photoData[i];
      const eventIndex = i % eventsResult.rows.length;
      const eventId = eventsResult.rows[eventIndex].id;

      // Check if photo already exists
      const existingResult = await client.query(
        `SELECT id FROM photos WHERE tenant_id = $1 AND storage_key = $2`,
        [tenantId, photo.storageKey]
      );

      if (existingResult.rows.length > 0) {
        console.log(`   ⏭️  Photo already exists: ${photo.storageKey}`);
        insertedPhotos.push(existingResult.rows[0].id);
        continue;
      }

      // Insert photo
      const insertResult = await client.query(
        `INSERT INTO photos (tenant_id, event_id, source_id, original_url, storage_key, width, height, metadata_json)
         VALUES ($1, $2, $3, $4, $5, $6, $7, '{}'::jsonb)
         RETURNING id`,
        [tenantId, eventId, sourceId, photo.originalUrl, photo.storageKey, photo.width, photo.height]
      );

      const photoId = insertResult.rows[0].id;
      insertedPhotos.push(photoId);
      console.log(`   ✅ Inserted: ${photo.storageKey} -> event[${eventIndex}] (${eventsResult.rows[eventIndex].title})`);
    }

    // 6. Summary
    console.log("\n✨ Photo seeding completed!");
    console.log("\n📊 Summary:");
    console.log(`   • Photos inserted: ${insertedPhotos.length}`);
    console.log(`   • Events with photos: ${eventsResult.rows.length}`);
    console.log("\n📋 Inserted photo IDs (for reference):");
    insertedPhotos.forEach((id, i) => {
      console.log(`   ${i + 1}. ${id}`);
    });

  } catch (error) {
    console.error("\n❌ Photo seeding failed:", error);
    process.exit(1);
  } finally {
    await client.end();
    console.log("\n🔌 Database connection closed");
  }
}

seedPhotos();
