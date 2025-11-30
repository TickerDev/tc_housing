import { useState, useEffect } from 'react'
import { DaySelector } from './DaySelector'
import { Config } from '../Config'

interface RentDialogProps {
    open: boolean
    title: string
    unitName: string
    rentPrice: number
    onConfirm: (days: number) => void
    onCancel: () => void
}

export function RentDialog({
    open,
    title,
    unitName,
    rentPrice,
    onConfirm,
    onCancel
}: RentDialogProps) {
    const [days, setDays] = useState(1)
    const [totalPrice, setTotalPrice] = useState(rentPrice)

    useEffect(() => {
        let total = rentPrice * days

        const rentDiscounts = Config?.Market?.RentDiscounts || {}

        const discounts = Object.entries(rentDiscounts)
            .map(([d, disc]) => ({ days: Number(d), discount: Number(disc) }))
            .sort((a, b) => b.days - a.days)

        if (Config?.Market?.EnableRentDiscounts) {
            for (const { days: d, discount } of discounts) {
                if (days >= d) {
                    total = total * discount
                    break
                }
            }
        }

        setTotalPrice(Math.floor(total))
    }, [days, rentPrice])

    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="bg-sidebar-background border border-sidebar-border rounded-lg shadow-lg p-6 max-w-md w-full mx-4">
                <h3 className="text-lg font-semibold text-sidebar-foreground mb-2">
                    {title}
                </h3>
                <p className="text-sm text-sidebar-foreground/70 mb-4">
                    Rent {unitName}
                </p>

                <div className="mb-6">
                    <DaySelector selectedDays={days} onSelectDays={setDays} />
                </div>

                <div className="flex items-center justify-between mb-6 p-3 bg-sidebar-accent/10 rounded border border-sidebar-border">
                    <span className="text-sm text-sidebar-foreground/70">Total Price</span>
                    <span className="text-lg font-bold text-sidebar-foreground">
                        ${totalPrice.toLocaleString()}
                    </span>
                </div>

                <div className="flex gap-3 justify-end">
                    <button
                        onClick={onCancel}
                        className="rounded border border-sidebar-border px-4 py-2 text-sidebar-foreground hover:bg-sidebar-accent/20 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={() => onConfirm(days)}
                        className="rounded bg-sidebar-primary px-4 py-2 font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                    >
                        Rent for {days} Days
                    </button>
                </div>
            </div>
        </div>
    )
}

