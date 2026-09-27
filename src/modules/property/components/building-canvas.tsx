"use client";

import { useId, type CSSProperties } from "react";
import { motion } from "motion/react";
import { Building2, CalendarDays, LogOut, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatCompactDate } from "@/lib/presentation";
import {
  SPACE_TYPE_LABELS,
  type DashboardFloor,
  type DashboardSpace,
} from "../domain/types";
import { FloorActions, FloorFormDialog } from "./property-forms";

type Selection = (id: string, target: HTMLButtonElement) => void;

function floorUnits(floor: DashboardFloor) {
  return floor.spaces.reduce((sum, space) => sum + spaceWeight(space), 0);
}

function spaceWeight(space: DashboardSpace) {
  return {
    ROOM: 1,
    OWNER_HOME: 1.6,
    GARAGE: 1.2,
    ROOFTOP: 1,
    COMMON_AREA: 1.35,
    STORAGE: 0.85,
    OTHER: 1,
  }[space.type];
}

export function BuildingCanvas({
  floors,
  propertyId,
  selectedId,
  onSelect,
  editing,
  search,
}: {
  floors: DashboardFloor[];
  propertyId: string;
  selectedId: string | null;
  onSelect: Selection;
  editing: boolean;
  search: string;
}) {
  if (!floors.length)
    return (
      <div className="empty-building">
        <Building2 size={40} />
        <h2>No floors configured</h2>
        <FloorFormDialog
          mode="create"
          propertyId={propertyId}
          trigger={
            <Button>
              <Plus />
              Add floor
            </Button>
          }
        />
      </div>
    );
  const widestFloor = Math.max(...floors.map(floorUnits), 1);
  const buildingWidth = Math.min(1020, Math.max(520, widestFloor * 205));
  return (
    <div className={cn("building-canvas", editing && "is-editing")}>
      <div className="distant-buildings" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </div>
      <div
        className="building-shell"
        style={{ "--building-width": `${buildingWidth}px` } as CSSProperties}
      >
        {floors.map((floor) => (
          <FloorVisual
            key={floor.id}
            floor={floor}
            propertyId={propertyId}
            selectedId={selectedId}
            onSelect={onSelect}
            editing={editing}
            search={search}
          />
        ))}
        <div className="building-foundation" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </div>
      <div className="landscape-left" aria-hidden="true">
        <PlantIllustration />
      </div>
      <div className="landscape-right" aria-hidden="true">
        <PlantIllustration />
      </div>
      <div className="building-ground" aria-hidden="true" />
    </div>
  );
}

function FloorVisual({
  floor,
  propertyId,
  selectedId,
  onSelect,
  editing,
  search,
}: {
  floor: DashboardFloor;
  propertyId: string;
  selectedId: string | null;
  onSelect: Selection;
  editing: boolean;
  search: string;
}) {
  const spaces = [...floor.spaces].sort((a, b) => a.sortOrder - b.sortOrder);
  const rooftop =
    spaces.length > 0 && spaces.every((space) => space.type === "ROOFTOP");
  const wrapSpaces = spaces.length > 6;
  const gridTemplateColumns =
    spaces.length > 0 && !wrapSpaces
      ? spaces.map((space) => `${spaceWeight(space)}fr`).join(" ")
      : undefined;
  return (
    <motion.section
      layout="position"
      transition={{ duration: 0.22 }}
      className={cn("floor-visual", rooftop && "roof-floor")}
      aria-label={floor.name}
      data-floor-id={floor.id}
    >
      <div className="floor-label">
        <h2>{floor.name}</h2>
        <span>
          {spaces.length} {spaces.length === 1 ? "space" : "spaces"}
        </span>
      </div>
      {editing && <FloorActions floor={floor} propertyId={propertyId} />}
      <div
        className={cn("floor-bays", wrapSpaces && "wrap-spaces")}
        style={{ gridTemplateColumns }}
      >
        {spaces.length ? (
          spaces.map((space) => (
            <SpaceVisual
              key={space.id}
              space={space}
              selected={selectedId === space.id}
              onSelect={onSelect}
              muted={
                Boolean(search) &&
                !space.name.toLowerCase().includes(search.toLowerCase())
              }
            />
          ))
        ) : (
          <div className="empty-floor">No spaces</div>
        )}
      </div>
      <div className="floor-slab" aria-hidden="true" />
    </motion.section>
  );
}

function SpaceVisual({
  space,
  selected,
  onSelect,
  muted,
}: {
  space: DashboardSpace;
  selected: boolean;
  onSelect: Selection;
  muted: boolean;
}) {
  // Stable IDs keep furnishings consistent across renames, refreshes, and reordering.
  const variant =
    Array.from(space.id).reduce(
      (hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0,
      0,
    ) % 3;
  return (
    <button
      type="button"
      className={cn(
        "space-visual",
        selected && "is-selected",
        muted && "is-muted",
        space.type === "ROOFTOP" && "roof-space",
      )}
      aria-label={`Select ${space.name}`}
      aria-pressed={selected}
      onClick={(event) => onSelect(space.id, event.currentTarget)}
      data-space-id={space.id}
      title={`${space.name} · ${SPACE_TYPE_LABELS[space.type]}`}
    >
      <RoomInterior type={space.type} variant={variant} />
      <span className="space-light" aria-hidden="true" />
      <SpaceOverlay
        name={space.name}
        room={space.type === "ROOM"}
        occupantCount={space.occupancy?.occupantCount}
        scheduledDate={
          space.occupancy?.moveOutDate ??
          space.upcomingOccupancy?.moveInDate ??
          undefined
        }
        scheduledKind={
          space.occupancy?.moveOutDate
            ? "move-out"
            : space.upcomingOccupancy
              ? "move-in"
              : undefined
        }
      />
    </button>
  );
}

function SpaceOverlay({
  name,
  room,
  occupantCount,
  scheduledDate,
  scheduledKind,
}: {
  name: string;
  room: boolean;
  occupantCount?: number;
  scheduledDate?: string;
  scheduledKind?: "move-in" | "move-out";
}) {
  const occupied = occupantCount !== undefined;
  const ScheduledIcon = scheduledKind === "move-out" ? LogOut : CalendarDays;
  return (
    <span className={cn("space-overlay", room && "rental-room-overlay")}>
      <span className="overlay-copy">
        <span className="overlay-heading">
          <strong>{name}</strong>
          {scheduledDate && scheduledKind && (
            <span className={cn("overlay-event", `event-${scheduledKind}`)}>
              <ScheduledIcon aria-hidden="true" />
              <span>{formatCompactDate(scheduledDate)}</span>
            </span>
          )}
        </span>
        {room && (
          <small
            className={cn(
              "overlay-status",
              occupied ? "status-occupied" : "status-available",
            )}
          >
            <i aria-hidden="true" />
            {occupied
              ? `${occupantCount} ${occupantCount === 1 ? "person" : "people"}`
              : "Available"}
          </small>
        )}
      </span>
    </span>
  );
}

function RoomInterior({
  type,
  variant,
}: {
  type: DashboardSpace["type"];
  variant: number;
}) {
  const id = useId().replaceAll(":", "");
  const rooftop = type === "ROOFTOP";
  const wide = type === "OWNER_HOME" || type === "GARAGE";
  return (
    <svg
      className="room-interior"
      viewBox={
        rooftop ? "0 0 240 200" : wide ? "-80 0 400 200" : "18 0 204 200"
      }
      preserveAspectRatio={rooftop ? "xMidYMax meet" : "xMidYMid slice"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id + "wall"} x2="0" y2="1">
          <stop stopColor="#f4e7d1" />
          <stop
            offset="1"
            stopColor={type === "GARAGE" ? "#b4beb9" : "#b89473"}
          />
        </linearGradient>
        <linearGradient id={id + "floor"} x2="0" y2="1">
          <stop stopColor="#a18f78" />
          <stop offset="1" stopColor="#d0b797" />
        </linearGradient>
        <radialGradient id={id + "light"}>
          <stop stopColor="#ffe6ad" stopOpacity=".9" />
          <stop offset="1" stopColor="#f5cf8c" stopOpacity=".08" />
        </radialGradient>
        <linearGradient id={id + "glass"} x2="1" y2="1">
          <stop stopColor="#a5c5c6" />
          <stop offset=".6" stopColor="#e4eeea" />
          <stop offset="1" stopColor="#8ca5a3" />
        </linearGradient>
      </defs>
      {rooftop ? (
        <RooftopInterior />
      ) : (
        <>
          {wide && (
            <g>
              <rect
                x="-80"
                width="400"
                height="200"
                fill={type === "GARAGE" ? "#aebbb3" : "#dec4a5"}
              />
              <path
                d="M-78 22h72v130h-72zM246 22h72v130h-72z"
                fill={type === "GARAGE" ? "#bfc9c1" : "#e9d2b1"}
                stroke="#978d78"
                strokeWidth="3"
              />
              <path
                d="M-76 152H-6M246 152h70"
                stroke="#8f816c"
                strokeWidth="4"
              />
            </g>
          )}
          <path d="M0 0H240V200H0Z" fill="#776e62" />
          <path d="M22 19H216V151H22Z" fill={`url(#${id}wall)`} />
          <path d="M0 0L22 19V151L0 200Z" fill="#a49b8b" />
          <path d="M240 0L216 19V151L240 200Z" fill="#80796d" />
          <path d="M0 0H240L216 19H22Z" fill="#dcd7c9" />
          <path d="M0 200L22 151H216L240 200Z" fill={`url(#${id}floor)`} />
          {[162, 178, 194].map((y) => (
            <path key={y} d={`M0 ${y}H240`} stroke="#86775f" opacity=".22" />
          ))}
          {[35, 90, 145, 200].map((x) => (
            <path
              key={x}
              d={`M${x} 151l${(x - 120) * 0.2} 49`}
              stroke="#f4e4c6"
              opacity=".3"
            />
          ))}
          <path d="M22 148H216" stroke="#8c8172" strokeWidth="4" />
          <g
            transform={
              variant === 1 ? "translate(240 0) scale(-1 1)" : undefined
            }
          >
            <rect x="34" y="36" width="61" height="72" fill="#827d71" />
            <rect
              x="38"
              y="40"
              width="53"
              height="64"
              fill={`url(#${id}glass)`}
            />
            <path d="M64 40V104M38 72H91" stroke="#f8f5ed" strokeWidth="3" />
            <path
              d="M30 32v84h12V32M89 32v84h12V32"
              fill="#eae2d0"
              stroke="#c8baa4"
              strokeWidth="2"
            />
            <rect x="165" y="40" width="35" height="108" fill="#88775f" />
            <rect x="169" y="44" width="27" height="104" fill="#b7a084" />
            <path
              d="M173 51h19v48h-19zM173 107h19v33h-19z"
              fill="none"
              stroke="#a18a70"
            />
            <circle cx="191" cy="104" r="2" fill="#e9d6aa" />
            <rect x="115" y="46" width="27" height="35" fill="#7c776b" />
            <rect x="118" y="49" width="21" height="29" fill="#efece1" />
            <path
              d="M121 73l8-15 10 15"
              fill={variant === 2 ? "#9c7061" : "#7c9683"}
            />
          </g>
          <ellipse
            cx="121"
            cy="87"
            rx="104"
            ry="85"
            fill={`url(#${id}light)`}
          />
          <path d="M120 15v17" stroke="#706957" strokeWidth="1.5" />
          <path d="M106 33Q120 19 134 33l3 5h-34z" fill="#f7edcf" />
          <path d="M107 38h26" stroke="#fff8d5" strokeWidth="3" />
          {type === "GARAGE" ? (
            <GarageInterior />
          ) : type === "STORAGE" ? (
            <StorageInterior />
          ) : type === "ROOM" ? (
            <BedroomInterior variant={variant} />
          ) : (
            <LivingInterior owner={type === "OWNER_HOME"} />
          )}
          <g
            transform={
              variant === 2
                ? "translate(183 115) scale(.52)"
                : "translate(16 115) scale(.52)"
            }
          >
            <Plant />
          </g>
          <path d="M0 0h7v200H0M233 0h7v200h-7" fill="#b6b5ad" />
          <path d="M7 0h3v200H7M230 0h3v200h-3" fill="#777e77" />
        </>
      )}
    </svg>
  );
}

function BedroomInterior({ variant }: { variant: number }) {
  return (
    <g transform={variant === 1 ? "translate(240 0) scale(-1 1)" : undefined}>
      <ellipse cx="105" cy="167" rx="64" ry="10" fill="#4f4b40" opacity=".18" />
      <path d="M50 104h91v49H50z" fill="#887461" />
      <path d="M46 137l9-20h78l18 30v25H46z" fill="#d8ceba" />
      <path
        d="M46 147h105v20H46z"
        fill={variant === 2 ? "#a47763" : "#738e86"}
      />
      <path d="M55 124h32v13H51zM94 124h32l7 13H94z" fill="#faf4e6" />
      <path d="M51 170v6M144 170v6" stroke="#655b4f" strokeWidth="5" />
      <rect x="157" y="125" width="40" height="8" fill="#786c58" />
      <path d="M161 133v25M194 133v25" stroke="#736752" strokeWidth="3" />
      <rect x="168" y="106" width="20" height="17" rx="1" fill="#59676a" />
      <path d="M177 123v3h-8" stroke="#62675f" strokeWidth="2" />
    </g>
  );
}

function LivingInterior({ owner }: { owner: boolean }) {
  return (
    <g>
      <path d="M54 162l114-1 22 23H36z" fill="#d6d0b7" />
      <rect
        x="41"
        y="111"
        width="114"
        height="40"
        rx="6"
        fill={owner ? "#879b8f" : "#99aaa4"}
      />
      <rect x="46" y="131" width="104" height="23" rx="4" fill="#c2cabb" />
      <rect x="37" y="123" width="14" height="33" rx="3" fill="#70897b" />
      <rect x="145" y="123" width="14" height="33" rx="3" fill="#70897b" />
      <path d="M62 115h22v21H62zM114 115h21v21h-21z" fill="#e5cf9e" />
      <ellipse cx="116" cy="163" rx="34" ry="10" fill="#8b7960" />
      <path d="M91 165v13M142 165v13" stroke="#77654f" strokeWidth="3" />
      <path d="M106 155h20v4h-20z" fill="#f7f2e7" />
      <path d="M184 83v69M174 152h20" stroke="#7f7966" strokeWidth="3" />
      <path d="M172 82h24l5 19h-34z" fill="#faf0cf" />
    </g>
  );
}

function GarageInterior() {
  return (
    <g>
      <rect x="30" y="33" width="79" height="48" fill="#a1aaa4" />
      {[43, 56, 69].map((y) => (
        <path key={y} d={`M33 ${y}h72`} stroke="#737e79" strokeWidth="2" />
      ))}
      {[48, 123, 185].map((x, i) => (
        <g key={x} transform={`translate(${x} 122) scale(.8)`}>
          <ellipse cx="0" cy="55" rx="30" ry="7" fill="#4d574f" opacity=".25" />
          <circle cx="-18" cy="39" r="12" fill="#394443" />
          <circle cx="23" cy="39" r="12" fill="#394443" />
          <circle cx="-18" cy="39" r="6" fill="#adb4ad" />
          <circle cx="23" cy="39" r="6" fill="#adb4ad" />
          <path
            d="M-25 30L-15 9H4L18 33H-18Z"
            fill={["#778e8d", "#b77764", "#c2c3b5"][i]}
          />
          <path d="M18 34l-5-37h-9M-16 9H3" stroke="#3f4b48" strokeWidth="5" />
          <rect x="8" y="-1" width="10" height="8" rx="3" fill="#efe4b6" />
        </g>
      ))}
    </g>
  );
}

function StorageInterior() {
  return (
    <g>
      <path
        d="M43 77v83M147 77v83M43 113h104M43 156h104"
        stroke="#69746b"
        strokeWidth="5"
      />
      {[48, 83, 118].map((x) => (
        <g key={x}>
          <rect x={x} y="85" width="27" height="26" fill="#b59d76" />
          <rect x={x} y="126" width="27" height="28" fill="#a6987a" />
          <path d={`M${x + 13} 85v26`} stroke="#dfcaaa" />
        </g>
      ))}
    </g>
  );
}

function RooftopInterior() {
  return (
    <g>
      <path d="M5 169l29-42h175l27 42z" fill="#b5b5a5" />
      <path
        d="M31 129V58h86v71M26 59h96"
        fill="none"
        stroke="#867459"
        strokeWidth="5"
      />
      {[39, 51, 63, 75, 87, 99, 111].map((x) => (
        <path key={x} d={`M${x} 55l12 15`} stroke="#a39477" strokeWidth="5" />
      ))}
      <rect
        x="136"
        y="78"
        width="39"
        height="61"
        rx="8"
        fill="#a1afac"
        stroke="#637e7a"
        strokeWidth="2"
      />
      {[87, 100, 117, 130].map((y) => (
        <path key={y} d={`M137 ${y}h37`} stroke="#c6d2cb" strokeWidth="3" />
      ))}
      <path
        d="M170 140l12-28h32l9 28z"
        fill="#536f73"
        stroke="#bec9c3"
        strokeWidth="3"
      />
      <path d="M178 126h40M198 114v26" stroke="#b1c8c4" />
      <g transform="translate(35 103) scale(.5)">
        <Plant />
      </g>
      <g transform="translate(94 106) scale(.43)">
        <Plant />
      </g>
      <path d="M9 143H230M9 166H230" stroke="#60716a" strokeWidth="3" />
      {Array.from({ length: 16 }, (_, i) => (
        <path
          key={i}
          d={`M${10 + i * 14} 143v25`}
          stroke="#6b7c70"
          strokeWidth="1.5"
        />
      ))}
    </g>
  );
}

function Plant() {
  return (
    <g>
      <path
        d="M34 74L32 14M33 52L12 29M33 43l23-26"
        stroke="#586d4a"
        strokeWidth="3"
      />
      <path
        d="M31 34Q7 31 8 8Q30 12 31 34M35 44Q39 18 61 15Q61 40 35 44M30 54Q4 57 0 35Q22 35 30 54M34 25Q21 2 38 0Q50 15 34 25"
        fill="#728963"
      />
      <path d="M19 65h30l-5 30H24z" fill="#999b83" />
      <path d="M19 65h30v5H19z" fill="#bbbd9e" />
    </g>
  );
}

function PlantIllustration() {
  return (
    <svg viewBox="0 0 70 110" aria-hidden="true">
      <Plant />
    </svg>
  );
}
