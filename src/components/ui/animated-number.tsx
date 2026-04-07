"use client";

import { useEffect, useRef } from "react";
import { useInView, useMotionValue, useTransform, animate, motion } from "framer-motion";
import { formatCurrency } from "@/lib/utils";

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  formatFn?: (n: number) => string;
  className?: string;
}

export function AnimatedNumber({
  value,
  duration = 0.8,
  formatFn = formatCurrency,
  className,
}: AnimatedNumberProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const display = useTransform(motionValue, (v) => formatFn(Math.round(v)));

  useEffect(() => {
    if (isInView) {
      animate(motionValue, value, { duration, ease: "easeOut" });
    }
  }, [isInView, value, motionValue, duration]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}
