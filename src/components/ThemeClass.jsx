"use client";

import { useLayoutEffect } from "react";

export function ThemeClass({ theme }) {
  useLayoutEffect(() => {
    if (!theme) return undefined;

    const classes = ["theme-reavers", "theme-dhg", "theme-dreadmasters", "theme-inquisitors", "theme-highranks", "theme-dark-council"];
    const previous = classes.filter(className => document.body.classList.contains(className));

    classes.forEach(className => document.body.classList.remove(className));
    document.body.classList.add(theme);

    return () => {
      document.body.classList.remove(theme);
      previous.forEach(className => document.body.classList.add(className));
    };
  }, [theme]);

  return null;
}
