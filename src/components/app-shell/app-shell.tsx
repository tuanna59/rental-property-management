"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Home,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  X,
} from "lucide-react";

import { PropertyFormDialog } from "@/modules/property/components/property-forms";
import type { PropertyShellProjection } from "@/modules/property/domain/types";
import {
  appNavigation,
  isNavigationHrefActive,
  type AppNavigationItem,
} from "./navigation";
import "./app-shell.css";

const sidebarEvent = "rental-house:sidebar";
const sidebarStorageKey = "rental-house:sidebar-collapsed";

function subscribeSidebar(callback: () => void) {
  const notify = () => {
    document.documentElement.dataset.sidebarCollapsed = String(
      sidebarSnapshot(),
    );
    callback();
  };
  window.addEventListener("storage", notify);
  window.addEventListener(sidebarEvent, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(sidebarEvent, notify);
  };
}

function sidebarSnapshot() {
  return window.localStorage.getItem(sidebarStorageKey) === "true";
}

function useSidebarCollapsed() {
  const collapsed = React.useSyncExternalStore(
    subscribeSidebar,
    sidebarSnapshot,
    () => false,
  );

  const setCollapsed = React.useCallback((value: boolean) => {
    window.localStorage.setItem(sidebarStorageKey, String(value));
    document.documentElement.dataset.sidebarCollapsed = String(value);
    window.dispatchEvent(new Event(sidebarEvent));
  }, []);

  return [collapsed, setCollapsed] as const;
}

function groupContainsPath(item: AppNavigationItem, pathname: string) {
  return Boolean(
    item.children?.some((child) =>
      isNavigationHrefActive(pathname, child.href),
    ),
  );
}

function initialOpenGroups(pathname: string) {
  return Object.fromEntries(
    appNavigation
      .filter((item) => item.children)
      .map((item) => [item.label, groupContainsPath(item, pathname)]),
  ) as Record<string, boolean>;
}

export function AppShell({
  property,
  children,
}: {
  property: PropertyShellProjection;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useSidebarCollapsed();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [openGroups, setOpenGroups] = React.useState<Record<string, boolean>>(
    () => initialOpenGroups(pathname),
  );
  const [flyout, setFlyout] = React.useState<string | null>(null);
  const mobileTriggerRef = React.useRef<HTMLButtonElement>(null);

  React.useEffect(() => {
    const activeParents = appNavigation.filter(
      (item) => item.children && groupContainsPath(item, pathname),
    );
    if (activeParents.length) {
      setOpenGroups((current) => {
        const next = { ...current };
        for (const item of activeParents) next[item.label] = true;
        return next;
      });
    }
    setMobileOpen(false);
    setFlyout(null);
  }, [pathname]);

  React.useEffect(() => {
    if (!flyout) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFlyout(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [flyout]);

  React.useEffect(() => {
    if (!mobileOpen) return;
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLButtonElement>(
          ".app-sidebar.is-mobile .app-sidebar-icon-button",
        )
        ?.focus();
    });
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        requestAnimationFrame(() => mobileTriggerRef.current?.focus());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const toggleGroup = React.useCallback(
    (label: string) => {
      const item = appNavigation.find((entry) => entry.label === label);
      const isActiveParent = Boolean(item && groupContainsPath(item, pathname));
      setOpenGroups((current) => ({
        ...current,
        [label]: isActiveParent ? true : !current[label],
      }));
    },
    [pathname],
  );

  return (
    <div className={`app-shell${collapsed ? " is-collapsed" : ""}`}>
      <AppSidebar
        property={property}
        collapsed={collapsed}
        openGroups={openGroups}
        flyout={flyout}
        onFlyoutChange={setFlyout}
        onGroupToggle={toggleGroup}
        onCollapsedChange={setCollapsed}
      />

      {mobileOpen && (
        <div className="app-shell-mobile-layer">
          <button
            type="button"
            className="app-shell-mobile-backdrop"
            aria-label="Close navigation"
            onClick={() => setMobileOpen(false)}
          />
          <AppSidebar
            property={property}
            collapsed={false}
            mobile
            openGroups={openGroups}
            flyout={null}
            onFlyoutChange={() => undefined}
            onGroupToggle={toggleGroup}
            onClose={() => setMobileOpen(false)}
          />
        </div>
      )}

      <div className="app-shell-main">
        <div className="app-shell-mobile-bar">
          <button
            ref={mobileTriggerRef}
            type="button"
            className="app-shell-mobile-trigger"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
          >
            <Menu aria-hidden="true" />
          </button>
          <span>My Rental Property</span>
        </div>
        <div className="app-shell-content">{children}</div>
      </div>
    </div>
  );
}

function AppSidebar({
  property,
  collapsed,
  mobile = false,
  openGroups,
  flyout,
  onFlyoutChange,
  onGroupToggle,
  onCollapsedChange,
  onClose,
}: {
  property: PropertyShellProjection;
  collapsed: boolean;
  mobile?: boolean;
  openGroups: Record<string, boolean>;
  flyout: string | null;
  onFlyoutChange: (label: string | null) => void;
  onGroupToggle: (label: string) => void;
  onCollapsedChange?: (collapsed: boolean) => void;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      className={`app-sidebar${mobile ? " is-mobile" : " app-sidebar-desktop"}`}
      aria-label="Application navigation"
      role={mobile ? "dialog" : undefined}
      aria-modal={mobile ? "true" : undefined}
    >
      <div className="app-sidebar-brand">
        <Link
          href="/building"
          className="app-sidebar-brand-link"
          aria-label="My Rental Property"
          title={collapsed ? "My Rental Property" : undefined}
          onClick={onClose}
        >
          <Home aria-hidden="true" />
          <span>My Rental Property</span>
        </Link>
        {mobile && (
          <button
            type="button"
            className="app-sidebar-icon-button"
            aria-label="Close navigation"
            onClick={onClose}
          >
            <X aria-hidden="true" />
          </button>
        )}
      </div>

      <nav className="app-sidebar-navigation">
        {appNavigation.map((item) => {
          const Icon = item.icon;
          const active = item.href
            ? isNavigationHrefActive(pathname, item.href)
            : groupContainsPath(item, pathname);

          if (item.href) {
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`app-sidebar-item${active ? " is-active" : ""}`}
                aria-current={active ? "page" : undefined}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onClick={onClose}
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
              </Link>
            );
          }

          const expanded = Boolean(openGroups[item.label]);
          const flyoutOpen = collapsed && flyout === item.label;
          return (
            <div
              key={item.label}
              className="app-sidebar-parent-wrap"
              onMouseEnter={() => collapsed && onFlyoutChange(item.label)}
              onMouseLeave={() => collapsed && onFlyoutChange(null)}
              onBlur={(event) => {
                if (
                  collapsed &&
                  !event.currentTarget.contains(event.relatedTarget as Node)
                ) {
                  onFlyoutChange(null);
                }
              }}
            >
              <button
                type="button"
                className={`app-sidebar-item app-sidebar-parent${active ? " is-contextual" : ""}`}
                aria-expanded={collapsed ? flyoutOpen : expanded}
                aria-label={collapsed ? item.label : undefined}
                title={collapsed ? item.label : undefined}
                onFocus={() => collapsed && onFlyoutChange(item.label)}
                onClick={() =>
                  collapsed
                    ? onFlyoutChange(flyoutOpen ? null : item.label)
                    : onGroupToggle(item.label)
                }
              >
                <Icon aria-hidden="true" />
                <span>{item.label}</span>
                {!collapsed && (
                  <ChevronDown
                    aria-hidden="true"
                    className={expanded ? "rotate-180" : ""}
                  />
                )}
              </button>

              {!collapsed && expanded && (
                <div className="app-sidebar-children">
                  {item.children?.map((child) => {
                    const childActive = isNavigationHrefActive(
                      pathname,
                      child.href,
                    );
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`app-sidebar-child${childActive ? " is-active" : ""}`}
                        aria-current={childActive ? "page" : undefined}
                        onClick={onClose}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}

              {collapsed && flyoutOpen && (
                <div className="app-sidebar-flyout" role="menu">
                  <strong>{item.label}</strong>
                  <div />
                  {item.children?.map((child) => {
                    const childActive = isNavigationHrefActive(
                      pathname,
                      child.href,
                    );
                    return (
                      <Link
                        key={child.href}
                        href={child.href}
                        role="menuitem"
                        className={childActive ? "is-active" : undefined}
                        aria-current={childActive ? "page" : undefined}
                        onClick={() => {
                          onFlyoutChange(null);
                          onClose?.();
                        }}
                      >
                        {child.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <PropertyFormDialog
          property={property}
          trigger={
            <button
              type="button"
              className="app-sidebar-item"
              aria-label={collapsed ? "Property settings" : undefined}
              title={collapsed ? "Property settings" : undefined}
            >
              <Settings aria-hidden="true" />
              <span>Property settings</span>
            </button>
          }
        />
        {!mobile && (
          <button
            type="button"
            className="app-sidebar-collapse"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : undefined}
            onClick={() => onCollapsedChange?.(!collapsed)}
          >
            {collapsed ? (
              <PanelLeftOpen aria-hidden="true" />
            ) : (
              <PanelLeftClose aria-hidden="true" />
            )}
            <span>{collapsed ? "Expand" : "Collapse"}</span>
          </button>
        )}
      </div>
    </aside>
  );
}
