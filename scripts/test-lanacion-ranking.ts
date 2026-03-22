/**
 * Test La Nación RSS with ranking system
 */

import { LaNacionRSSConnector } from "../src/lib/ingestion/sources/lanacion-rss";

async function testLaNacionRanking() {
  console.log("📡 LA NACIÓN RSS - SISTEMA DE RANKING\n");
  console.log("=" .repeat(70));
  
  try {
    const laNacion = new LaNacionRSSConnector({
      sourceId: "lanacion",
      sourceType: "rss",
      isShared: true
    });
    
    const items = await laNacion.fetch({ tenantId: "test" });
    
    console.log(`\n✅ Total items con relevancia: ${items.length}\n`);
    console.log("=" .repeat(70));
    
    // Mostrar top 10
    for (let i = 0; i < Math.min(10, items.length); i++) {
      const item = items[i];
      const data = item.rawData as any;
      const title = data?.item?.title?.replace(/<\!\[CDATA\[|\]\]>/g, '') || 'Sin título';
      const score = data?.filterResult?.reasons?.find((r: string) => r.includes('Total score'))?.match(/\d+/)?.[0] || '?';
      const reasons = data?.filterResult?.reasons?.filter((r: string) => !r.includes('Total score')) || [];
      
      console.log(`\n${i + 1}. [${score} pts] ${title}`);
      reasons.forEach((reason: string) => console.log(`   → ${reason}`));
    }
    
  } catch (error) {
    console.error("❌ Error:", error);
  }
}

testLaNacionRanking();
