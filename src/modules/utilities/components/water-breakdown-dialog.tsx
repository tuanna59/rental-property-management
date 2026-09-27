"use client";

import { Droplets } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { formatVnd } from "@/lib/presentation";

type Water = {
  room: string;
  billablePeople: number;
  occupantDays: number;
  calculatedPreviewAmount: string | null;
  finalPreviewAmount: string | null;
  occupants: Array<{
    id: string;
    personName: string;
    fullMonth: boolean;
    billableDays: number;
    amount: string | null;
  }>;
};

export function WaterBreakdownDialog({ water }: { water: Water }) {
  if (!water.occupants.length) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button type="button" size="sm" variant="ghost">
          <Droplets /> Details
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Water breakdown · {water.room}</DialogTitle>
          <DialogDescription>
            Calculated separately for each occupant.
          </DialogDescription>
        </DialogHeader>
        <div className="meter-reading-list">
          {water.occupants.map((occupant) => (
            <div className="meter-reading-item" key={occupant.id}>
              <strong>{occupant.personName}</strong>
              <span>
                {occupant.fullMonth
                  ? "Full month"
                  : `${occupant.billableDays} days`}
              </span>
              <strong>
                {occupant.amount ? formatVnd(occupant.amount) : "No rate"}
              </strong>
            </div>
          ))}
        </div>
        <div className="meter-breakdown-total">
          <span>Total · {water.occupantDays} occupant-days</span>
          <strong>
            {water.finalPreviewAmount
              ? formatVnd(water.finalPreviewAmount)
              : "—"}
          </strong>
        </div>
      </DialogContent>
    </Dialog>
  );
}
