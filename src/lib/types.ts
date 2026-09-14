export type PositionStatus =
  | "ChuaQuyet"
  | "ChoMua"
  | "NamGiu"
  | "CatLo"
  | "ChotLoi"
  | "BoTheoDoi";

export type NoteKind = "Broker" | "Self";

export type LevelInputMode = "Price" | "Percent";

export interface BrokerLotJson {
  id: string;
  boughtAt: string;
  price: number;
  quantity?: number | null;
  stopLoss?: number | null;
  stopLossMode?: LevelInputMode | null;
  stopLossInput?: number | null;
  targetPrice?: number | null;
  targetPriceMode?: LevelInputMode | null;
  targetPriceInput?: number | null;
  note?: string | null;
  tags?: string[];
}

export interface BrokerSellJson {
  id: string;
  soldAt: string;
  price: number;
  quantity?: number | null;
  fee?: number | null;
  tax?: number | null;
  note?: string | null;
}

export interface BrokerNoteJson {
  id: string;
  at: string;
  kind: NoteKind;
  text: string;
  aiExplain?: string | null;
}

export interface BrokerDividendJson {
  id: string;
  exDate: string;
  payDate?: string | null;
  amountPerShare: number;
  quantity: number;
  note?: string | null;
}

export interface BrokerPositionJson {
  symbol: string;
  sector?: string;
  status: PositionStatus;
  stopLoss?: number | null;
  stopLossMode?: LevelInputMode | null;
  stopLossInput?: number | null;
  targetPrice?: number | null;
  targetPriceMode?: LevelInputMode | null;
  targetPriceInput?: number | null;
  weightPct?: number | null;
  entryLow?: number | null;
  entryHigh?: number | null;
  recommendationText?: string | null;
  buys: BrokerLotJson[];
  sells?: BrokerSellJson[];
  notes?: BrokerNoteJson[];
  dividends?: BrokerDividendJson[];
  tags?: string[];
}

export interface BrokerPortfolioJson {
  updatedAt: string;
  positions: BrokerPositionJson[];
  closedPositions?: BrokerPositionJson[];
}
