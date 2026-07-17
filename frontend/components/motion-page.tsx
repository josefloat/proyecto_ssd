"use client";

import { motion, useReducedMotion } from "framer-motion";

export function MotionPage({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.main
      className={className}
      initial={shouldReduceMotion ? false : { y: 8 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.main>
  );
}
