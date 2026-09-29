"use client";

import { useId } from "react";
import type { BuildingVisualSpaceProjection } from "../../../domain/types";
import type { RoomSizeClass } from "../layout";

export function SpaceInterior({
  space,
  variant,
  roomSize,
}: {
  space: BuildingVisualSpaceProjection;
  variant: number;
  roomSize: RoomSizeClass;
}) {
  const id = useId().replaceAll(":", "");
  const rooftop = space.type === "ROOFTOP";
  const wide = space.type === "OWNER_HOME" || space.type === "GARAGE";

  if (rooftop) {
    return <RooftopTerraceInterior />;
  }

  return (
    <svg
      className="building-v2-interior"
      viewBox={wide ? "-70 0 380 210" : "10 0 230 210"}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}wall`} x2="0" y2="1">
          <stop stopColor="var(--building-wall-light, #fff8ed)" />
          <stop offset=".65" stopColor="var(--building-wall-mid, #ead8c1)" />
          <stop offset="1" stopColor="var(--building-wall-deep, #c8a985)" />
        </linearGradient>
        <linearGradient id={`${id}side`} x2="1" y2="1">
          <stop stopColor="var(--building-side-light, #b8b1a2)" />
          <stop offset="1" stopColor="var(--building-side-dark, #817b70)" />
        </linearGradient>
        <linearGradient id={`${id}floor`} x2="0" y2="1">
          <stop stopColor="var(--building-floor-light, #bba281)" />
          <stop offset="1" stopColor="var(--building-floor-dark, #8e765d)" />
        </linearGradient>
        <linearGradient id={`${id}glass`} x2="1" y2="1">
          <stop stopColor="var(--building-glass-dark, #8eb6be)" />
          <stop offset=".48" stopColor="var(--building-glass-light, #e8f4f2)" />
          <stop offset="1" stopColor="var(--building-glass-mid, #789aa0)" />
        </linearGradient>
        <radialGradient id={`${id}lamp`}>
          <stop stopColor="var(--building-lamp-core, #fff1c8)" stopOpacity=".96" />
          <stop offset="1" stopColor="var(--building-lamp-glow, #f3c66c)" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}shadow`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="var(--building-shadow-color, #27372f)" floodOpacity=".24" />
        </filter>
      </defs>

      <>
          <path d="M0 0H240V210H0Z" fill="var(--building-room-frame, #6f6a61)" />
          <path d="M20 18H220V157H20Z" fill={`url(#${id}wall)`} />
          <path d="M0 0L20 18V157L0 210Z" fill={`url(#${id}side)`} />
          <path d="M240 0L220 18V157L240 210Z" fill="var(--building-side-dark, #756f65)" />
          <path d="M0 0H240L220 18H20Z" fill="var(--building-ceiling, #eeece5)" />
          <path d="M0 210L20 157H220L240 210Z" fill={`url(#${id}floor)`} />
          {[169, 181, 193, 204].map((y) => (
            <path key={y} d={`M0 ${y}H240`} stroke="var(--building-floor-line, #624f3f)" opacity=".18" />
          ))}
          {[35, 76, 117, 158, 199].map((x) => (
            <path key={x} d={`M${x} 157l${(x - 120) * 0.2} 53`} stroke="var(--building-floor-highlight, #f4e1c4)" opacity=".24" />
          ))}
          <Window id={id} mirrored={variant === 1 || variant === 3} />
          <Door mirrored={variant === 1 || variant === 3} />
          <WallArt variant={variant} />
          <ellipse cx="120" cy="90" rx="104" ry="82" fill={`url(#${id}lamp)`} />
          <CeilingLight />
          {space.type === "GARAGE" ? (
            <GarageInterior />
          ) : space.type === "STORAGE" ? (
            <StorageInterior />
          ) : space.type === "ROOM" ? (
            <RentalRoomInterior variant={variant} sizeClass={roomSize} shadowId={`${id}shadow`} />
          ) : space.type === "COMMON_AREA" ? (
            <CommonInterior />
          ) : (
            <LivingInterior owner={space.type === "OWNER_HOME"} />
          )}
          {space.type !== "GARAGE" && <ACUnit mirrored={variant === 2 || variant === 3} />}
          {space.type !== "GARAGE" && !(space.type === "ROOM" && roomSize === "small") && (
            <g transform={variant === 2 ? "translate(188 122) scale(.46)" : variant === 3 ? "translate(102 126) scale(.42)" : "translate(20 124) scale(.46)"}>
              <Plant />
            </g>
          )}
          <path d="M0 0h8v210H0M232 0h8v210h-8" fill="var(--building-room-edge, #bdbdb5)" />
          <path d="M8 0h3v210H8M229 0h3v210h-3" fill="var(--building-room-edge-dark, #747a72)" />
      </>
    </svg>
  );
}

function Window({ id, mirrored }: { id: string; mirrored: boolean }) {
  const x = mirrored ? 146 : 34;
  return (
    <g>
      <rect x={x} y="34" width="62" height="75" rx="1" fill="var(--building-window-frame, #77796f)" />
      <rect x={x + 4} y="38" width="54" height="67" fill={`url(#${id}glass)`} />
      <path d={`M${x + 31} 38v67M${x + 4} 72h54`} stroke="var(--building-window-trim, #f7f6ef)" strokeWidth="3" />
      <path d={`M${x - 4} 30v88h12V30M${x + 54} 30v88h12V30`} fill="var(--building-curtain, #eee6d8)" stroke="#c8baa4" strokeWidth="2" />
      <path d={`M${x + 7} 43l18 0-18 22z`} fill="#ffffff" opacity=".2" />
    </g>
  );
}

function Door({ mirrored }: { mirrored: boolean }) {
  const x = mirrored ? 38 : 169;
  return (
    <g>
      <rect x={x} y="43" width="34" height="112" fill="#786955" />
      <rect x={x + 4} y="47" width="26" height="108" fill="#aa9275" />
      <path d={`M${x + 8} 54h18v49H${x + 8}zM${x + 8} 111h18v36H${x + 8}z`} fill="none" stroke="#92795f" />
      <circle cx={x + 25} cy="108" r="2" fill="#f1dba8" />
    </g>
  );
}

function WallArt({ variant }: { variant: number }) {
  const x = variant === 1 ? 112 : variant === 3 ? 101 : 116;
  const accent = ["#748e80", "#7b8ca0", "#ad7968", "#9a8764"][variant] ?? "#748e80";
  return (
    <g>
      <rect x={x} y="48" width="29" height="37" fill="#79766d" />
      <rect x={x + 3} y="51" width="23" height="31" fill="#f2ede4" />
      <path d={`M${x + 6} 76l9-17 11 17`} fill={accent} />
    </g>
  );
}

function CeilingLight() {
  return (
    <g>
      <path d="M120 15v18" stroke="#696455" strokeWidth="1.6" />
      <path d="M105 34Q120 18 135 34l4 6h-38z" fill="var(--building-fixture, #f8edcd)" />
      <path d="M106 40h28" stroke="var(--building-fixture-light, #fff6cb)" strokeWidth="3" />
    </g>
  );
}

function ACUnit({ mirrored }: { mirrored: boolean }) {
  const x = mirrored ? 32 : 151;
  return (
    <g transform={`translate(${x} 25)`}>
      <rect width="53" height="17" rx="3" fill="#eff1ed" stroke="#aeb8b0" />
      <path d="M6 12h41" stroke="#99aaa2" strokeWidth="2" />
      <circle cx="43" cy="6" r="1.5" fill="#4d8b72" />
    </g>
  );
}

function RentalRoomInterior({
  variant,
  sizeClass,
  shadowId,
}: {
  variant: number;
  sizeClass: RoomSizeClass;
  shadowId: string;
}) {
  const mirrored = variant === 1 || variant === 3;
  const accent = ["#718f86", "#7f8ea1", "#a87764", "#9d8a67"][variant] ?? "#718f86";
  const layout = roomFurnitureLayout(sizeClass, variant);

  return (
    <g
      transform={mirrored ? "translate(240 0) scale(-1 1)" : undefined}
      filter={`url(#${shadowId})`}
    >
      {layout.showRug && (
        <path
          d={`M${layout.bedX + 4} 178h${layout.bedWidth + 34}l15 13H${Math.max(8, layout.bedX - 10)}z`}
          fill={variant === 2 ? "#c6ad84" : "#b8aa8e"}
          opacity=".66"
        />
      )}

      <Kitchenette
        x={layout.kitchenX}
        y={layout.kitchenY}
        width={layout.kitchenWidth}
        showFridge={layout.showFridge}
        variant={variant}
      />

      <ellipse
        cx={layout.bedX + layout.bedWidth / 2}
        cy="176"
        rx={layout.bedWidth * 0.58}
        ry="7"
        fill="#3c403a"
        opacity=".14"
      />
      <rect
        x={layout.bedX}
        y="127"
        width={layout.bedWidth}
        height={layout.bedDepth}
        rx="2"
        fill="#7e6957"
      />
      <path
        d={`M${layout.bedX - 4} 147l8-18h${layout.bedWidth - 10}l15 20v25H${layout.bedX - 4}z`}
        fill="#ded6c5"
      />
      <rect
        x={layout.bedX - 4}
        y="151"
        width={layout.bedWidth + 9}
        height="19"
        rx="1"
        fill={accent}
      />
      <rect
        x={layout.bedX + 5}
        y="133"
        width={Math.max(22, layout.bedWidth * 0.36)}
        height="11"
        rx="3"
        fill="#fff9ec"
      />
      <path
        d={`M${layout.bedX + 2} 172v8M${layout.bedX + layout.bedWidth} 172v8`}
        stroke="#65594b"
        strokeWidth="4"
      />

      <Desk
        x={layout.deskX}
        y={132}
        width={layout.deskWidth}
        compact={sizeClass === "small"}
      />

      {layout.showStorage && (
        <g transform={`translate(${layout.storageX} 105)`}>
          <rect width={layout.storageWidth} height="64" rx="2" fill="#927d66" />
          <path d={`M${layout.storageWidth / 2} 4v56`} stroke="#7b6753" />
          <circle cx={layout.storageWidth * 0.4} cy="33" r="1.2" fill="#d8c49f" />
          <circle cx={layout.storageWidth * 0.6} cy="33" r="1.2" fill="#d8c49f" />
        </g>
      )}

      {layout.showWallShelf && (
        <g transform={`translate(${layout.wallShelfX} 91)`}>
          <rect width="38" height="4" rx="1" fill="#806a55" />
          <rect x="4" y="-12" width="8" height="12" fill="#b49a74" />
          <rect x="16" y="-15" width="7" height="15" fill="#778b82" />
          <circle cx="31" cy="-7" r="7" fill="#788f69" />
        </g>
      )}

      {layout.showDining && (
        <g transform={`translate(${layout.diningX} 154)`}>
          <ellipse cx="12" cy="4" rx="14" ry="5" fill="#8b7259" />
          <path d="M12 8v22M2 30h20" stroke="#715b47" strokeWidth="2.5" />
          <path d="M29 5v22M24 8h11M25 27h9" stroke="#6f6253" strokeWidth="2.2" />
        </g>
      )}
    </g>
  );
}

function roomFurnitureLayout(sizeClass: RoomSizeClass, variant: number) {
  const alternate = variant >= 2;

  if (sizeClass === "small") {
    return {
      bedX: alternate ? 55 : 24,
      bedWidth: 61,
      bedDepth: 29,
      deskX: alternate ? 22 : 94,
      deskWidth: 25,
      kitchenX: 139,
      kitchenY: 109,
      kitchenWidth: 43,
      showFridge: false,
      showStorage: false,
      storageX: 0,
      storageWidth: 0,
      showWallShelf: false,
      wallShelfX: 0,
      showDining: false,
      diningX: 0,
      showRug: false,
    };
  }

  if (sizeClass === "large") {
    return {
      bedX: alternate ? 60 : 20,
      bedWidth: 79,
      bedDepth: 32,
      deskX: alternate ? 20 : 105,
      deskWidth: 35,
      kitchenX: 148,
      kitchenY: 104,
      kitchenWidth: 61,
      showFridge: true,
      showStorage: false,
      storageX: 0,
      storageWidth: 0,
      showWallShelf: true,
      wallShelfX: alternate ? 95 : 101,
      showDining: false,
      diningX: 0,
      showRug: true,
    };
  }

  if (sizeClass === "xl") {
    return {
      bedX: alternate ? 61 : 14,
      bedWidth: 86,
      bedDepth: 33,
      deskX: alternate ? 15 : 108,
      deskWidth: 38,
      kitchenX: 146,
      kitchenY: 101,
      kitchenWidth: 65,
      showFridge: true,
      showStorage: false,
      storageX: 0,
      storageWidth: 0,
      showWallShelf: true,
      wallShelfX: alternate ? 99 : 103,
      showDining: false,
      diningX: 0,
      showRug: true,
    };
  }

  return {
    bedX: alternate ? 57 : 29,
    bedWidth: 70,
    bedDepth: 30,
    deskX: alternate ? 24 : 104,
    deskWidth: 30,
    kitchenX: 147,
    kitchenY: 107,
    kitchenWidth: 51,
    showFridge: false,
    showStorage: false,
    storageX: 0,
    storageWidth: 0,
    showWallShelf: true,
    wallShelfX: 102,
    showDining: false,
    diningX: 0,
    showRug: variant === 2,
  };
}

function Kitchenette({
  x,
  y,
  width,
  showFridge,
  variant,
}: {
  x: number;
  y: number;
  width: number;
  showFridge: boolean;
  variant: number;
}) {
  const cabinet = variant === 2 ? "#7d887d" : "#8b8374";
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="0" y="17" width={width} height="34" rx="2" fill={cabinet} />
      <rect x="0" y="14" width={width} height="5" rx="1" fill="#d8ccb5" />
      <path d={`M${width * 0.5} 19v30`} stroke="#6f6d63" strokeWidth="1.5" />
      <rect x={width * 0.12} y="8" width={width * 0.31} height="6" rx="2" fill="#738784" />
      <circle cx={width * 0.28} cy="11" r="1.3" fill="#d7e2dd" />
      <path
        d={`M${width * 0.64} 14v-6q0-6 6-6h2v3h-2q-3 0-3 3v6`}
        fill="none"
        stroke="#667773"
        strokeWidth="2"
      />
      {width >= 48 && (
        <g>
          <rect x="4" y="-10" width={Math.min(22, width * 0.4)} height="14" rx="1.5" fill="#a89d89" />
          <path d="M8 -3h14" stroke="#c8bda8" />
        </g>
      )}
      {showFridge && (
        <g transform={`translate(${width + 4} 10)`}>
          <rect width="22" height="42" rx="2" fill="#c2c8c3" stroke="#87938d" />
          <path d="M2 14h18M17 5v6" stroke="#77827d" strokeWidth="1.5" />
        </g>
      )}
    </g>
  );
}

function Desk({
  x,
  y,
  width,
  compact,
}: {
  x: number;
  y: number;
  width: number;
  compact: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={width} height="7" rx="1.5" fill="#725f4e" />
      <path d={`M4 7v${compact ? 24 : 29}M${width - 4} 7v${compact ? 24 : 29}`} stroke="#6b5b49" strokeWidth="3" />
      <rect x={width * 0.27} y="-17" width={width * 0.46} height="15" rx="1.5" fill="#56666a" />
      {!compact && <rect x={width * 0.12} y="13" width={width * 0.44} height="10" fill="#d5bea2" />}
    </g>
  );
}

function LivingInterior({ owner }: { owner: boolean }) {
  return (
    <g>
      <path d="M50 168l120-1 25 26H31z" fill="#d6d0b7" opacity=".92" />
      <rect x="40" y="116" width="118" height="42" rx="7" fill={owner ? "#7c9587" : "#96aaa3"} />
      <rect x="45" y="137" width="108" height="24" rx="4" fill="#c6d0c2" />
      <rect x="36" y="128" width="15" height="35" rx="4" fill="#6f887b" />
      <rect x="147" y="128" width="15" height="35" rx="4" fill="#6f887b" />
      <path d="M61 120h23v22H61zM115 120h22v22h-22z" fill="#e6d09f" />
      <ellipse cx="117" cy="170" rx="35" ry="10" fill="#88745b" />
      <path d="M91 172v14M143 172v14" stroke="#725f4d" strokeWidth="3" />
      <path d="M106 162h21v4h-21z" fill="#faf5e8" />
      <path d="M188 87v69M177 156h22" stroke="#77715f" strokeWidth="3" />
      <path d="M175 86h26l5 20h-36z" fill="#faf0cf" />
    </g>
  );
}

function CommonInterior() {
  return (
    <g>
      <rect x="45" y="125" width="50" height="28" rx="4" fill="#8ca097" />
      <rect x="145" y="125" width="50" height="28" rx="4" fill="#8ca097" />
      <ellipse cx="120" cy="162" rx="33" ry="12" fill="#9d8061" />
      <path d="M93 165v15M147 165v15" stroke="#715b45" strokeWidth="3" />
      <rect x="101" y="118" width="38" height="22" rx="2" fill="#d7cfbb" />
    </g>
  );
}

function GarageInterior() {
  return (
    <g>
      <rect x="28" y="36" width="70" height="66" rx="2" fill="#87918b" />
      {[52, 69, 86].map((y) => <path key={y} d={`M31 ${y}h64`} stroke="#68736d" strokeWidth="2" />)}
      <rect x="34" y="57" width="24" height="18" fill="#b9a17c" />
      <rect x="63" y="58" width="27" height="17" fill="#aa936f" />
      <path d="M36 42h15l3 9H33z" fill="#6e8079" />
      <circle cx="78" cy="47" r="8" fill="#d0b168" />
      <path d="M78 40v14M71 47h14" stroke="#715f41" strokeWidth="2" />
      <Scooter x={104} y={121} scale={0.78} accent="#758f91" />
      <Scooter x={171} y={131} scale={0.65} accent="#9c785f" mirrored />
      <path d="M13 153H229M13 166H229" stroke="#59635f" strokeWidth="3" opacity=".78" />
      {Array.from({ length: 12 }, (_, index) => <path key={index} d={`M${18 + index * 18} 153v15`} stroke="#65706a" strokeWidth="1.4" />)}
      <g transform="translate(202 102) scale(.33)"><Plant /></g>
    </g>
  );
}

function Scooter({ x, y, scale, accent, mirrored = false }: { x: number; y: number; scale: number; accent: string; mirrored?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${mirrored ? -scale : scale} ${scale})`}>
      <ellipse cx="0" cy="50" rx="62" ry="8" fill="#35423d" opacity=".18" />
      <circle cx="-36" cy="39" r="15" fill="#2f3835" /><circle cx="-36" cy="39" r="7" fill="#aeb5b1" />
      <circle cx="38" cy="39" r="15" fill="#2f3835" /><circle cx="38" cy="39" r="7" fill="#aeb5b1" />
      <path d="M-31 28l18-21h28l18 18 12 9H9l-13-7-19 6z" fill={accent} />
      <path d="M-10 4h31l12 10H-16z" fill="#384743" />
      <path d="M28 10l12-17M39-7l14 1" stroke="#394541" strokeWidth="4" strokeLinecap="round" />
      <path d="M-8 27l-7 20M16 26l8 21" stroke="#4b5651" strokeWidth="4" />
      <circle cx="47" cy="-7" r="5" fill="#d9e2dc" />
    </g>
  );
}

function StorageInterior() {
  return (
    <g>
      <path d="M43 80v88M151 80v88M43 117h108M43 162h108" stroke="#667168" strokeWidth="5" />
      {[50, 87, 124].map((x) => (
        <g key={x}>
          <rect x={x} y="89" width="29" height="26" fill="#b99f77" />
          <rect x={x} y="132" width="29" height="28" fill="#a59678" />
          <path d={`M${x + 14} 89v26`} stroke="#e1cba9" />
        </g>
      ))}
    </g>
  );
}

function RooftopTerraceInterior() {
  return (
    <div className="building-v2-rooftop-interior" aria-hidden="true">
      <div className="building-v2-rooftop-backdrop" />
      <div className="building-v2-rooftop-pergola">
        <span className="post post-a" />
        <span className="post post-b" />
        <span className="beam beam-a" />
        <span className="beam beam-b" />
        <span className="slats" />
      </div>

      <div className="building-v2-rooftop-zone rooftop-service-zone">
        <svg viewBox="0 0 150 110" preserveAspectRatio="xMidYMax meet">
          <ellipse cx="54" cy="19" rx="27" ry="10" fill="#d8e0df" stroke="#627a75" strokeWidth="2" />
          <rect x="27" y="19" width="54" height="54" rx="11" fill="#a6b7b3" stroke="#617873" strokeWidth="2" />
          <ellipse cx="54" cy="73" rx="26" ry="8" fill="#879d98" />
          <path d="M41 76v23M67 76v23" stroke="#61716c" strokeWidth="4" />
          <path d="M81 43h15v37h21" fill="none" stroke="#6d847e" strokeWidth="3" />
          <rect x="104" y="67" width="31" height="28" rx="4" fill="#87968d" />
          <circle cx="119" cy="67" r="8" fill="#71847a" />
          <path d="M8 96h135" stroke="#65776f" strokeWidth="3" opacity=".65" />
        </svg>
        <span className="rooftop-service-pipe" />
      </div>

      <div className="building-v2-rooftop-zone rooftop-domestic-zone">
        <svg viewBox="0 0 220 105" preserveAspectRatio="xMidYMax meet">
          <path d="M17 17v76M199 17v76M17 27h182" stroke="#6d684f" strokeWidth="4" />
          <path d="M31 18l18 10M53 18l18 10M75 18l18 10M97 18l18 10M119 18l18 10M141 18l18 10M163 18l18 10" stroke="#8b6b46" strokeWidth="4" />
          <path d="M48 55v38M169 55v38M48 61h121" stroke="#737667" strokeWidth="2.8" />
          <path d="M57 63h20v20H57z" fill="#d6c5ae" />
          <path d="M84 63h17v24H84z" fill="#8ea2a9" />
          <path d="M110 63h18v19h-18z" fill="#b47c6d" />
          <path d="M136 63h22v22h-22z" fill="#d6cbb6" />
          <rect x="77" y="88" width="64" height="5" rx="2" fill="#8b7a64" opacity=".85" />
        </svg>
        <span className="rooftop-pot pot-a" />
        <span className="rooftop-pot pot-b" />
      </div>

      <div className="building-v2-rooftop-zone rooftop-solar-zone">
        <svg viewBox="0 0 220 120" preserveAspectRatio="xMidYMax meet">
          <rect x="87" y="7" width="92" height="25" rx="13" fill="#c5ceca" stroke="#617872" strokeWidth="2" />
          <rect x="101" y="13" width="55" height="10" rx="5" fill="#e1e6e3" opacity=".75" />
          <g transform="translate(35 42) skewX(-14)">
            <rect width="155" height="52" rx="3" fill="#425f68" stroke="#b4c7c3" strokeWidth="2" />
            {[12, 28, 44, 60, 76, 92, 108, 124, 140].map((x) => (
              <path key={x} d={`M${x} 4v44`} stroke="#a8c0bd" strokeWidth="2.5" />
            ))}
            <path d="M0 18h155M0 35h155" stroke="#6e8c91" strokeWidth="1.5" opacity=".65" />
          </g>
          <path d="M51 92v22M176 92v22" stroke="#61716c" strokeWidth="4" />
          <path d="M180 28v61h22" fill="none" stroke="#70857f" strokeWidth="3" />
          <circle cx="200" cy="89" r="5" fill="var(--building-service-light, #f4d27f)" />
        </svg>
        <span className="rooftop-pot pot-c" />
      </div>

      <div className="building-v2-rooftop-parapet">
        {Array.from({ length: 26 }, (_, index) => <i key={index} />)}
      </div>
      <div className="building-v2-rooftop-slab" />
    </div>
  );
}

function Plant() {
  return (
    <g>
      <path d="M34 74L32 14M33 52L12 29M33 43l23-26" stroke="#586d4a" strokeWidth="3" />
      <path d="M31 34Q7 31 8 8Q30 12 31 34M35 44Q39 18 61 15Q61 40 35 44M30 54Q4 57 0 35Q22 35 30 54M34 25Q21 2 38 0Q50 15 34 25" fill="var(--building-plant, #728963)" />
      <path d="M19 65h30l-5 30H24z" fill="#999b83" />
      <path d="M19 65h30v5H19z" fill="#bbbd9e" />
    </g>
  );
}
