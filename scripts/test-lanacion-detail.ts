/**
 * Test La Nación RSS with detailed output
 */

import { LaNacionRSSConnector } from "../src/lib/ingestion/sources/lanacion-rss";

async function testLaNacion() {
  console.log("📡 LA NACIÓN RSS - TEST DETALLADO\n");
  console.log("=".repeat(70));

  try {
    const laNacion = new LaNacionRSSConnector({
      sourceId: "lanacion",
      sourceType: "rss",
      isShared: true,
    });

    const items = await laNacion.fetch({ tenantId: "test" });
    console.log(`\n✅ Total items filtrados: ${items.length}\n`);

    for (let i = 0; i < Math.min(10, items.length); i++) {
      const item = items[i];
      const data = item.rawData as any;
      console.log(`${i + 1}. ${data?.item?.title || "Sin título"}`);
      console.log(
        `   Categorías: ${data?.item?.category?.join?.(", ") || data?.item?.category || "N/A"}`,
      );
      console.log(
        `   Keywords detectadas: ${data?.filterResult?.matchedKeywords?.join?.(", ") || "Ninguna"}`,
      );
      console.log(
        `   Razones: ${data?.filterResult?.reasons?.join?.(" | ") || "N/A"}`,
      );
      console.log();
    }
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testLaNacion();
