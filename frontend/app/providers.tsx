"use client";

import { MotionConfig } from "framer-motion";

export function AppMotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <MotionConfig reducedMotion="user" transition={{ duration: 0.24 }}>
      {children}
    </MotionConfig>
  );
}
