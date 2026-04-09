"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { normalizeYearMonthInput } from "../utils/movements-display";

const NONE = "__none__";

const MONTHS_ES = [
  { v: "01", label: "Enero" },
  { v: "02", label: "Febrero" },
  { v: "03", label: "Marzo" },
  { v: "04", label: "Abril" },
  { v: "05", label: "Mayo" },
  { v: "06", label: "Junio" },
  { v: "07", label: "Julio" },
  { v: "08", label: "Agosto" },
  { v: "09", label: "Septiembre" },
  { v: "10", label: "Octubre" },
  { v: "11", label: "Noviembre" },
  { v: "12", label: "Diciembre" },
] as const;

function parseYm(s: string): { y: string; m: string } {
  const m = /^(\d{4})-(\d{2})$/.exec(s.trim());
  if (!m) return { y: "", m: "" };
  return { y: m[1], m: m[2] };
}

type Props = {
  /** yyyy-mm o vacío */
  value: string;
  onChange: (ym: string) => void;
  disabled?: boolean;
  idYear: string;
  idMonth: string;
  /** Texto de la etiqueta del bloque (opcional) */
  groupLabel?: string;
};

/** Sustituye `<input type="month">` (años 2020 … actual + 5). */
export function MonthYearFilter({
  value,
  onChange,
  disabled,
  idYear,
  idMonth,
  groupLabel,
}: Props) {
  const { y, m } = parseYm(value);
  const now = new Date().getFullYear();
  const minYear = 2020;
  const years: number[] = [];
  for (let yr = minYear; yr <= now + 5; yr++) years.push(yr);

  return (
    <div className="space-y-2">
      {groupLabel ? (
        <p className="text-xs text-muted-foreground">{groupLabel}</p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <div className="min-w-[6.5rem] flex-1 space-y-1.5">
          <Label htmlFor={idYear} className="text-muted-foreground text-xs">
            Año
          </Label>
          <Select
            value={y || NONE}
            onValueChange={(v) => {
              if (v === NONE) {
                onChange("");
                return;
              }
              const mo = m || "01";
              onChange(normalizeYearMonthInput(`${v}-${mo}`));
            }}
            disabled={disabled}
            modal={false}
          >
            <SelectTrigger id={idYear} size="default" className="h-10 w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent align="start">
              <SelectItem value={NONE}>Todos</SelectItem>
              {years.map((yr) => (
                <SelectItem key={yr} value={String(yr)}>
                  {yr}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-[9rem] flex-1 space-y-1.5">
          <Label htmlFor={idMonth} className="text-muted-foreground text-xs">
            Mes
          </Label>
          <Select
            value={m || NONE}
            onValueChange={(v) => {
              if (v === NONE) {
                onChange("");
                return;
              }
              if (!y) return;
              onChange(normalizeYearMonthInput(`${y}-${v}`));
            }}
            disabled={disabled || !y}
            modal={false}
          >
            <SelectTrigger id={idMonth} size="default" className="h-10 w-full">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent align="start" className="max-h-[min(280px,50vh)]">
              <SelectItem value={NONE}>Todos</SelectItem>
              {MONTHS_ES.map((item) => (
                <SelectItem key={item.v} value={item.v}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
