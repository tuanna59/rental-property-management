"use client";

import * as React from "react";
import { CalendarDays, Plus, Zap, Droplets } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { formatDate, formatVnd } from "@/lib/presentation";

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
  return (
    <div className="utilities-content">
      <header className="utilities-header">
        <div className="utilities-header-copy">
          <p className="utilities-eyebrow">PROPERTY UTILITIES</p>
          <h1>Utility rates</h1>
          <p>
            Manage electricity and water rates while preserving historical
            pricing.
          </p>
        </div>
      </header>
      <div className="rate-layout">
        <RateCard
          propertyId={propertyId}
          type="ELECTRICITY"
          title="Electricity"
          description="VND per electricity unit (kWh)"
          icon={<Zap />}
          rates={data.rates.filter(
            (rate) => rate.utilityType === "ELECTRICITY",
          )}
        />
        <RateCard
          propertyId={propertyId}
          type="WATER"
          title="Water"
          description="VND per person per month"
          icon={<Droplets />}
          rates={data.rates.filter((rate) => rate.utilityType === "WATER")}
        />
      </div>
      <section className="utility-section">
        <div className="utility-section-header">
          <div>
            <h2>Room electricity overrides</h2>
            <p>
              Overrides apply only to a specific room and month and do not
              change the property rate.
            </p>
          </div>
          <OverrideDialog rooms={rooms} />
        </div>
        {data.overrides.length ? (
          <div className="utility-table-wrap">
            <table className="utility-table">
              <thead>
                <tr>
                  <th>Room</th>
                  <th>Month</th>
                  <th>Rate</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {data.overrides.map((item) => (
                  <tr key={item.id}>
                    <td className="utility-room">{item.space.name}</td>
                    <td>{formatDate(item.billingMonth)}</td>
                    <td>{formatVnd(item.rate)} / kWh</td>
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
              <strong>No room-specific overrides</strong>
              <p>
                Add an override only when a room needs a distinct monthly
                electricity rate.
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
  const current = rates.find((rate) => !rate.effectiveTo) ?? rates[0];
  return (
    <section className="rate-card">
      <header className="rate-card-header">
        <div className="flex items-center gap-2 text-[#26715e]">
          {icon}
          <h2>{title}</h2>
        </div>
        <p>{description}</p>
      </header>
      <div className="rate-current">
        <div>
          <span>Current rate</span>
          <strong>
            {current
              ? `${formatVnd(current.rate)} / ${type === "ELECTRICITY" ? "kWh" : "person / month"}`
              : "Not configured"}
          </strong>
          <span>
            {current
              ? `Effective ${formatDate(current.effectiveFrom)}`
              : "Add a rate to begin"}
          </span>
        </div>
        <RateDialog propertyId={propertyId} type={type} />
      </div>
      {rates.length ? (
        <table className="rate-history">
          <thead>
            <tr>
              <th>Effective from</th>
              <th>Effective to</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            {rates.map((rate) => (
              <tr key={rate.id}>
                <td>{formatDate(rate.effectiveFrom)}</td>
                <td>
                  {rate.effectiveTo ? formatDate(rate.effectiveTo) : "Current"}
                </td>
                <td>
                  {formatVnd(rate.rate)} /{" "}
                  {type === "ELECTRICITY" ? "kWh" : "person / month"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="utilities-empty">
          <div>
            <strong>No {title.toLowerCase()} rate configured</strong>
            <p>Rates are preserved as historical records after they change.</p>
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
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    saveRateAction,
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add new rate
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Add {type === "ELECTRICITY" ? "electricity" : "water"} rate
          </DialogTitle>
          <DialogDescription>
            The previous rate remains in history and is closed on this effective
            date.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <input type="hidden" name="propertyId" value={propertyId} />
          <input type="hidden" name="utilityType" value={type} />
          <div className="dialog-grid">
            <Field
              label={
                type === "ELECTRICITY"
                  ? "Rate (VND / kWh)"
                  : "Rate (VND / person / month)"
              }
              name="rate"
              type="number"
              step="0.001"
              required
            />
            <Field
              label="Effective from"
              name="effectiveFrom"
              type="date"
              required
            />
          </div>
          <Field label="Notes" name="notes" as="textarea" />
          <p className={`dialog-message ${state.ok ? "success" : "error"}`}>
            {state.message}
          </p>
          <DialogFooter>
            <Button type="submit">Save rate</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function OverrideDialog({
  rooms,
}: {
  rooms: Array<{ id: string; name: string }>;
}) {
  const [open, setOpen] = React.useState(false);
  const [state, action] = React.useActionState(
    saveOverrideAction,
    emptyActionState,
  );
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus /> Add override
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add room override</DialogTitle>
          <DialogDescription>
            This applies only to one room for one calendar month.
          </DialogDescription>
        </DialogHeader>
        <form action={action} className="dialog-form">
          <div className="field">
            <Label htmlFor="override-room">Room</Label>
            <select id="override-room" name="spaceId" required>
              <option value="">Choose a room</option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id}>
                  {room.name}
                </option>
              ))}
            </select>
          </div>
          <div className="dialog-grid">
            <Field
              label="Billing month"
              name="billingMonth"
              type="month"
              required
            />
            <Field
              label="Override rate (VND / kWh)"
              name="rate"
              type="number"
              step="0.001"
              required
            />
          </div>
          <Field label="Reason" name="reason" required />
          <p className={`dialog-message ${state.ok ? "success" : "error"}`}>
            {state.message}
          </p>
          <DialogFooter>
            <Button type="submit">Save override</Button>
          </DialogFooter>
        </form>
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
