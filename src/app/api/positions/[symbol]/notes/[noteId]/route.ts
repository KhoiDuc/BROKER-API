import {
  corsPreflightResponse,
  jsonResponse,
  noContentResponse,
  notFoundResponse,
  requireAuth,
  serverErrorResponse,
} from "@/lib/guard";
import { parseBody } from "@/lib/parse-body";
import { updateNote, deleteNote } from "@/lib/portfolio-service";
import { noteSchema } from "@/lib/schemas";
import type { BrokerNoteJson } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function OPTIONS(request: Request) {
  return corsPreflightResponse(request);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ symbol: string; noteId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol, noteId } = await params;
  const parsed = await parseBody(request, noteSchema);
  if (!parsed.ok) return parsed.response;

  try {
    const updated = await updateNote(symbol, noteId, parsed.data as BrokerNoteJson);
    return jsonResponse(updated, request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to update not found")) return notFoundResponse(request);
    console.error(`[PUT /api/positions/${symbol}/notes/${noteId}]`, error);
    return serverErrorResponse(msg, request);
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ symbol: string; noteId: string }> },
) {
  const authError = await requireAuth(request);
  if (authError) return authError;

  const { symbol, noteId } = await params;
  try {
    await deleteNote(symbol, noteId);
    return noContentResponse(request);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes("not found") || msg.includes("Record to delete does not exist")) return notFoundResponse(request);
    console.error(`[DELETE /api/positions/${symbol}/notes/${noteId}]`, error);
    return serverErrorResponse(msg, request);
  }
}