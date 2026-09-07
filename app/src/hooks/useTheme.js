import { useEffect, useMemo } from 'react';
import { useStore } from '../store';
import { makeTheme, applyThemeVars } from '../theme';

export const useTheme = () => {
  const hue = useStore((s) => s.hue);
  const sat = useStore((s) => s.sat);
  const light = useStore((s) => s.light);
  const dark = useStore((s) => s.dark);
  const bigText = useStore((s) => s.bigText);

  const theme = useMemo(() => makeTheme(hue, sat, light, dark), [hue, sat, light, dark]);

  useEffect(() => {
    applyThemeVars(theme, theme.accent);
    document.body.style.background = theme.bg;
    // "Larger text" in Settings. Every size in the app is set in px, so the
    // honest way to scale them together is the root font size plus a
    // multiplier the screens can read.
    document.documentElement.style.setProperty('--text-scale', bigText ? '1.12' : '1');
  }, [theme, bigText]);

  return {
    t: theme, accent: theme.accent, hue, sat, light, dark, bigText,
  };
};
