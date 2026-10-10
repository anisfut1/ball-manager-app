import { createContext, useContext, useMemo, type ReactNode } from "react";
import { deriveClubAccent, type ClubAccent } from "./accent";

const ClubThemeContext = createContext<ClubAccent>(deriveClubAccent(null));

/** Accent du club actif (`club.accentColor`), repli Ball Manager. */
export function ClubThemeProvider({ accentColor, children }: { accentColor: string | null | undefined; children: ReactNode }) {
  const value = useMemo(() => deriveClubAccent(accentColor), [accentColor]);
  return <ClubThemeContext.Provider value={value}>{children}</ClubThemeContext.Provider>;
}

export function useClubAccent(): ClubAccent {
  return useContext(ClubThemeContext);
}
