import { useCallback, useEffect, useRef, useState } from 'react'
import { SideBar } from '../components/SideBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RentDialog } from '../components/RentDialog'
import { fetchNui } from '../lib/fetchNui'
import { isEnvBrowser } from '../isEnvWeb'

type UnitStatus = 'owned' | 'rented' | 'available'

type ApartmentUnit = {
    id: number
    name: string
    price: number
    rentPrice?: number
    status: UnitStatus
    isRentable: boolean
}

type ApartmentComplexData = {
    id: number
    name: string
    units: ApartmentUnit[]
}

export default function ApartmentComplex({
    complexData,
    setDisplaying
}: {
    complexData: ApartmentComplexData,
    setDisplaying: (val: any) => void
}) {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean
        unitId: number | null
        mode: 'buy' | 'rent' | null
        unitName: string
        price: number
        rentPrice?: number
    }>({ open: false, unitId: null, mode: null, unitName: '', price: 0 })
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

    const handleSidebarOpenChange = useCallback((open: boolean) => {
        if (open) {
            clearCloseTimeout()
            setSidebarOpen(true)
        } else {
            requestSidebarClose()
        }
    }, [clearCloseTimeout, requestSidebarClose])

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

    const handleAction = (unitId: number, mode: 'buy' | 'rent', unitName: string, price: number, rentPrice?: number) => {
        setConfirmDialog({ open: true, unitId, mode, unitName, price, rentPrice })
    }

    const handleConfirm = (days?: number) => {
        if (!confirmDialog.unitId || !confirmDialog.mode) return

        if (!isEnvBrowser()) {
            fetchNui('buyApartment', {
                unitId: confirmDialog.unitId,
                paymentMethod: 'bank',
                mode: confirmDialog.mode,
                days: days
            })
        }
        setConfirmDialog({ open: false, unitId: null, mode: null, unitName: '', price: 0 })
    }

    const handleCancel = () => {
        setConfirmDialog({ open: false, unitId: null, mode: null, unitName: '', price: 0 })
    }

    return (
        <SideBar
            open={sidebarOpen}
            onOpenChange={handleSidebarOpenChange}
            title={complexData.name}
            className="w-[30rem]"
        >
            <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-sidebar-border pb-2">
                    <h3 className="text-sm font-medium">Available Apartments</h3>
                    <span className="text-xs text-sidebar-foreground/60">
                        {complexData.units.length} units
                    </span>
                </div>

                <div className="space-y-2">
                    {complexData.units.map((unit) => (
                        <div
                            key={unit.id}
                            className="flex flex-col gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/10 p-3"
                        >
                            <div className="flex items-center justify-between">
                                <span className="font-medium text-sm">{unit.name}</span>
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border ${unit.status === 'available'
                                    ? 'border-green-500/30 bg-green-500/10 text-green-500'
                                    : 'border-red-500/30 bg-red-500/10 text-red-500'
                                    }`}>
                                    {unit.status.toUpperCase()}
                                </span>
                            </div>

                            <div className="flex flex-col gap-1 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-sidebar-foreground/70">
                                        Buy: ${unit.price.toLocaleString()}
                                    </span>
                                    {unit.status === 'available' &&
                                        unit.isRentable &&
                                        unit.rentPrice !== undefined &&
                                        unit.rentPrice > 0 && (
                                            <span className="text-sidebar-foreground/70">
                                                Rent: ${unit.rentPrice.toLocaleString()} / day
                                            </span>
                                        )}
                                </div>

                                {unit.status === 'available' && (
                                    <div className="flex gap-2 justify-end pt-1">
                                        <button
                                            onClick={() => handleAction(unit.id, 'buy', unit.name, unit.price)}
                                            className="rounded bg-sidebar-primary px-3 py-1 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                                        >
                                            Buy
                                        </button>
                                        {unit.isRentable && unit.rentPrice !== undefined && unit.rentPrice > 0 && (
                                            <button
                                                onClick={() => handleAction(unit.id, 'rent', unit.name, unit.price, unit.rentPrice)}
                                                className="rounded border border-sidebar-border px-3 py-1 text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors"
                                            >
                                                Rent
                                            </button>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {confirmDialog.mode === 'rent' ? (
                <RentDialog
                    open={confirmDialog.open}
                    title="Rent Apartment"
                    unitName={confirmDialog.unitName}
                    rentPrice={confirmDialog.rentPrice || 0}
                    onConfirm={(days) => handleConfirm(days)}
                    onCancel={handleCancel}
                />
            ) : (
                <ConfirmDialog
                    open={confirmDialog.open}
                    title="Confirm Purchase"
                    message={`Are you sure you want to buy ${confirmDialog.unitName} for $${confirmDialog.price.toLocaleString()}?`}
                    confirmText="Buy"
                    onConfirm={() => handleConfirm()}
                    onCancel={handleCancel}
                />
            )}
        </SideBar>
    )
}
