/**
 * Test completo del pipeline de generación con Inngest
 *
 * Este script prueba el flujo completo:
 * 1. Toma un item de content_feed_items existente
 * 2. Crea una selección de topic apuntando a ese item
 * 3. Ejecuta el servicio generateContentFromSelection
 * 4. Verifica que se generen candidatos y se dispare el job de Inngest
 */

import { generateContentFromSelection } from "../src/lib/generation/content-generator";
import { db } from "../src/lib/db/client";
import {
  contentFeedItems,
  topicSelections,
  candidateContent,
} from "../src/lib/db/schema";
import { eq } from "drizzle-orm";

async function testPipeline() {
  console.log("🚀 TEST COMPLETO DEL PIPELINE\n");
  console.log("=".repeat(80));

  try {
    // 1. Verificar que tenemos items en content_feed_items
    console.log("\n1️⃣ Verificando items disponibles...");
    const items = await db.select().from(contentFeedItems).limit(1);

    if (items.length === 0) {
      console.error("❌ No hay items en content_feed_items");
      process.exit(1);
    }

    const item = items[0];
    console.log(`✅ Item encontrado: ${item.title}`);
    console.log(`   ID: ${item.id}`);
    console.log(`   Source: ${item.source}`);
    console.log(`   Content Type: ${item.contentType}`);

    // 2. Crear una topic_selection apuntando al item
    console.log("\n2️⃣ Creando topic_selection...");
    const tenantId = item.tenantId;

    const [selection] = await db
      .insert(topicSelections)
      .values({
        tenantId: tenantId,
        sourceType: "content_feed_item",
        sourceId: item.id,
        formats: [{ type: "post", tone: "informative", priority: 1 }],
        targetPublishAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        urgency: "medium",
        status: "pending",
        createdBy: "320156ee-78d7-45bb-a1d1-ed4a38ab70a0",
        metadata: {
          item_title: item.title,
          test: true,
        },
      })
      .returning();

    console.log(`✅ Topic selection creada: ${selection.id}`);
    console.log(`   Source: ${selection.sourceType} → ${selection.sourceId}`);
    console.log(`   Formato: ${JSON.stringify(selection.formats)}`);

    // 3. Ejecutar el pipeline
    console.log("\n3️⃣ Ejecutando pipeline de generación...");
    console.log("   Llamando a generateContentFromSelection...");
    console.log(
      "   Feature flag ENABLE_GENERATION_PIPELINE:",
      process.env.ENABLE_GENERATION_PIPELINE,
    );

    const result = await generateContentFromSelection(selection.id, {
      emitEvent: true,
    });

    console.log("\n✅ PIPELINE EJECUTADO\n");
    console.log("Resultado:");
    console.log(`   Selection ID: ${result.selectionId}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Candidates generados: ${result.candidates?.length || 0}`);

    if (result.candidates && result.candidates.length > 0) {
      console.log("\n   Candidatos:");
      result.candidates.forEach((c: any, i: number) => {
        console.log(`   ${i + 1}. ${c.title} (${c.status})`);
        console.log(`      Format: ${c.format}, Tone: ${c.tone}`);
      });
    }

    // 4. Verificar estado
    console.log("\n4️⃣ Verificando estado en base de datos...");
    const updatedSelection = await db
      .select()
      .from(topicSelections)
      .where(eq(topicSelections.id, selection.id));

    console.log(`   Estado de selección: ${updatedSelection[0]?.status}`);

    // Contar candidatos nuevos
    const newCandidates = await db
      .select()
      .from(candidateContent)
      .where(eq(candidateContent.tenantId, tenantId));

    console.log(`   Total candidatos en DB: ${newCandidates.length}`);

    console.log("\n" + "=".repeat(80));
    console.log("🎉 TEST COMPLETADO");
    console.log("=".repeat(80));
    console.log("\nPróximos pasos:");
    console.log("1. Revisar logs de Inngest para ver procesamiento async");
    console.log("2. Verificar en dashboard: /content");
    console.log("3. Revisar si se generaron imágenes");
  } catch (error) {
    console.error("\n❌ ERROR EN EL TEST:\n", error);
    process.exit(1);
  }
}

testPipeline();
