import { notFound } from "next/navigation";

import { ContentDetailClient } from "./ContentDetailClient";
import { getCandidateContentData } from "@/lib/content/queries";

export default async function ContentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const candidate = await getCandidateContentData(id);

  if (!candidate) {
    notFound();
  }

  return (
    <div className="container mx-auto py-8">
      <h1 className="text-2xl font-bold mb-6">Content Review</h1>
      <ContentDetailClient candidate={candidate} />
    </div>
  );
}
