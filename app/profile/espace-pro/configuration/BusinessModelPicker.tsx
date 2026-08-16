"use client";

/**
 * « Que propose principalement votre entreprise ? »
 *
 * Trois cartes, pas un menu déroulant : le choix décide de tout ce que le
 * professionnel verra ensuite, il mérite d'occuper l'écran. Chaque carte porte
 * des exemples de métiers, parce qu'on se reconnaît dans « coiffure, massage,
 * dépannage » bien plus vite que dans « prestations de services ».
 *
 * Le vocabulaire reste celui du commerçant. Nulle part il n'est question de
 * « capacités », de « modèle d'activité » ni de « type de compte » : ce sont
 * nos mots, pas les siens. Il dit ce qu'il vend, le système en tire les
 * conséquences.
 *
 * Rien n'est verrouillé. Le choix se change dans la configuration, et chaque
 * section reste activable une par une — un salon qui se met à vendre du
 * shampoing coche « Stock », sans rien reprendre d'autre.
 */

import { useState } from "react";
import {
  BUSINESS_MODEL_OPTIONS,
  type BusinessModelChoice,
} from "@/lib/pro/business-model";

export default function BusinessModelPicker({
  value,
  onChange,
  disabled = false,
}: {
  value?: BusinessModelChoice | null;
  onChange: (choice: BusinessModelChoice) => void;
  disabled?: boolean;
}) {
  const [selected, setSelected] = useState<BusinessModelChoice | null>(value ?? null);

  function pick(choice: BusinessModelChoice) {
    if (disabled) return;
    setSelected(choice);
    onChange(choice);
  }

  return (
    <fieldset className="border-0 p-0 m-0" disabled={disabled}>
      <legend className="text-lg font-extrabold text-[#191c1e] mb-1.5">
        Que propose principalement votre entreprise&nbsp;?
      </legend>
      <p className="text-sm text-[#777683] mb-5">
        Cela nous sert à n&apos;afficher que les outils dont vous avez besoin. Vous pourrez
        le modifier à tout moment.
      </p>

      <div
        role="radiogroup"
        aria-label="Activité principale"
        className="grid gap-3 sm:grid-cols-3"
      >
        {BUSINESS_MODEL_OPTIONS.map((option) => {
          const active = selected === option.id;
          return (
            <button
              key={option.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => pick(option.id)}
              className={`text-left rounded-2xl border p-5 transition-all focus-visible:ring-2 focus-visible:ring-[#2f6fb8]/40 focus-visible:ring-offset-2 outline-none disabled:opacity-50 ${
                active
                  ? "border-[#2f6fb8] bg-[#2f6fb8]/[0.04] shadow-sm ring-1 ring-[#2f6fb8]/20"
                  : "border-[#eceef0] bg-white hover:border-[#c3cecd]"
              }`}
            >
              <span
                aria-hidden
                className={`material-symbols-outlined text-[26px] ${
                  active ? "text-[#2f6fb8]" : "text-[#8b9298]"
                }`}
                style={{ fontVariationSettings: active ? "'FILL' 1" : "'FILL' 0" }}
              >
                {option.icon}
              </span>

              <span className="block font-bold text-[#191c1e] mt-2.5 mb-1">{option.title}</span>
              <span className="block text-[13px] text-[#5a5b6e] leading-snug mb-2">
                {option.summary}
              </span>
              <span className="block text-[12px] text-[#9ea4a9] leading-snug">
                {option.examples}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
