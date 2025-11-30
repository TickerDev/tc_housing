import { useCallback, useEffect, useRef, useState } from 'react'
import { SideBar } from '../components/SideBar'
import { fetchNui } from '../lib/fetchNui'
import { isEnvBrowser } from '../isEnvWeb'

type OwnershipType = 'owner' | 'renter'

type MyApartmentUnit = {
  id: number
  name: string
  price: number
  rentPrice?: number
  ownershipType: OwnershipType
}

type MyApartmentsData = {
  id: number
  name: string
  units: MyApartmentUnit[]
}

export default function MyApartments({
  complexData,
  setDisplaying,
}: {
  complexData: MyApartmentsData
  setDisplaying: (val: any) => void
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearCloseTimeout = useCallback(() => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
  }, [])

  const finalizeSidebarClose = useCallback(() => {
    if (!isEnvBrowser()) {
      fetchNui('closeNui')
    }
    setDisplaying(null)
  }, [setDisplaying])

  const requestSidebarClose = useCallback(() => {
    setSidebarOpen(false)
    clearCloseTimeout()
    closeTimeoutRef.current = setTimeout(() => {
      finalizeSidebarClose()
    }, 320)
  }, [clearCloseTimeout, finalizeSidebarClose])

  const handleSidebarOpenChange = useCallback(
    (open: boolean) => {
      if (open) {
        clearCloseTimeout()
        setSidebarOpen(true)
      } else {
        requestSidebarClose()
      }
    },
    [clearCloseTimeout, requestSidebarClose],
  )

  useEffect(() => {
    return () => {
      clearCloseTimeout()
    }
  }, [clearCloseTimeout])

  useEffect(() => {
    if (!sidebarOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        requestSidebarClose()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [requestSidebarClose, sidebarOpen])

  const handleEnter = (unitId: number) => {
    if (!isEnvBrowser()) {
      fetchNui('enterApartment', { unitId })
    }
  }

  return (
    <SideBar
      open={sidebarOpen}
      onOpenChange={handleSidebarOpenChange}
      title={`Your apartments - ${complexData.name}`}
      className="w-[28rem]"
    >
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-sidebar-border pb-2">
          <h3 className="text-sm font-medium">Your Apartments</h3>
          <span className="text-xs text-sidebar-foreground/60">
            {complexData.units.length} unit{complexData.units.length === 1 ? '' : 's'}
          </span>
        </div>

        {complexData.units.length === 0 ? (
          <p className="text-xs text-sidebar-foreground/70">
            You do not own or rent any apartments in this complex.
          </p>
        ) : (
          <div className="space-y-2">
            {complexData.units.map((unit) => (
              <div
                key={unit.id}
                className="flex flex-col gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/10 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{unit.name}</span>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full border ${unit.ownershipType === 'owner'
                        ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400'
                        : 'border-sky-500/40 bg-sky-500/10 text-sky-400'
                      }`}
                  >
                    {unit.ownershipType === 'owner' ? 'Owner' : 'Renter'}
                  </span>
                </div>

                <div className="flex flex-col text-xs gap-1">
                  {unit.ownershipType === 'owner' && (
                    <span className="text-sidebar-foreground/70">You own this apartment.</span>
                  )}
                  {unit.ownershipType === 'renter' && unit.rentPrice !== undefined && unit.rentPrice > 0 && (
                    <span className="text-sidebar-foreground/70">
                      Rent: ${unit.rentPrice.toLocaleString()} / day
                    </span>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    onClick={() => handleEnter(unit.id)}
                    className="inline-flex items-center justify-center rounded-md bg-sidebar-primary px-3 py-1 text-xs font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                  >
                    Enter apartment
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </SideBar>
  )
}
