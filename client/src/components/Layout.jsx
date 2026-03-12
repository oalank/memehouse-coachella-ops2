import React from "react";
import { useLocation } from "react-router-dom";

export default function Layout({ children }) {
  const { pathname } = useLocation();
  const variant =
    pathname === "/projects"
      ? "projects"
      : pathname.startsWith("/p/")
        ? "dashboard"
        : null;
  const className = ["app-background", "dark", variant && `app-background--${variant}`]
    .filter(Boolean)
    .join(" ");

  return <div className={className}>{children}</div>;
}
