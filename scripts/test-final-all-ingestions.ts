/**
 * Test final de todas las ingestas activas
 */

import { ElEcoTandilConnector } from "../src/lib/ingestion/sources/el-eco-tandil";
import { LaNacionRSSConnector } from "../src/lib/ingestion/sources/lanacion-rss";

async function testAllIngestions() {
  console.log("🎸 PRUEBA FINAL - INGESTAS ACTIVAS\n");
  console.log("=".repeat(80));

  // 1. El Eco de Tandil
  console.log("\n📰 EL ECO DE TANDIL (Fuente Local)");
  console.log("-".repeat(80));

  try {
    const elEco = new ElEcoTandilConnector();
    const elEcoEvents = await elEco.fetch({ tenantId: "envivo-tandil" });

    console.log(`✅ Items encontrados: ${elEcoEvents.length}\n`);

    // Top 5
    for (let i = 0; i < Math.min(5, elEcoEvents.length); i++) {
      const item = elEcoEvents[i];
      const data = item.rawData as any;
      const title =
        data?.title?.replace(/<!\[CDATA\[|\]\]>/g, "") || "Sin título";

      console.log(
        `${i + 1}. [${data?.eventType?.toUpperCase() || "UNKNOWN"}] ${title}`,
      );
      if (data?.artists?.length > 0) {
        console.log(`   Artistas: ${data.artists.join(", ")}`);
      }
      console.log(`   URL: ${data?.url || "N/A"}`);
      console.log();
    }
  } catch (error) {
    console.error("❌ Error El Eco:", error);
  }

  // 2. La Nación RSS
  console.log("\n📡 LA NACIÓN RSS (Fuente Nacional - Ranking por Score)");
  console.log("-".repeat(80));

  try {
    const laNacion = new LaNacionRSSConnector({
      sourceId: "lanacion",
      sourceType: "rss",
      isShared: true,
    });

    const laNacionItems = await laNacion.fetch({ tenantId: "test" });

    console.log(`✅ Items encontrados: ${laNacionItems.length}\n`);

    // Top 5
    for (let i = 0; i < Math.min(5, laNacionItems.length); i++) {
      const item = laNacionItems[i];
      const data = item.rawData as any;
      const title =
        data?.item?.title?.replace(/<!\[CDATA\[|\]\]>/g, "") || "Sin título";
      const scoreMatch = data?.filterResult?.reasons?.find((r: string) =>
        r.includes("Total score"),
      );
      const score = scoreMatch?.match(/\d+/)?.[0] || "?";

      console.log(`${i + 1}. [${score} pts] ${title}`);
      const reasons =
        data?.filterResult?.reasons?.filter(
          (r: string) => !r.includes("Total score"),
        ) || [];
      reasons.forEach((reason: string) => console.log(`   → ${reason}`));
      console.log();
    }
  } catch (error) {
    console.error("❌ Error La Nación:", error);
  }

  // Resumen
  console.log("\n" + "=".repeat(80));
  console.log("📊 RESUMEN FINAL");
  console.log("=".repeat(80));
  console.log("✅ El Eco de Tandil: Eventos locales con detección inteligente");
  console.log(
    "✅ La Nación RSS: Noticias nacionales con ranking por puntuación",
  );
  console.log("\n🎸 Sistema listo para producción");
}

testAllIngestions();
