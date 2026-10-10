-- Restore pre-finalization manual adjustments as part of the invoice line snapshot.
ALTER TYPE "InvoiceLineType" ADD VALUE IF NOT EXISTS 'ADJUSTMENT';
