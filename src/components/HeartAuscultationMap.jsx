import React, { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const HEART_AUSCULTATION_AREAS = [
  {
    sequence: 1,
    id: "aortic",
    label: "Aortic",
    short: "2nd ICS · right sternal border",
    description: "2nd intercostal space at the patient's right sternal border.",
    left: 44.5,
    top: 36.8,
  },
  {
    sequence: 2,
    id: "pulmonic",
    label: "Pulmonic",
    short: "2nd ICS · left sternal border",
    description: "2nd intercostal space at the patient's left sternal border.",
    left: 51.7,
    top: 36.5,
  },
  {
    sequence: 3,
    id: "erbs-point",
    label: "Erb's Point",
    short: "3rd ICS · left sternal border",
    description: "3rd intercostal space at the patient's left sternal border.",
    left: 52.0,
    top: 44.0,
  },
  {
    sequence: 4,
    id: "tricuspid",
    label: "Tricuspid",
    short: "4th-5th ICS · lower left sternal border",
    description:
      "Lower left sternal border, typically around the 4th to 5th intercostal space.",
    left: 51.8,
    top: 52.8,
  },
  {
    sequence: 5,
    id: "mitral",
    label: "Mitral / Apex",
    short: "5th ICS · apex / left midclavicular line",
    description:
      "5th intercostal space at the cardiac apex near the left midclavicular line.",
    left: 60.3,
    top: 57.8,
  },
];

function Marker({ area, active, disabled, onClick }) {
  return (
    <button
      type="button"
      aria-label={area.label}
      aria-pressed={active}
      disabled={disabled}
      onClick={() => onClick(area)}
      className={[
        "absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full transition-transform duration-150 sm:h-8 sm:w-8",
        disabled ? "cursor-not-allowed opacity-75" : "hover:scale-105",
      ].join(" ")}
      style={{ left: `${area.left}%`, top: `${area.top}%` }}
    >
      {active ? (
        <span className="absolute h-5 w-5 rounded-full border border-sky-500/45 bg-sky-400/10" />
      ) : null}
      <span
        className="absolute translate-x-0.5 translate-y-0.5 rounded-full bg-slate-900/15"
        style={{ width: "12px", height: "12px" }}
      />
      <span className="relative flex items-center justify-center">
        <span
          className={[
            "relative rounded-full border border-[#16324f]",
            active ? "bg-[#0f1f47]" : "bg-[#46a7d9]",
          ].join(" ")}
          style={{ width: "12px", height: "12px" }}
        />
      </span>
    </button>
  );
}

function VectorFallback() {
  return (
    <svg viewBox="0 0 1024 880" className="h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="skin" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8ece8" />
          <stop offset="100%" stopColor="#efdcd5" />
        </linearGradient>
        <linearGradient id="bone" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#f3ead7" />
          <stop offset="100%" stopColor="#d8c6a8" />
        </linearGradient>
        <linearGradient id="cartilage" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#dfe8ef" />
          <stop offset="100%" stopColor="#b8c6d7" />
        </linearGradient>
        <radialGradient id="heartFill" cx="45%" cy="35%" r="70%">
          <stop offset="0%" stopColor="#ffd9c6" />
          <stop offset="55%" stopColor="#f29a8b" />
          <stop offset="100%" stopColor="#cc4334" />
        </radialGradient>
      </defs>

      <rect width="1024" height="880" fill="#f3f4f6" rx="28" />

      <path
        d="M294 120 C322 106, 368 98, 420 100 L470 108 C485 110, 503 102, 512 88
           L520 32 L532 32 L540 88 C549 102, 567 110, 582 108 L632 100
           C684 98, 730 106, 758 120 C818 150, 852 226, 860 294 L864 382
           L860 474 L842 566 C832 612, 824 654, 818 736 L792 736 C780 656, 756 584, 740 536
           C718 474, 698 438, 676 410 L624 338 C606 314, 580 300, 551 300 L521 300
           C492 300, 466 314, 448 338 L396 410 C374 438, 354 474, 332 536
           C316 584, 292 656, 280 736 L254 736 C248 654, 240 612, 230 566 L212 474
           L208 382 L212 294 C220 226, 254 150, 294 120 Z"
        fill="url(#skin)"
        opacity="0.95"
      />

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path
          d="M390 104 C428 82, 474 68, 526 68 C578 68, 624 82, 662 104"
          stroke="#d1b6ae"
          strokeWidth="3"
          opacity="0.7"
        />
        <path d="M528 18 L528 94" stroke="#d1b6ae" strokeWidth="3" opacity="0.6" />
        <path
          d="M294 204 C364 248, 432 266, 526 268 C620 266, 688 248, 758 204"
          stroke="#ccb1aa"
          strokeWidth="5"
          opacity="0.7"
        />
      </g>

      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M312 198 C366 176, 410 170, 462 172" stroke="url(#bone)" strokeWidth="16" />
        <path d="M740 198 C686 176, 642 170, 590 172" stroke="url(#bone)" strokeWidth="16" />
        <path d="M344 222 C400 212, 448 206, 522 208" stroke="url(#bone)" strokeWidth="12" />
        <path d="M708 222 C652 212, 604 206, 530 208" stroke="url(#bone)" strokeWidth="12" />
        <path d="M482 184 L528 184 L576 184" stroke="#dfd2bb" strokeWidth="14" />
        <path d="M528 184 L528 288" stroke="#d9ccb5" strokeWidth="16" />
      </g>

      <g fill="none" strokeLinecap="round">
        {[
          [396, 230, 276, 282, 272, 364, 302, 438],
          [420, 266, 298, 320, 296, 404, 322, 474],
          [446, 304, 320, 360, 318, 442, 344, 512],
          [474, 344, 348, 398, 346, 476, 370, 542],
          [500, 386, 380, 438, 374, 508, 394, 568],
        ].map((d, i) => (
          <path
            key={`left-rib-${i}`}
            d={`M ${d[0]} ${d[1]} C ${d[2]} ${d[3]}, ${d[4]} ${d[5]}, ${d[6]} ${d[7]}`}
            stroke="url(#bone)"
            strokeWidth="11"
          />
        ))}
        {[
          [658, 230, 778, 282, 782, 364, 752, 438],
          [634, 266, 756, 320, 758, 404, 732, 474],
          [608, 304, 734, 360, 736, 442, 710, 512],
          [580, 344, 706, 398, 708, 476, 684, 542],
          [554, 386, 674, 438, 680, 508, 660, 568],
        ].map((d, i) => (
          <path
            key={`right-rib-${i}`}
            d={`M ${d[0]} ${d[1]} C ${d[2]} ${d[3]}, ${d[4]} ${d[5]}, ${d[6]} ${d[7]}`}
            stroke="url(#bone)"
            strokeWidth="11"
          />
        ))}
      </g>

      <g fill="none" strokeLinecap="round">
        {[
          [468, 246, 424, 264],
          [450, 284, 404, 302],
          [432, 324, 384, 342],
          [414, 366, 364, 386],
          [398, 412, 346, 432],
          [588, 246, 632, 264],
          [606, 284, 652, 302],
          [624, 324, 672, 342],
          [642, 366, 692, 386],
          [658, 412, 710, 432],
        ].map(([x1, y1, x2, y2], i) => (
          <path
            key={`cart-${i}`}
            d={`M ${x1} ${y1} C ${(x1 + x2) / 2} ${y1 - 4}, ${(x1 + x2) / 2} ${y2 + 4}, ${x2} ${y2}`}
            stroke="url(#cartilage)"
            strokeWidth="10"
          />
        ))}
      </g>

      <path
        d="M518 262
           C494 274, 470 304, 460 340
           C448 384, 456 424, 478 462
           C502 502, 538 534, 584 552
           C618 566, 650 558, 676 536
           C702 514, 718 482, 720 446
           C722 406, 708 368, 686 342
           C666 318, 644 302, 640 278
           C630 234, 662 212, 664 186
           C636 194, 606 206, 588 228
           C564 206, 534 222, 518 262 Z"
        fill="url(#heartFill)"
        opacity="0.96"
      />

      <path
        d="M610 514 C634 506, 656 498, 674 480"
        stroke="#c51f1a"
        strokeWidth="24"
        strokeLinecap="round"
        opacity="0.85"
      />
      <path
        d="M554 296 C542 266, 554 228, 588 204"
        stroke="#b7624f"
        strokeWidth="8"
        strokeLinecap="round"
        opacity="0.55"
      />

      <line
        x1="614"
        y1="54"
        x2="614"
        y2="758"
        stroke="#111111"
        strokeWidth="4"
        strokeDasharray="8 8"
      />
    </svg>
  );
}

function ReferenceImageDiagram({ imageSrc, selectedArea, selectionLocked, onSelect }) {
  return (
    <div className="relative aspect-[1024/880] w-full overflow-hidden rounded-3xl bg-slate-100">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt="Cardiac auscultation reference"
          className="absolute inset-0 h-full w-full object-contain"
        />
      ) : (
        <div className="absolute inset-0">
          <VectorFallback />
        </div>
      )}

      {HEART_AUSCULTATION_AREAS.map((area) => (
        <Marker
          key={area.id}
          area={area}
          active={selectedArea.id === area.id}
          disabled={selectionLocked}
          onClick={onSelect}
        />
      ))}
    </div>
  );
}

export default function HeartAuscultationMap({
  onAreaClick,
  defaultSelectedId = "aortic",
  selectedAreaId,
  selectionLocked = false,
  referenceImageSrc = "",
}) {
  const isControlled = selectedAreaId !== undefined;
  const [internalSelectedId, setInternalSelectedId] = useState(defaultSelectedId);

  useEffect(() => {
    setInternalSelectedId(defaultSelectedId);
  }, [defaultSelectedId]);

  const selectedArea = useMemo(() => {
    const activeId = isControlled ? selectedAreaId : internalSelectedId;
    return (
      HEART_AUSCULTATION_AREAS.find((area) => area.id === activeId) ||
      HEART_AUSCULTATION_AREAS[0]
    );
  }, [internalSelectedId, isControlled, selectedAreaId]);

  const handleAreaClick = (area) => {
    if (!isControlled) {
      setInternalSelectedId(area.id);
    }

    if (onAreaClick) {
      onAreaClick(area);
    }
  };

  return (
    <Card className="overflow-hidden rounded-[30px] border border-white/70 bg-white/90 shadow-[0_24px_70px_-32px_rgba(15,23,42,0.35)] backdrop-blur-sm">
      <CardHeader className="border-b border-slate-200/80 pb-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-700">
              Placement Guide
            </p>
            <CardTitle className="mt-2 text-2xl text-slate-950">
              Cardiac Auscultation Landmarks
            </CardTitle>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Select a listening site, align the stethoscope head on the landmark,
              and capture the heart sound from the measurement console.
            </p>
          </div>
          <Badge variant="secondary" className="rounded-full px-3 py-1.5 text-xs">
            {HEART_AUSCULTATION_AREAS.length} standard sites
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 sm:p-6">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="rounded-[28px] border border-slate-200 bg-slate-50/90 p-3">
            <ReferenceImageDiagram
              imageSrc={referenceImageSrc}
              selectedArea={selectedArea}
              selectionLocked={selectionLocked}
              onSelect={handleAreaClick}
            />
          </div>

          <div className="space-y-4">
            <div className="rounded-[24px] border border-slate-200 bg-slate-50/75 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                Selected Site
              </p>
              <div className="mt-4 flex items-center gap-3">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-sky-100 text-sm font-semibold text-sky-800">
                  {selectedArea.sequence}
                </span>
                <div>
                  <h3 className="text-lg font-semibold text-slate-950">
                    {selectedArea.label}
                  </h3>
                  <p className="text-sm text-slate-600">{selectedArea.short}</p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-slate-600">
                {selectedArea.description}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5">
              <p className="text-sm font-semibold text-slate-800">Exam Sequence</p>
              <div className="mt-4 grid gap-2">
                {HEART_AUSCULTATION_AREAS.map((area) => (
                  <button
                    key={area.id}
                    type="button"
                    aria-pressed={selectedArea.id === area.id}
                    disabled={selectionLocked}
                    onClick={() => handleAreaClick(area)}
                    className={[
                      "flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors",
                      selectedArea.id === area.id
                        ? "border-sky-200 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50",
                      selectionLocked ? "cursor-not-allowed opacity-70" : "",
                    ].join(" ")}
                  >
                    <span className="flex items-center gap-3">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-semibold text-white">
                        {area.sequence}
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-slate-900">
                          {area.label}
                        </span>
                        <span className="block text-xs text-slate-500">
                          {area.short}
                        </span>
                      </span>
                    </span>
                    <Badge
                      variant={selectedArea.id === area.id ? "default" : "secondary"}
                      className="rounded-full px-2.5 py-1"
                    >
                      {selectedArea.id === area.id ? "Active" : "Ready"}
                    </Badge>
                  </button>
                ))}
              </div>
            </div>

            {selectionLocked ? (
              <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                Site selection is locked while recording. Stop the active capture
                before moving to another auscultation point.
              </div>
            ) : null}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
