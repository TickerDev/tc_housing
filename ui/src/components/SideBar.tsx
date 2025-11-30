import * as React from "react"
type SideBarProps = {
  open: boolean
  onOpenChange?: (open: boolean) => void
  closeOnBackdropClick?: boolean
  title?: string
  children: React.ReactNode
  className?: string
}

export function SideBar({
  open,
  onOpenChange,
  closeOnBackdropClick = true,
  title,
  children,
  className,
}: SideBarProps) {
  const handleClose = React.useCallback(() => {
    onOpenChange?.(false)
  }, [onOpenChange])

  const widthClasses = [
    "housing-sidebar",
    "w-[26rem]",
    "max-w-[95vw]",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <div
      className={[
        "fixed inset-0 z-50 flex justify-end dark",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      <div
        className={[
          "absolute inset-0 bg-transparent",
        ].join(" ")}
        onClick={closeOnBackdropClick ? handleClose : undefined}
      />

      <aside
        className={[
          "relative h-full bg-sidebar text-sidebar-foreground border-l border-sidebar-border shadow-lg",
          "flex flex-col",
          "sidebar-animate-in transition-transform duration-300 ease-out transform",
          open ? "translate-x-0" : "translate-x-full",
          widthClasses,
        ].join(" ")}
        aria-modal="true"
        role="dialog"
      >
        {title && (
          <header className="flex items-center justify-between px-4 py-3 border-b border-sidebar-border">
            <h2 className="text-sm font-medium select-none">{title}</h2>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-md p-2 text-sm hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
              onClick={handleClose}
            >
              <span className="sr-only">Close sidebar</span>
              ✕
            </button>
          </header>
        )}

        <div className="flex-1 overflow-y-auto p-4">{children}</div>

        <footer className="border-t border-sidebar-border px-4 py-2 text-[11px] text-sidebar-foreground/70 text-center select-none">
          © {new Date().getFullYear()} Ticker Development
        </footer>
      </aside>
    </div>
  )
}

export function useSideBarState(initialOpen = false) {
  const [open, setOpen] = React.useState(initialOpen)

  const openBar = React.useCallback(() => setOpen(true), [])
  const closeBar = React.useCallback(() => setOpen(false), [])
  const toggle = React.useCallback(() => setOpen((prev) => !prev), [])

  return { open, setOpen, openBar, closeBar, toggle }
}


