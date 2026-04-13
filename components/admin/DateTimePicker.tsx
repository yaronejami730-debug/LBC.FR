"use client";

import { useState, useRef, useEffect } from "react";

interface Props {
  name: string;
  label: string;
  defaultValue?: string; // ISO string
}

function daysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

const MONTHS = [
  "Janvier","Février","Mars","Avril","Mai","Juin",
  "Juillet","Août","Septembre","Octobre","Novembre","Décembre",
];
const DAYS = ["Lu","Ma","Me","Je","Ve","Sa","Di"];

export default function DateTimePicker({ name, label, defaultValue }: Props) {
  const now = new Date();
  const init = defaultValue ? new Date(defaultValue) : null;

  const [open, setOpen] = useState(false);
  const [year, setYear] = useState(init?.getFullYear() ?? now.getFullYear());
  const [month, setMonth] = useState(init?.getMonth() ?? now.getMonth());
  const [day, setDay] = useState(init?.getDate() ?? null as number | null);
  const [hours, setHours] = useState(init?.getHours() ?? 12);
  const [minutes, setMinutes] = useState(init?.getMinutes() ?? 0);
  const ref = useRef<HTMLDivElement>(null);

  // Fermer au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const value = day
    ? `${year}-${pad(month + 1)}-${pad(day)}T${pad(hours)}:${pad(minutes)}`
    : "";

  const display = day
    ? `${pad(day)} ${MONTHS[month]} ${year} à ${pad(hours)}h${pad(minutes)}`
    : "Choisir une date…";

  // Calcul du premier jour du mois (lundi = 0)
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7;
  const total = daysInMonth(year, month);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function clear() {
    setDay(null);
    setOpen(false);
  }

  return (
    <div className="relative" ref={ref}>
      <label className="text-[10px] font-semibold text-[#777683] uppercase tracking-wide block mb-1">{label}</label>

      {/* Hidden input for form submission */}
      <input type="hidden" name={name} value={value} />

      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${
          day
            ? "border-[#2f6fb8] bg-[#f0f5fd] text-[#2f6fb8] font-semibold"
            : "border-[#c7c5d4] bg-white text-[#777683]"
        }`}
      >
        <span className="material-symbols-outlined text-[16px]" style={{ fontVariationSettings: "'FILL' 1" }}>
          calendar_month
        </span>
        <span className="flex-1 truncate">{display}</span>
        {day && (
          <span
            onClick={(e) => { e.stopPropagation(); clear(); }}
            className="material-symbols-outlined text-[14px] text-[#777683] hover:text-[#ba1a1a] transition-colors"
          >
            close
          </span>
        )}
      </button>

      {/* Popover */}
      {open && (
        <div className="absolute z-50 mt-2 bg-white rounded-2xl shadow-2xl border border-[#eceef0] w-72 overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#eceef0]">
            <button type="button" onClick={prevMonth}
              className="w-8 h-8 rounded-full hover:bg-[#f2f4f6] flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[#464652]">chevron_left</span>
            </button>
            <span className="text-sm font-bold text-[#191c1e]">{MONTHS[month]} {year}</span>
            <button type="button" onClick={nextMonth}
              className="w-8 h-8 rounded-full hover:bg-[#f2f4f6] flex items-center justify-center transition-colors">
              <span className="material-symbols-outlined text-[18px] text-[#464652]">chevron_right</span>
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-3 pt-2">
            {DAYS.map(d => (
              <div key={d} className="text-center text-[10px] font-bold text-[#9ca3af] py-1">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7 px-3 pb-2">
            {Array.from({ length: firstDow }).map((_, i) => <div key={`e${i}`} />)}
            {Array.from({ length: total }).map((_, i) => {
              const d = i + 1;
              const isSelected = d === day;
              const isToday = d === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={`h-8 w-full rounded-full text-sm font-medium transition-all ${
                    isSelected
                      ? "bg-[#2f6fb8] text-white font-bold"
                      : isToday
                      ? "text-[#2f6fb8] font-bold ring-1 ring-[#2f6fb8]"
                      : "text-[#374151] hover:bg-[#f2f4f6]"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          {/* Time picker */}
          <div className="border-t border-[#eceef0] px-4 py-3">
            <p className="text-[10px] font-bold text-[#9ca3af] uppercase tracking-wide mb-2">Heure</p>
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-center">
                <button type="button" onClick={() => setHours(h => (h + 1) % 24)}
                  className="w-8 h-6 flex items-center justify-center hover:bg-[#f2f4f6] rounded transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-[#464652]">keyboard_arrow_up</span>
                </button>
                <span className="text-xl font-black text-[#191c1e] w-10 text-center">{pad(hours)}</span>
                <button type="button" onClick={() => setHours(h => (h + 23) % 24)}
                  className="w-8 h-6 flex items-center justify-center hover:bg-[#f2f4f6] rounded transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-[#464652]">keyboard_arrow_down</span>
                </button>
              </div>
              <span className="text-2xl font-black text-[#c7c5d4]">:</span>
              <div className="flex flex-col items-center">
                <button type="button" onClick={() => setMinutes(m => (m + 5) % 60)}
                  className="w-8 h-6 flex items-center justify-center hover:bg-[#f2f4f6] rounded transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-[#464652]">keyboard_arrow_up</span>
                </button>
                <span className="text-xl font-black text-[#191c1e] w-10 text-center">{pad(minutes)}</span>
                <button type="button" onClick={() => setMinutes(m => (m + 55) % 60)}
                  className="w-8 h-6 flex items-center justify-center hover:bg-[#f2f4f6] rounded transition-colors">
                  <span className="material-symbols-outlined text-[16px] text-[#464652]">keyboard_arrow_down</span>
                </button>
              </div>
            </div>
          </div>

          {/* Confirm */}
          <div className="px-4 pb-4">
            <button
              type="button"
              onClick={() => { if (day) setOpen(false); else setDay(now.getDate()); setOpen(false); }}
              className="w-full py-2.5 bg-[#2f6fb8] text-white text-sm font-bold rounded-xl hover:bg-[#1a5a9e] transition-colors"
            >
              Confirmer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
