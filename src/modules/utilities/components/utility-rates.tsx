"use client";

import * as React from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AppLocale } from "@/i18n/config";
import { formatDateOnlyLocale, formatMonthShortLocale, formatVndLocale } from "@/i18n/format";
import { CalendarDays, Plus, Zap, Droplets } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PreservingActionForm } from "@/components/ui/preserving-action-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { emptyActionState } from "@/lib/action-state";

import { saveOverrideAction, saveRateAction } from "../actions";

type Rates = Awaited<
  ReturnType<typeof import("../server/utility.queries").getRates>
>;

export function UtilityRates({
  propertyId,
  data,
  rooms,
}: {
  propertyId: string;
  data: Rates;
  rooms: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">{t("eyebrow")}</p>
          <h1>{t("ratesTitle")}</h1>
          <p>
            {t("ratesSubtitle")}
          </p>
        </div>
      </header>
      <div className="rate-layout">
        <RateCard
          propertyId={propertyId}
          type="ELECTRICITY"
          title={t("electricity")}
          description={t("perKwh")}
          icon={<Zap />}
          rates={data.rates.filter(
            (rate) => rate.utilityType === "ELECTRICITY",
          )}
        />
        <RateCard
          propertyId={propertyId}
          type="WATER"
          title={t("waterUtility")}
          description={t("perPersonMonth")}
          icon={<Droplets />}
          rates={data.rates.filter((rate) => rate.utilityType === "WATER")}
        />
      </div>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>{t("roomOverrides")}</h2>
            <p>
              {t("roomOverridesSubtitle")}
            </p>
          </div>
          <OverrideDialog rooms={rooms} />
        </div>
        {data.overrides.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>{t("room")}</th>
                  <th>{t("month")}</th>
                  <th>{t("rate")}</th>
                  <th>{t("reason")}</th>
                </tr>
              </thead>
              <tbody>
                {data.overrides.map((item) => (
                  <tr key={item.id}>
                    <td className="utility-room">{item.space.name}</td>
                    <td>{formatMonthShortLocale(item.billingMonth, locale)}</td>
                    <td>{formatVndLocale(item.rate, locale)} / kWh</td>
                    <td>{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="utilities-empty">
            <CalendarDays />
            <div>
              <strong>{t("noOverrides")}</strong>
              <p>
                {t("noOverridesDetail")}
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function RateCard({
  propertyId,
  type,
  title,
  description,
  icon,
  rates,
}: {
  propertyId: string;
  type: "ELECTRICITY" | "WATER";
  title: string;
  description: string;
  icon: React.ReactNode;
  rates: Rates["rates"];
}) {
  const t = useTranslations("utilities");
  const locale = useLocale() as AppLocale;
  const current = rates.find((rate) => !rate.effectiveTo) ?? rates[0];
  return (
    <section className="rate-card">
      <header className="rate-card-header">
        <div className="flex items-center gap-2 text-[var(--app-brand)]">
          {icon}
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      <div className="rate-current">
        <div>
          <span>{t("currentRate")}</span>
          <strong>
            {current
              ? `${formatVndLocale(current.rate, locale)} / ${type === "ELECTRICITY" ? "kWh" : t("personMonth")}`
              : t("notConfigured")}
          </strong>
          <span>
            {current
              ? t("effective", { date: formatDateOnlyLocale(current.effectiveFrom, locale) })
              : t("addRateBegin")}
          </span>
        </div>
        <RateDialog propertyId={propertyId} type={type} />
      </div>
      {rates.length ? (
        <table className="rate-history">
          <thead>
            <tr>
              <th>{t("effectiveFrom")}</th>
              <th>{t("effectiveTo")}</th>
              <th>{t("rate")}</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.id}>
                <td>{formatDateOnlyLocale(rate.effectiveFrom, locale)}</td>
                <td>
                  {rate.effectiveTo ? formatDateOnlyLocale(rate.effectiveTo, locale) : t("currentMonth")}
                </td>
                <td>
                  {formatVndLocale(rate.rate, locale)} /{" "}
                  {type === "ELECTRICITY" ? "kWh" : t("personMonth")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="utilities-empty">
          <div>
            <strong>{t("noRateConfigured", { type: title.toLowerCase() })}</strong>
            <p>{t("ratesHistoryNote")}</p>
          </div>
        </div>
      )}
    </section>
  );
}

function RateDialog({
  propertyId,
  type,
}: {
  propertyId: string;
  type: "ELECTRICITY" | "WATER";
}) {
  const t = useTranslations("utilities");
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    saveRateAction,
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> {t("addNewRate")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {t("addUtilityRate", { type: type === "ELECTRICITY" ? t("electricity").toLowerCase() : t("waterUtility").toLowerCase() })}
          </DialogTitle>
          <DialogDescription>
            {t("previousRateHistory")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="utilityType" value={type} />
          <div className="dialog-grid">
            <Field
              label={
                type === "ELECTRICITY"
                  ? t("rateVndKwh")
                  : t("rateVndPerson")
              }
              name="rate"
              type="number"
              step="0.001"
              required
            />
            <Field
              label={t("effectiveFrom")}
              name="effectiveFrom"
              type="date"
              required
            />
          </div>
          <Field label={t("notes")} name="notes" as="textarea" />
          <p className={`dialog-message ${state.ok ? "success" : "error"}`}>
            {state.message}
          </p>
          <DialogFooter>
            <Button type="submit">{t("saveRate")}</Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function OverrideDialog({
  rooms,
}: {
  rooms: Array<{ id: string; name: string }>;
}) {
  const t = useTranslations("utilities");
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    saveOverrideAction,
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> {t("addOverride")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("addRoomOverrideTitle")}</DialogTitle>
          <DialogDescription>
            {t("roomOverrideDescription")}
          </DialogDescription>
        </DialogHeader>
        <PreservingActionForm action={action} className="dialog-form">
          <div className="field">
            <Label htmlFor="override-room">{t("room")}</Label>
            <select id="override-room" name="spaceId" required>
              <option value="">{t("chooseRoom")}</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          <div className="dialog-grid">
            <Field
              label={t("billingMonthLabel")}
              name="billingMonth"
              type="month"
              required
            />
            <Field
              label={t("overrideRate")}
              name="rate"
              type="number"
              step="0.001"
              required
            />
          </div>
          <Field label={t("reason")} name="reason" required />
          <p className={`dialog-message ${state.ok ? "success" : "error"}`}>
            {state.message}
          </p>
          <DialogFooter>
            <Button type="submit">{t("saveOverride")}</Button>
          </DialogFooter>
        </PreservingActionForm>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  as,
  ...props
}: React.ComponentProps<typeof Input> & { label: string; as?: "textarea" }) {
  const id = React.useId();
  return (
    <div className="field">
      <Label htmlFor={id}>{label}</Label>
      {as === "textarea" ? (
        <Textarea
          id={id}
          {...(props as React.ComponentProps<typeof Textarea>)}
        />
      ) : (
        <Input id={id} {...props} />
      )}
    </div>
  );
}
