import { useCallback, useEffect, useRef, useState } from 'react'
import { SideBar } from '../components/SideBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RentDialog } from '../components/RentDialog'
import { fetchNui } from '../lib/fetchNui'
import { isEnvBrowser } from '../isEnvWeb'

type UnitStatus = 'owned' | 'rented' | 'available'

type HouseData = {
    id: number
    unitId: number
    name: string
    address?: string
    price: number
    rentPrice?: number
    status: UnitStatus
    isRentable: boolean
}

export default function HousePurchase({
    houseData,
    setDisplaying
}: {
    houseData: HouseData,
    setDisplaying: (val: any) => void
}) {
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [confirmDialog, setConfirmDialog] = useState<{
        open: boolean
        mode: 'buy' | 'rent' | null
    }>({ open: false, mode: null })
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

    const handleAction = (_unitId: number, mode: 'buy' | 'rent') => {
        setConfirmDialog({ open: true, mode })
    }

    const handleConfirm = (days?: number) => {
        if (!confirmDialog.mode) return

        if (!isEnvBrowser()) {
            fetchNui('buyHouse', {
                unitId: houseData.unitId,
                paymentMethod: 'bank',
                mode: confirmDialog.mode,
                days: days
            })
        }
        setConfirmDialog({ open: false, mode: null })
    }

    const handleCancel = () => {
        setConfirmDialog({ open: false, mode: null })
    }

    return (
        <SideBar
            open={sidebarOpen}
            onOpenChange={handleSidebarOpenChange}
            title={houseData.name}
            className="w-[30rem]"
        >
            <div className="space-y-4">
                {houseData.address && (
                    <div className="text-sm text-sidebar-foreground/70">
                        {houseData.address}
                    </div>
                )}

                <div className="flex flex-col gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/10 p-4">
                    <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">House Details</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full border ${houseData.status === 'available'
                            ? 'border-green-500/30 bg-green-500/10 text-green-500'
                            : 'border-red-500/30 bg-red-500/10 text-red-500'
                            }`}>
                            {houseData.status.toUpperCase()}
                        </span>
                    </div>

                    <div className="flex flex-col gap-2 text-sm pt-2">
                        <div className="flex items-center justify-between">
                            <span className="text-sidebar-foreground/70">
                                Purchase Price:
                            </span>
                            <span className="font-semibold text-sidebar-foreground">
                                ${houseData.price.toLocaleString()}
                            </span>
                        </div>

                        {houseData.isRentable &&
                            houseData.rentPrice !== undefined &&
                            houseData.rentPrice > 0 && (
                                <div className="flex items-center justify-between">
                                    <span className="text-sidebar-foreground/70">
                                        Rent Price:
                                    </span>
                                    <span className="font-semibold text-sidebar-foreground">
                                        ${houseData.rentPrice.toLocaleString()} / day
                                    </span>
                                </div>
                            )}
                    </div>

                    {houseData.status === 'available' && (
                        <div className="flex gap-2 justify-end pt-3 border-t border-sidebar-border">
                            <button
                                onClick={() => handleAction(houseData.unitId, 'buy')}
                                className="rounded bg-sidebar-primary px-4 py-2 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors font-medium"
                            >
                                Buy House
                            </button>
                            {houseData.isRentable && houseData.rentPrice !== undefined && houseData.rentPrice > 0 && (
                                <button
                                    onClick={() => handleAction(houseData.unitId, 'rent')}
                                    className="rounded border border-sidebar-border px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors font-medium"
                                >
                                    Rent House
                                </button>
                            )}
                        </div>
                    )}

                    {(houseData.status === 'owned' || houseData.status === 'rented') && (
                        <div className="flex gap-2 justify-end pt-3 border-t border-sidebar-border">
                            <button
                                onClick={() => {
                                    if (!isEnvBrowser()) {
                                        fetchNui('enterHouse', { unitId: houseData.unitId })
                                    }
                                }}
                                className="rounded bg-sidebar-primary px-4 py-2 text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors font-medium"
                            >
                                Enter House
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {confirmDialog.mode === 'rent' ? (
                <RentDialog
                    open={confirmDialog.open}
                    title="Rent House"
                    unitName={houseData.name}
                    rentPrice={houseData.rentPrice || 0}
                    onConfirm={(days) => handleConfirm(days)}
                    onCancel={handleCancel}
                />
            ) : (
                <ConfirmDialog
                    open={confirmDialog.open}
                    title="Confirm Purchase"
                    message={`Are you sure you want to buy ${houseData.name} for $${houseData.price.toLocaleString()}?`}
                    confirmText="Buy"
                    onConfirm={() => handleConfirm()}
                    onCancel={handleCancel}
                />
            )}
        </SideBar>
    )
}

