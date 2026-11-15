"use client";
// 다국어: 사전 6개 + 지금 언어(브라우저 저장) + useT().
// 큰 라이브러리 없이, 한국어 사전(ko.ts)의 키를 기준으로 타입을 맞춘다.
import { useMemo, useSyncExternalStore } from "react";
import { en } from "./en";
import { ko, type Dict, type Key } from "./ko";
import { ru } from "./ru";
import { th } from "./th";
import { vi } from "./vi";
import { zh } from "./zh";

export type { Key } from "./ko";
export type Lang = "ko" | "en" | "zh" | "th" | "vi" | "ru";

export const LANGS: { code: Lang; label: string; locale: string; html: string; fx?: string }[] = [
  { code: "ko", label: "한국어", locale: "ko-KR", html: "ko", fx: "KRW" },
  { code: "en", label: "English", locale: "en-US", html: "en" },
  { code: "zh", label: "简体中文", locale: "zh-CN", html: "zh-CN", fx: "CNY" },
  { code: "th", label: "ไทย", locale: "th-TH-u-ca-gregory", html: "th", fx: "THB" },
  { code: "vi", label: "Tiếng Việt", locale: "vi-VN", html: "vi", fx: "VND" },
  { code: "ru", label: "Русский", locale: "ru-RU", html: "ru", fx: "RUB" },
];

const DICTS: Record<Lang, Dict> = { ko, en, zh, th, vi, ru };
const CODES = LANGS.map((l) => l.code);
export const LANG_KEY = "moduwallet.lang.v1";
export const DEFAULT_LANG: Lang = "en";

/** 저장된 언어 → 브라우저 언어 → 영어 (layout 의 첫 화면용 스크립트와 같은 규칙) */
function detect(): Lang {
  try {
    const saved = localStorage.getItem(LANG_KEY) as Lang | null;
    if (saved && CODES.includes(saved)) return saved;
    for (const raw of navigator.languages?.length ? navigator.languages : [navigator.language]) {
      const two = (raw || "").toLowerCase().slice(0, 2) as Lang;
      if (CODES.includes(two)) return two;
    }
  } catch {
    // 저장소를 못 쓰면 기본 언어
  }
  return DEFAULT_LANG;
}

let current: Lang = DEFAULT_LANG;
let ready = false;
const listeners = new Set<() => void>();

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function snapshot(): Lang {
  if (!ready && typeof window !== "undefined") {
    current = detect();
    ready = true;
  }
  return current;
}

/** 오르면 빨강(한국·중국) / 오르면 초록(그 밖) */
export function toneOfLang(lang: Lang): "east" | "west" {
  return lang === "ko" || lang === "zh" ? "east" : "west";
}

/** <html lang> 과 색 규칙을 지금 언어에 맞춘다 */
export function applyHtml(lang: Lang) {
  const d = document.documentElement;
  d.lang = LANGS.find((l) => l.code === lang)?.html ?? lang;
  d.dataset.tone = toneOfLang(lang);
  d.classList.remove("i18n-wait");
}

export function setLang(lang: Lang) {
  current = lang;
  ready = true;
  try {
    localStorage.setItem(LANG_KEY, lang);
  } catch {
    // 저장을 못 해도 이번 화면에서는 바뀐다
  }
  applyHtml(lang);
  listeners.forEach((fn) => fn());
}

export function getLang(): Lang {
  return snapshot();
}

/** 날짜·숫자용 로캘(예: ko-KR) */
export function getLocale(): string {
  return LANGS.find((l) => l.code === snapshot())?.locale ?? "en-US";
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, snapshot, () => DEFAULT_LANG);
}

/** 받침에 맞는 조사 고르기: josa("애플", "이", "가") → "이" */
export function josa(word: string, withFinal: string, without: string): string {
  const w = word.replace(/[^0-9A-Za-z가-힣]/g, "");
  const ch = w.charAt(w.length - 1);
  if (!ch) return without;
  const code = ch.charCodeAt(0);
  let final: boolean;
  if (code >= 0xac00 && code <= 0xd7a3) final = (code - 0xac00) % 28 !== 0;
  else if (/[0-9]/.test(ch)) final = "013678".includes(ch); // 영 일 삼 육 칠 팔
  else final = "LMNRlmnr".includes(ch); // 엘 엠 엔 알
  return final ? withFinal : without;
}

export type Vars = Record<string, string | number>;

/** {name} 을 값으로 바꾼다. 한국어 사전의 {name|이|가} 는 받침에 맞는 조사를 붙인다 */
export function translate(lang: Lang, key: Key, vars?: Vars): string {
  const text = DICTS[lang][key] ?? en[key] ?? key;
  if (!text.includes("{")) return text;
  return text.replace(/\{(\w+)(?:\|([^|}]*)\|([^}]*))?\}/g, (_, name: string, a?: string, b?: string) => {
    const value = String(vars?.[name] ?? "");
    return a !== undefined && b !== undefined ? value + josa(value, a, b) : value;
  });
}

export type T = (key: Key, vars?: Vars) => string;

/** 화면에서 쓰는 번역 함수 */
export function useT(): T {
  const lang = useLang();
  return useMemo<T>(() => (key, vars) => translate(lang, key, vars), [lang]);
}

/** 종목 이름: 한국어에서만 한글 이름, 그 밖에는 영어 이름 */
export function displayName(lang: Lang, s: { symbol?: string; name?: string; nameKo?: string } | undefined, fallback = ""): string {
  if (!s) return fallback;
  return (lang === "ko" ? (s.nameKo ?? s.name) : s.name) ?? s.symbol ?? fallback;
}
