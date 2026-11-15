"use client";
import { useEffect } from "react";

/** 서비스 워커 등록(운영 빌드에서만). layout 에 <PwaRegister /> 한 번 넣는다 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
  }, []);
  return null;
}
