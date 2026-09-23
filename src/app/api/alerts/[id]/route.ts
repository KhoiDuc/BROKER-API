import { corsPreflightResponse, noContentResponse, notFoundResponse, requireAuth, serverErrorResponse } from "@/lib/guard";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
export const maxDuration = 15;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authError = await requireAuth(request);
  if (authError) return authError;
  const { id } = await params;
  try {
    const result = await prisma.priceAlert.deleteMany({ where: { id } });
    if (result.count === 0) return notFoundResponse(request);
    return noContentResponse(request);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete alert";
    return serverErrorResponse(message, request);
  }
}
