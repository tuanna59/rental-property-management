"use client";

import { useId } from "react";
import type { BuildingVisualSpaceProjection } from "../../../domain/types";

export function SpaceInterior({
  space,
  variant,
}: {
  space: BuildingVisualSpaceProjection;
  variant: number;
}) {
  const id = useId().replaceAll(":", "");
  const rooftop = space.type === "ROOFTOP";
  const wide = space.type === "OWNER_HOME" || space.type === "GARAGE";
  return (
    <svg
      className="building-v2-interior"
      viewBox={rooftop ? "0 0 260 210" : wide ? "-70 0 380 210" : "10 0 230 210"}
      preserveAspectRatio={rooftop ? "xMidYMax meet" : "xMidYMid slice"}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}wall`} x2="0" y2="1">
          <stop stopColor="#faf4e9" />
          <stop offset=".65" stopColor="#ead8c1" />
          <stop offset="1" stopColor="#c8a985" />
        </linearGradient>
        <linearGradient id={`${id}side`} x2="1" y2="1">
          <stop stopColor="#b8b1a2" />
          <stop offset="1" stopColor="#817b70" />
        </linearGradient>
        <linearGradient id={`${id}floor`} x2="0" y2="1">
          <stop stopColor="#bba281" />
          <stop offset="1" stopColor="#8e765d" />
        </linearGradient>
        <linearGradient id={`${id}glass`} x2="1" y2="1">
          <stop stopColor="#8eb6be" />
          <stop offset=".48" stopColor="#e8f4f2" />
          <stop offset="1" stopColor="#789aa0" />
        </linearGradient>
        <radialGradient id={`${id}lamp`}>
          <stop stopColor="#fff1c8" stopOpacity=".95" />
          <stop offset="1" stopColor="#f3c66c" stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}shadow`} x="-30%" y="-30%" width="160%" height="180%">
          <feDropShadow dx="0" dy="4" stdDeviation="3" floodColor="#27372f" floodOpacity=".25" />
        </filter>
      </defs>
      {rooftop ? (
        <RooftopInterior />
      ) : (
        <>
          <path d="M0 0H240V210H0Z" fill="#6f6a61" />
          <path d="M20 18H220V157H20Z" fill={`url(#${id}wall)`} />
          <path d="M0 0L20 18V157L0 210Z" fill={`url(#${id}side)`} />
          <path d="M240 0L220 18V157L240 210Z" fill="#756f65" />
          <path d="M0 0H240L220 18H20Z" fill="#eeece5" />
          <path d="M0 210L20 157H220L240 210Z" fill={`url(#${id}floor)`} />
          {[169, 181, 193, 204].map((y) => (
            <path key={y} d={`M0 ${y}H240`} stroke="#624f3f" opacity=".18" />
          ))}
          {[35, 76, 117, 158, 199].map((x) => (
            <path key={x} d={`M${x} 157l${(x - 120) * 0.2} 53`} stroke="#f4e1c4" opacity=".24" />
          ))}
          <Window id={id} mirrored={variant === 1} />
          <Door mirrored={variant === 1} />
          <WallArt variant={variant} />
          <ellipse cx="120" cy="90" rx="104" ry="82" fill={`url(#${id}lamp)`} />
          <CeilingLight />
          {space.type === "GARAGE" ? (
            <GarageInterior />
          ) : space.type === "STORAGE" ? (
            <StorageInterior />
          ) : space.type === "ROOM" ? (
            <BedroomInterior variant={variant} shadowId={`${id}shadow`} />
          ) : space.type === "COMMON_AREA" ? (
            <CommonInterior />
          ) : (
            <LivingInterior owner={space.type === "OWNER_HOME"} />
          )}
          <ACUnit mirrored={variant === 2} />
          <g transform={variant === 2 ? "translate(188 122) scale(.46)" : "translate(20 124) scale(.46)"}>
            <Plant />
          </g>
          <path d="M0 0h8v210H0M232 0h8v210h-8" fill="#bdbdb5" />
          <path d="M8 0h3v210H8M229 0h3v210h-3" fill="#747a72" />
        </>
      )}
    </svg>
  );
}

function Window({ id, mirrored }: { id: string; mirrored: boolean }) {
  const x = mirrored ? 146 : 34;
  return (
    <g>
      <rect x={x} y="34" width="62" height="75" rx="1" fill="#77796f" />
      <rect x={x + 4} y="38" width="54" height="67" fill={`url(#${id}glass)`} />
      <path d={`M${x + 31} 38v67M${x + 4} 72h54`} stroke="#f7f6ef" strokeWidth="3" />
      <path d={`M${x - 4} 30v88h12V30M${x + 54} 30v88h12V30`} fill="#eee6d8" stroke="#c8baa4" strokeWidth="2" />
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
  const x = variant === 1 ? 112 : 116;
  return (
    <g>
      <rect x={x} y="48" width="29" height="37" fill="#79766d" />
      <rect x={x + 3} y="51" width="23" height="31" fill="#f2ede4" />
      <path d={`M${x + 6} 76l9-17 11 17`} fill={variant === 2 ? "#ad7968" : "#748e80"} />
    </g>
  );
}

function CeilingLight() {
  return (
    <g>
      <path d="M120 15v18" stroke="#696455" strokeWidth="1.6" />
      <path d="M105 34Q120 18 135 34l4 6h-38z" fill="#f8edcd" />
      <path d="M106 40h28" stroke="#fff6cb" strokeWidth="3" />
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

function BedroomInterior({ variant, shadowId }: { variant: number; shadowId: string }) {
  return (
    <g transform={variant === 1 ? "translate(240 0) scale(-1 1)" : undefined} filter={`url(#${shadowId})`}>
      <ellipse cx="105" cy="174" rx="65" ry="9" fill="#3c403a" opacity=".16" />
      <path d="M48 108h94v52H48z" fill="#7e6957" />
      <path d="M43 141l10-22h81l19 31v27H43z" fill="#ded6c5" />
      <path d="M43 151h110v21H43z" fill={variant === 2 ? "#a87764" : "#718f86"} />
      <path d="M53 128h33v13H49zM94 128h33l7 13H94z" fill="#fff9ec" />
      <path d="M50 176v7M145 176v7" stroke="#65594b" strokeWidth="5" />
      <rect x="158" y="129" width="42" height="8" fill="#725f4e" />
      <path d="M162 137v27M197 137v27" stroke="#6b5b49" strokeWidth="3" />
      <rect x="169" y="109" width="21" height="18" rx="1" fill="#56666a" />
      <path d="M178 127v3h-8" stroke="#62675f" strokeWidth="2" />
      <rect x="158" y="145" width="18" height="12" fill="#d5bea2" />
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
      <rect x="28" y="35" width="82" height="50" fill="#9ea9a3" />
      {[46, 59, 72].map((y) => <path key={y} d={`M31 ${y}h76`} stroke="#707b76" strokeWidth="2" />)}
      <g transform="translate(70 126)">
        <ellipse cx="48" cy="48" rx="65" ry="9" fill="#414b47" opacity=".23" />
        <circle cx="8" cy="38" r="14" fill="#36413f" />
        <circle cx="91" cy="38" r="14" fill="#36413f" />
        <circle cx="8" cy="38" r="7" fill="#b9bfba" />
        <circle cx="91" cy="38" r="7" fill="#b9bfba" />
        <path d="M-4 28L16 2h49l34 30H4Z" fill="#718d8f" />
        <path d="M24 4h35l20 21H11z" fill="#b7d0d3" opacity=".8" />
        <rect x="38" y="-8" width="7" height="5" rx="1" fill="#43504b" />
      </g>
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

function RooftopInterior() {
  return (
    <g>
      <path d="M3 181l31-47h190l31 47z" fill="#b8b8a7" />
      <path d="M28 136V62h94v74M23 63h104" fill="none" stroke="#86755c" strokeWidth="5" />
      {[38, 52, 66, 80, 94, 108].map((x) => <path key={x} d={`M${x} 59l12 15`} stroke="#a39477" strokeWidth="5" />)}
      <rect x="144" y="80" width="45" height="67" rx="9" fill="#a3b1ae" stroke="#607b77" strokeWidth="2" />
      {[90, 105, 122, 138].map((y) => <path key={y} d={`M145 ${y}h43`} stroke="#cbd5cf" strokeWidth="3" />)}
      <path d="M182 149l14-31h35l11 31z" fill="#526f73" stroke="#bec9c3" strokeWidth="3" />
      <path d="M192 133h43M214 120v30" stroke="#b1c8c4" />
      <g transform="translate(39 109) scale(.5)"><Plant /></g>
      <g transform="translate(99 111) scale(.43)"><Plant /></g>
      <path d="M8 154H247M8 178H247" stroke="#60716a" strokeWidth="3" />
      {Array.from({ length: 17 }, (_, i) => <path key={i} d={`M${10 + i * 14} 154v26`} stroke="#6b7c70" strokeWidth="1.5" />)}
    </g>
  );
}

function Plant() {
  return (
    <g>
      <path d="M34 74L32 14M33 52L12 29M33 43l23-26" stroke="#586d4a" strokeWidth="3" />
      <path d="M31 34Q7 31 8 8Q30 12 31 34M35 44Q39 18 61 15Q61 40 35 44M30 54Q4 57 0 35Q22 35 30 54M34 25Q21 2 38 0Q50 15 34 25" fill="#728963" />
      <path d="M19 65h30l-5 30H24z" fill="#999b83" />
      <path d="M19 65h30v5H19z" fill="#bbbd9e" />
    </g>
  );
}
