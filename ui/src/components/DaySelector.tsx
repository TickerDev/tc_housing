import React from 'react'

interface DaySelectorProps {
    selectedDays: number
    onSelectDays: (days: number) => void
}

export const DaySelector: React.FC<DaySelectorProps> = ({
    selectedDays,
    onSelectDays
}) => {
    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-sidebar-foreground">Rent Duration</span>
                <span className="text-xs text-sidebar-foreground/60">{selectedDays} Days</span>
            </div>
            <div className="grid grid-cols-10 gap-1">
                {Array.from({ length: 30 }, (_, i) => i + 1).map((day) => (
                    <button
                        key={day}
                        onClick={() => onSelectDays(day)}
                        className={`
                            flex h-8 items-center justify-center rounded text-xs font-medium transition-colors
                            ${selectedDays === day
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                                : 'bg-sidebar-accent/10 text-sidebar-foreground hover:bg-sidebar-accent/20'
                            }
                        `}
                    >
                        {day}
                    </button>
                ))}
            </div>
        </div>
    )
}

