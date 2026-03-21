import { eq } from "drizzle-orm";
import { closeDb, db } from "../src/lib/db/client";
import {
  tenants,
  sources,
  events,
  photos,
  personas,
  templates,
  candidateContent,
} from "../src/lib/db/schema";
import * as fs from "fs";
import * as path from "path";

const TENANT_SLUG = "envivo-tandil";

async function seedTestData() {
  console.log("🌱 Starting test data seeding...\n");

  // 1. Get or create tenant
  console.log("📋 Step 1: Finding tenant...");
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.slug, TENANT_SLUG),
  });

  if (!tenant) {
    console.log(`   Creating tenant: ${TENANT_SLUG}`);
    const [newTenant] = await db
      .insert(tenants)
      .values({
        slug: TENANT_SLUG,
        name: "Envivo Tandil",
        configJson: {
          locale: "es-AR",
          timezone: "America/Argentina/Buenos_Aires",
        },
      })
      .returning();
    tenant = newTenant;
    console.log(`   ✅ Tenant created: ${tenant.id}`);
  } else {
    console.log(`   ✅ Using existing tenant: ${tenant.id}`);
  }

  const tenantId = tenant.id;

  // 2. Create or get source
  console.log("\n📋 Step 2: Creating source...");
  let source = await db.query.sources.findFirst({
    where: eq(sources.slug, "manual-test"),
  });

  if (!source) {
    const [newSource] = await db
      .insert(sources)
      .values({
        tenantId,
        slug: "manual-test",
        name: "Datos de Prueba",
        kind: "manual",
      })
      .returning();
    source = newSource;
    console.log(`   ✅ Source created: ${source.name} (${source.id})`);
  } else {
    console.log(`   ✅ Using existing source: ${source.name} (${source.id})`);
  }

  // 3. Create events
  console.log("\n📋 Step 3: Creating events...");
  const eventData = [
    {
      title: "Festival de Rock Tandil 2024",
      venue: "Anfiteatro Martín Fierro",
      eventDate: new Date("2024-12-15T20:00:00-03:00"),
    },
    {
      title: "Jazz en el Parque",
      venue: "Parque Independencia",
      eventDate: new Date("2024-12-20T19:00:00-03:00"),
    },
    {
      title: "Noche de Folklore",
      venue: "Centro Cultural El Centenario",
      eventDate: new Date("2024-12-22T21:00:00-03:00"),
    },
  ];

  const createdEvents = [];
  for (const event of eventData) {
    const existing = await db.query.events.findFirst({
      where: eq(events.title, event.title),
    });

    if (!existing) {
      const [newEvent] = await db
        .insert(events)
        .values({
          tenantId,
          sourceId: source.id,
          ...event,
          statusText: "active",
        })
        .returning();
      createdEvents.push(newEvent);
      console.log(`   ✅ Event created: ${newEvent.title}`);
    } else {
      createdEvents.push(existing);
      console.log(`   ✅ Using existing event: ${existing.title}`);
    }
  }

  // 4. Create photos
  console.log("\n📋 Step 4: Creating photos...");
  const photoData = [
    {
      eventIndex: 0,
      url: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=1200",
      width: 1200,
      height: 800,
      storageKey: "test/photo-1-rock-festival.jpg",
    },
    {
      eventIndex: 0,
      url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=800",
      width: 800,
      height: 600,
      storageKey: "test/photo-2-concert-crowd.jpg",
    },
    {
      eventIndex: 1,
      url: "https://images.unsplash.com/photo-1511192336575-5a79af67a629?w=1200",
      width: 1200,
      height: 800,
      storageKey: "test/photo-3-jazz-park.jpg",
    },
    {
      eventIndex: 2,
      url: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?w=1080",
      width: 1080,
      height: 1080,
      storageKey: "test/photo-4-folklore-night.jpg",
    },
    {
      eventIndex: 2,
      url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a?w=1200",
      width: 1200,
      height: 800,
      storageKey: "test/photo-5-cultural-center.jpg",
    },
  ];

  const createdPhotos = [];
  for (const photo of photoData) {
    const event = createdEvents[photo.eventIndex];
    const existing = await db.query.photos.findFirst({
      where: eq(photos.storageKey, photo.storageKey),
    });

    if (!existing) {
      const [newPhoto] = await db
        .insert(photos)
        .values({
          tenantId,
          eventId: event.id,
          sourceId: source.id,
          originalUrl: photo.url,
          storageKey: photo.storageKey,
          width: photo.width,
          height: photo.height,
        })
        .returning();
      createdPhotos.push(newPhoto);
      console.log(`   ✅ Photo created: ${photo.storageKey}`);
    } else {
      createdPhotos.push(existing);
      console.log(`   ✅ Using existing photo: ${photo.storageKey}`);
    }
  }

  // 5. Create personas
  console.log("\n📋 Step 5: Creating personas...");
  const personasDir = path.join(process.cwd(), "personas");

  const personaData = [
    {
      slug: "dany",
      name: "Dany Gimenez",
      fileName: "dany.md",
    },
    {
      slug: "informativo",
      name: "Informativo",
      fileName: "informativo.md",
    },
  ];

  for (const persona of personaData) {
    const existing = await db.query.personas.findFirst({
      where: eq(personas.slug, persona.slug),
    });

    if (!existing) {
      const skillContent = fs.readFileSync(
        path.join(personasDir, persona.fileName),
        "utf-8"
      );

      const [newPersona] = await db
        .insert(personas)
        .values({
          tenantId,
          slug: persona.slug,
          name: persona.name,
          skillContentMd: skillContent,
          isDefault: persona.slug === "dany",
        })
        .returning();
      console.log(`   ✅ Persona created: ${newPersona.name}`);
    } else {
      console.log(`   ✅ Using existing persona: ${existing.name}`);
    }
  }

  // 6. Create templates
  console.log("\n📋 Step 6: Creating templates...");
  const templateData = [
    {
      slug: "post-hero",
      name: "Post Hero",
      format: "post" as const,
      componentKey: "ig-post-square",
    },
    {
      slug: "story-portrait",
      name: "Story Portrait",
      format: "story" as const,
      componentKey: "ig-story-portrait",
    },
    {
      slug: "carousel-square",
      name: "Carousel Square",
      format: "carousel" as const,
      componentKey: "ig-carousel-square",
    },
  ];

  for (const template of templateData) {
    const existing = await db.query.templates.findFirst({
      where: eq(templates.slug, template.slug),
    });

    if (!existing) {
      const [newTemplate] = await db
        .insert(templates)
        .values({
          tenantId,
          ...template,
          isActive: true,
        })
        .returning();
      console.log(`   ✅ Template created: ${newTemplate.name}`);
    } else {
      console.log(`   ✅ Using existing template: ${existing.name}`);
    }
  }

  // 7. Create candidate content
  console.log("\n📋 Step 7: Creating candidate content...");
  const candidateData = [
    {
      eventIndex: 0,
      photoIndex: 0,
      title: "🎸 Festival de Rock Tandil 2024 - ¡Se viene!",
      status: "candidate" as const,
      format: "post" as const,
      tone: "dany",
      summary: {
        date: "15 de diciembre",
        time: "20:00",
        venue: "Anfiteatro Martín Fierro",
        description: "El festival de rock más esperado del año en Tandil",
      },
    },
    {
      eventIndex: 0,
      photoIndex: 1,
      title: "Rock en Tandil - Story",
      status: "selected" as const,
      format: "story" as const,
      tone: "dany",
      summary: {
        date: "15 de diciembre",
        time: "20:00",
        venue: "Anfiteatro Martín Fierro",
        description: "Story para el festival de rock",
      },
    },
    {
      eventIndex: 1,
      photoIndex: 2,
      title: "🎷 Jazz en el Parque - Agenda Cultural",
      status: "candidate" as const,
      format: "post" as const,
      tone: "informativo",
      summary: {
        date: "20 de diciembre",
        time: "19:00",
        venue: "Parque Independencia",
        description: "Presentación de jazz al aire libre",
      },
    },
  ];

  for (const candidate of candidateData) {
    const event = createdEvents[candidate.eventIndex];
    const photo = createdPhotos[candidate.photoIndex];
    
    const existing = await db.query.candidateContent.findFirst({
      where: eq(candidateContent.title, candidate.title),
    });

    if (!existing) {
      const [newCandidate] = await db
        .insert(candidateContent)
        .values({
          tenantId,
          sourceId: source.id,
          eventId: event.id,
          photoId: photo.id,
          title: candidate.title,
          status: candidate.status,
          selectedFormat: candidate.format,
          selectedTone: candidate.tone,
          summaryJson: candidate.summary,
        })
        .returning();
      console.log(`   ✅ Candidate content created: ${newCandidate.title.substring(0, 50)}...`);
    } else {
      console.log(`   ✅ Using existing candidate: ${existing.title.substring(0, 50)}...`);
    }
  }

  console.log("\n✨ Test data seeding completed!");
  console.log("\n📊 Summary:");
  console.log(`   • Tenant: ${TENANT_SLUG}`);
  console.log(`   • Source: manual-test`);
  console.log(`   • Events: ${eventData.length} events created`);
  console.log(`   • Photos: ${photoData.length} photos created`);
  console.log(`   • Personas: ${personaData.length} personas created`);
  console.log(`   • Templates: ${templateData.length} templates created`);
  console.log(`   • Candidate Content: ${candidateData.length} candidates created`);
  console.log("\n🔍 Verification URLs:");
  console.log(`   • http://localhost:3000/events?tenant_id=${TENANT_SLUG}`);
  console.log(`   • http://localhost:3000/content?tenant_id=${TENANT_SLUG}`);
}

seedTestData()
  .then(async () => {
    await closeDb();
    process.exit(0);
  })
  .catch(async (error) => {
    console.error("\n❌ Seed failed:", error);
    await closeDb().catch(() => {
      // no-op
    });
    process.exit(1);
  });
