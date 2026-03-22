/**
 * Generate image from brand template using Satori and Sharp
 */

import satori from "satori";
import sharp from "sharp";
import { composeBrandTemplate } from "@/lib/brand";
import type { BrandSection } from "@/lib/brand/types";
import { loadFont } from "@/lib/brand/utils";

interface GenerateImageOptions {
  format: string;
  variant: string;
  section: BrandSection;
  title: string;
  subtitle?: string;
  photoUrl: string;
  date?: string;
}

export async function generateImageFromTemplate(
  options: GenerateImageOptions,
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const { format, variant, section, title, subtitle, photoUrl, date } = options;

  // Compose brand template
  const { element, width, height } = composeBrandTemplate({
    format: format as any,
    variant: variant as any,
    section,
    title,
    subtitle,
    photoUrl,
    date,
  });

  // Load fonts
  const fonts = [
    {
      name: "Syne",
      data: await loadFont("Syne-Regular.ttf"),
      weight: 400 as const,
      style: "normal" as const,
    },
    {
      name: "Syne",
      data: await loadFont("Syne-Bold.ttf"),
      weight: 700 as const,
      style: "normal" as const,
    },
  ];

  // Render SVG with Satori
  const svg = await satori(element, {
    width,
    height,
    fonts,
  });

  // Convert SVG to PNG using Sharp
  const buffer = await sharp(Buffer.from(svg))
    .png({
      quality: 90,
      compressionLevel: 9,
    })
    .toBuffer();

  return {
    buffer,
    width,
    height,
  };
}
