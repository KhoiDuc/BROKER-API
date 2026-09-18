-- Add DaDong to PositionStatus (idempotent for DBs already patched manually)
ALTER TYPE "PositionStatus" ADD VALUE IF NOT EXISTS 'DaDong';
