import { beforeEach, describe, expect, it, vi } from "vitest";

const tx = {
  buyLot: { deleteMany: vi.fn() },
  sell: { deleteMany: vi.fn() },
  note: { deleteMany: vi.fn() },
  dividend: { deleteMany: vi.fn() },
  position: { deleteMany: vi.fn(), create: vi.fn() },
};

vi.mock("./prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (fn: (client: typeof tx) => Promise<void>) => fn(tx)),
    position: { findMany: vi.fn().mockResolvedValue([]) },
  },
}));

import { savePortfolio } from "./portfolio-service";
import { prisma } from "./prisma";

describe("savePortfolio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deletes and recreates inside one interactive transaction", async () => {
    await savePortfolio({
      updatedAt: "2026-01-01T00:00:00.000Z",
      positions: [
        {
          symbol: "fpt",
          status: "NamGiu",
          buys: [{ id: "b1", boughtAt: "2026-01-02", price: 100, quantity: 10 }],
        },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    const firstArg = vi.mocked(prisma.$transaction).mock.calls[0][0];
    expect(typeof firstArg).toBe("function");
    expect(tx.position.deleteMany).toHaveBeenCalled();
    expect(tx.position.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ symbol: "FPT", isArchived: false }),
      }),
    );
  });
});
