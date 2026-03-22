/**
 * Test manual de generación de imagen
 *
 * Este script genera la imagen PNG final para un candidato existente
 */

import { generateImageFromTemplate } from "../src/lib/generation/image-generator";
import { db } from "../src/lib/db/client";
import {
  candidateContent,
  sections,
  generatedOutputs,
} from "../src/lib/db/schema";
import { eq } from "drizzle-orm";
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type { BrandSection } from "../src/lib/brand/types";

async function testImageGeneration() {
  console.log("🖼️  TEST DE GENERACIÓN DE IMAGEN\n");
  console.log("=".repeat(80));

  const candidateId = "c943e056-1fc4-4f58-978f-a4541cb063ad";

  try {
    // 1. Obtener candidato
    console.log("\n1️⃣ Obteniendo candidato...");
    const [candidate] = await db
      .select()
      .from(candidateContent)
      .where(eq(candidateContent.id, candidateId))
      .limit(1);

    if (!candidate) {
      console.error("❌ Candidato no encontrado");
      process.exit(1);
    }

    console.log(`✅ Candidato: ${candidate.title}`);
    console.log(`   Template: ${candidate.templateId}`);
    console.log(`   Variant: ${candidate.templateVariant}`);

    // 2. Obtener sección
    console.log("\n2️⃣ Obteniendo sección...");
    let sectionData: BrandSection = {
      id: "default",
      tenantId: candidate.tenantId,
      slug: "noticias",
      name: "General",
      color: "#8B5CF6",
    };

    if (candidate.sectionId) {
      const [section] = await db
        .select()
        .from(sections)
        .where(eq(sections.id, candidate.sectionId))
        .limit(1);

      if (section) {
        sectionData = {
          id: section.id,
          tenantId: section.tenantId,
          slug: section.slug as BrandSection["slug"],
          name: section.name,
          color: section.color,
        };
        console.log(`✅ Sección: ${section.name}`);
      }
    } else {
      console.log("⚠️  Usando sección por defecto");
    }

    // 3. Generar imagen
    console.log("\n3️⃣ Generando imagen...");
    console.log("   Esto puede tomar unos segundos...");

    const summary = (candidate.summaryJson as Record<string, unknown>) || {};

    const { buffer, width, height } = await generateImageFromTemplate({
      format: candidate.templateId || "post-vertical-45",
      variant: (candidate.templateVariant || "classic") as string,
      section: sectionData,
      title: candidate.title,
      subtitle: summary.description as string,
      photoUrl: (summary.imageUrl as string) || "",
      date: summary.eventDate as string,
    });

    console.log(`✅ Imagen generada: ${width}x${height}px`);
    console.log(`   Tamaño: ${(buffer.length / 1024).toFixed(2)} KB`);

    // 4. Guardar archivo
    console.log("\n4️⃣ Guardando imagen...");
    const outputDir = join(process.cwd(), "public", "generated");
    await mkdir(outputDir, { recursive: true });

    const fileName = `${candidateId}.png`;
    const filePath = join(outputDir, fileName);
    await writeFile(filePath, buffer);

    console.log(`✅ Imagen guardada: public/generated/${fileName}`);

    // 5. Guardar en BD
    console.log("\n5️⃣ Guardando en base de datos...");
    await db.insert(generatedOutputs).values({
      tenantId: candidate.tenantId,
      contentStateId: candidateId,
      candidateContentId: candidateId,
      fileUrl: `/generated/${fileName}`,
      width,
      height,
      sortOrder: 1,
      metadataJson: {
        format: candidate.templateId,
        variant: candidate.templateVariant,
        generatedAt: new Date().toISOString(),
        generatedBy: "manual-test",
      },
    });

    console.log(`✅ Registro guardado en generated_outputs`);

    // 6. Actualizar candidato
    console.log("\n6️⃣ Actualizando candidato...");
    await db
      .update(candidateContent)
      .set({
        summaryJson: {
          ...summary,
          generatedImageUrl: `/generated/${fileName}`,
          generatedAt: new Date().toISOString(),
        },
        updatedAt: new Date(),
      })
      .where(eq(candidateContent.id, candidateId));

    console.log(`✅ Candidato actualizado`);

    console.log("\n" + "=".repeat(80));
    console.log("🎉 IMAGEN GENERADA EXITOSAMENTE");
    console.log("=".repeat(80));
    console.log("\n📁 Archivo: public/generated/" + fileName);
    console.log("🌐 URL: http://localhost:3000/generated/" + fileName);
    console.log("\n💡 Próximos pasos:");
    console.log(
      "   - Ver imagen en: http://localhost:3000/content/" + candidateId,
    );
    console.log("   - Usar 'Publicar' desde el dashboard");
  } catch (error) {
    console.error("\n❌ ERROR:\n", error);
    process.exit(1);
  }
}

testImageGeneration();
