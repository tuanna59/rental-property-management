"use client";

import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatVndLocale } from "@/i18n/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  if (!water.occupants.length) return null;
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="utility-estimate-details-trigger"
          aria-label={`${t("viewWaterDetails")} · ${water.room}`}
          title={t("viewWaterDetails")}
        >
          <ChevronRight />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("waterBreakdown", { room: water.room })}</DialogTitle>
          <DialogDescription>
            {t("waterCalculatedPerOccupant")}
          </DialogDescription>
        </DialogHeader>
        <div className="meter-reading-list">
          {water.occupants.map((occupant) => (
            <div className="meter-reading-item" key={occupant.id}>
              <strong>{occupant.personName}</strong>
              <span>
                {occupant.fullMonth
                  ? t("fullMonth")
                  : t("days", { count: occupant.billableDays })}
              </span>
              <strong>
                {occupant.amount ? formatVndLocale(occupant.amount, locale) : t("noRate")}
              </strong>
            </div>
          ))}
        </div>
        <div className="meter-breakdown-total">
          <span>{t("waterTotal", { days: water.occupantDays })}</span>
          <strong>
            {water.finalPreviewAmount
              ? formatVndLocale(water.finalPreviewAmount, locale)
              : "—"}
          </strong>
        </div>
      </DialogContent>
    </Dialog>
  );
}
