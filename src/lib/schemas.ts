import { z } from "zod";

const status = z.enum(["ChuaQuyet", "ChoMua", "NamGiu", "CatLo", "ChotLoi", "BoTheoDoi", "DaDong"]);
const noteKind = z.enum(["Broker", "Self"]);
const levelMode = z.enum(["Price", "Percent"]);

const optionalLevel = {
  stopLoss: z.number().nullable().optional(),
  stopLossMode: levelMode.nullable().optional(),
  stopLossInput: z.number().nullable().optional(),
  targetPrice: z.number().nullable().optional(),
  targetPriceMode: levelMode.nullable().optional(),
  targetPriceInput: z.number().nullable().optional(),
};

export const lotSchema = z.object({
  id: z.string().optional(),
  boughtAt: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().positive().nullable().optional(),
  note: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  ...optionalLevel,
});

export const sellSchema = z.object({
  id: z.string().optional(),
  soldAt: z.string().min(1),
  price: z.number().positive(),
  quantity: z.number().positive().nullable().optional(),
  fee: z.number().min(0).nullable().optional(),
  tax: z.number().min(0).nullable().optional(),
  note: z.string().nullable().optional(),
});

export const noteSchema = z.object({
  id: z.string().optional(),
  at: z.string().min(1),
  kind: noteKind.optional(),
  text: z.string().min(1),
  aiExplain: z.string().nullable().optional(),
});

export const dividendSchema = z.object({
  id: z.string().optional(),
  exDate: z.string().min(1),
  payDate: z.string().nullable().optional(),
  amountPerShare: z.number().positive(),
  quantity: z.number().int().positive(),
  note: z.string().nullable().optional(),
});

export const positionSchema = z.object({
  symbol: z.string().trim().min(1),
  sector: z.string().optional(),
  status: status.optional(),
  weightPct: z.number().nullable().optional(),
  entryLow: z.number().nullable().optional(),
  entryHigh: z.number().nullable().optional(),
  recommendationText: z.string().nullable().optional(),
  tags: z.array(z.string()).optional(),
  buys: z.array(lotSchema).optional(),
  sells: z.array(sellSchema).optional(),
  notes: z.array(noteSchema).optional(),
  dividends: z.array(dividendSchema).optional(),
  ...optionalLevel,
});

export const portfolioSchema = z.object({
  updatedAt: z.string().optional(),
  positions: z.array(positionSchema),
  closedPositions: z.array(positionSchema).optional(),
});

export const archiveSchema = z.object({
  isArchived: z.boolean(),
  status: status.optional(),
});

export const alertSchema = z.object({
  symbol: z.string().trim().min(1),
  direction: z.enum(["above", "below"]),
  price: z.number().positive(),
  channel: z.enum(["discord", "telegram"]).optional(),
});

export const aiChatSchema = z.object({
  prompt: z.string().trim().min(1).max(12000),
  model: z.string().trim().min(1).max(80).optional(),
});
