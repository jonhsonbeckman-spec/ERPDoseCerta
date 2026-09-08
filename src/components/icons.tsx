import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function make(nodes: ReactNode, displayName: string) {
  function Icon({ size = 18, ...rest }: IconProps) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8}
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
        {nodes}
      </svg>
    );
  }
  Icon.displayName = displayName;
  return Icon;
}

export const IcSyringe = make(<><path d="m18 2 4 4" /><path d="m17 7 3-3" /><path d="M19 9 8.7 19.3a2.4 2.4 0 0 1-3.4 0l-.6-.6a2.4 2.4 0 0 1 0-3.4L15 5" /><path d="m9 11 4 4" /><path d="m12 8 2 2" /><path d="m5 19-3 3" /></>, "IcSyringe");
export const IcGrid = make(<><rect x="3" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.8" /><rect x="3" y="13.5" width="7.5" height="7.5" rx="1.8" /><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.8" /></>, "IcGrid");
export const IcWallet = make(<><path d="M19 7V5.5A1.5 1.5 0 0 0 17.5 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2H5" /><path d="M16.2 13.5h.01" strokeWidth={2.6} /></>, "IcWallet");
export const IcBox = make(<><path d="M21 8.2 12 3 3 8.2v7.6L12 21l9-5.2Z" /><path d="m3.3 8.3 8.7 5 8.7-5" /><path d="M12 21v-7.7" /></>, "IcBox");
export const IcUsers = make(<><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.7-3.2 3.2-5 6.2-5s5.5 1.8 6.2 5" /><path d="M15.5 4.9a3.4 3.4 0 0 1 0 6.2" /><path d="M17.8 15.4c1.7.7 3 2.1 3.4 4.1" /></>, "IcUsers");
export const IcPlus = make(<path d="M12 5v14M5 12h14" />, "IcPlus");
export const IcMinus = make(<path d="M5 12h14" />, "IcMinus");
export const IcCheck = make(<path d="m4.5 12.5 5 5 10-11" />, "IcCheck");
export const IcX = make(<path d="m6 6 12 12M18 6 6 18" />, "IcX");
export const IcChevronL = make(<path d="m14.5 5.5-6.5 6.5 6.5 6.5" />, "IcChevronL");
export const IcChevronR = make(<path d="m9.5 5.5 6.5 6.5-6.5 6.5" />, "IcChevronR");
export const IcAlert = make(<><path d="M12 3.5 2.5 20h19L12 3.5Z" /><path d="M12 9.5v5" /><path d="M12 17.4h.01" strokeWidth={2.6} /></>, "IcAlert");
export const IcTrendUp = make(<><path d="m3 17 6-6 4 4 8-8" /><path d="M15 7h6v6" /></>, "IcTrendUp");
export const IcTrendDown = make(<><path d="m3 7 6 6 4-4 8 8" /><path d="M21 11v6h-6" /></>, "IcTrendDown");
export const IcCalendar = make(<><rect x="3" y="5" width="18" height="16" rx="2.5" /><path d="M8 3v4M16 3v4M3 10h18" /></>, "IcCalendar");
export const IcWhats = make(<><path d="M12 3.5a8.5 8.5 0 0 0-7.3 12.8L3.5 20.5l4.3-1.1A8.5 8.5 0 1 0 12 3.5Z" /><path d="M8.8 9.2c.3 2.6 3.4 5.7 6 6l1.3-1.3-2-1.4-1 .7c-.8-.4-1.9-1.5-2.3-2.3l.7-1-1.4-2-1.3 1.3Z" /></>, "IcWhats");
export const IcSearch = make(<><circle cx="10.5" cy="10.5" r="6.5" /><path d="m20 20-4.4-4.4" /></>, "IcSearch");
export const IcPencil = make(<><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17 4 20Z" /><path d="m14.5 7 3 3" /></>, "IcPencil");
export const IcTrash = make(<><path d="M4 7h16M9.5 7V4.5h5V7" /><path d="M6.5 7 7.5 20h9L17.5 7" /><path d="M10 11v5.5M14 11v5.5" /></>, "IcTrash");
export const IcRefresh = make(<><path d="M20 11a8 8 0 1 0-2.3 6.3" /><path d="M20 5v6h-6" /></>, "IcRefresh");
export const IcClock = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2.5" /></>, "IcClock");
export const IcClipboard = make(<><rect x="5" y="4" width="14" height="17" rx="2.5" /><path d="M9 4.5V3h6v1.5" /><path d="M9 10h6M9 14h6M9 18h3.5" /></>, "IcClipboard");
export const IcFlask = make(<><path d="M10 3h4M10.5 3v5.2L5 18.5A1.8 1.8 0 0 0 6.6 21h10.8a1.8 1.8 0 0 0 1.6-2.5L13.5 8.2V3" /><path d="M7.5 15h9" /></>, "IcFlask");
export const IcInfo = make(<><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5" /><path d="M12 7.6h.01" strokeWidth={2.6} /></>, "IcInfo");
export const IcTruck = make(<><path d="M2.5 6h11v10h-11zM13.5 9.5h4.2l3.3 3.5v3h-7.5" /><circle cx="6.5" cy="17.5" r="1.8" /><circle cx="17" cy="17.5" r="1.8" /></>, "IcTruck");
export const IcSnow = make(<><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9" /><path d="m9.8 4.2 2.2 1.8 2.2-1.8M9.8 19.8l2.2-1.8 2.2 1.8" /></>, "IcSnow");
export const IcLayers = make(<><path d="m12 3 9 4.8-9 4.8-9-4.8L12 3Z" /><path d="m3.5 12.5 8.5 4.5 8.5-4.5" /><path d="m3.5 16.5 8.5 4.5 8.5-4.5" /></>, "IcLayers");
export const IcCoins = make(<><ellipse cx="9" cy="7" rx="6" ry="3" /><path d="M3 7v5c0 1.7 2.7 3 6 3s6-1.3 6-3V7" /><path d="M3 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5" /><path d="M18 9.5c1.8.5 3 1.5 3 2.7v5c0 1.4-1.6 2.6-3.8 2.9" /></>, "IcCoins");
export const IcShieldAlert = make(<><path d="M12 3 5 5.8v5.4c0 4.4 3 8 7 9.8 4-1.8 7-5.4 7-9.8V5.8L12 3Z" /><path d="M12 8.5v4" /><path d="M12 15.4h.01" strokeWidth={2.6} /></>, "IcShieldAlert");
export const IcPercent = make(<><path d="M18.5 5.5l-13 13" /><circle cx="7.5" cy="7.5" r="2.3" /><circle cx="16.5" cy="16.5" r="2.3" /></>, "IcPercent");
export const IcTarget = make(<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4.5" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /></>, "IcTarget");
export const IcCart = make(<><path d="M3 4.5h2.2l2.3 11h11.2l2-8H6.2" /><circle cx="9" cy="19.5" r="1.4" /><circle cx="16.8" cy="19.5" r="1.4" /></>, "IcCart");
export const IcIdCard = make(<><rect x="3" y="5" width="18" height="14" rx="2.5" /><circle cx="8.5" cy="11" r="2" /><path d="M5.8 15.5c.5-1.2 1.5-1.8 2.7-1.8s2.2.6 2.7 1.8" /><path d="M14 9.5h4.5M14 12.5h4.5M14 15.5h3" /></>, "IcIdCard");
export const IcFileText = make(<><path d="M6 3h8l4 4v14H6V3Z" /><path d="M14 3v4h4" /><path d="M9 12h6M9 15.5h6M9 8.5h2.5" /></>, "IcFileText");
export const IcDownload = make(<><path d="M12 3.5v11M7.5 10 12 14.5 16.5 10" /><path d="M4 16.5v2A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-2" /></>, "IcDownload");
export const IcShare = make(<><path d="M12 3v12M8 6.5 12 3l4 3.5" /><path d="M8 10H6.5A2.5 2.5 0 0 0 4 12.5v6A2.5 2.5 0 0 0 6.5 21h11a2.5 2.5 0 0 0 2.5-2.5v-6A2.5 2.5 0 0 0 17.5 10H16" /></>, "IcShare");
export const IcSmartphone = make(<><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M10.5 18.5h3" /></>, "IcSmartphone");
export const IcMonitor = make(<><rect x="3" y="4" width="18" height="12.5" rx="2" /><path d="M9 20.5h6M12 16.5v4" /></>, "IcMonitor");
export const IcCopy = make(<><rect x="8.5" y="8.5" width="12" height="12" rx="2.5" /><path d="M5.5 15.5h-1a1.5 1.5 0 0 1-1.5-1.5V5a2 2 0 0 1 2-2h9a1.5 1.5 0 0 1 1.5 1.5v1" /></>, "IcCopy");
export const IcLogOut = make(<><path d="M9 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h4" /><path d="M15.5 16.5 20 12l-4.5-4.5" /><path d="M20 12H9" /></>, "IcLogOut");
