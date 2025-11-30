import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { isEnvBrowser } from '../isEnvWeb'
import { SideBar } from '../components/SideBar'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { fetchNui } from '../lib/fetchNui'
import { Config } from '../Config'

type HouseType = 'house' | 'apartment' | null

type InteriorKind = 'MLO' | 'Shell'

type ApartmentUnit = {
    id: number
    name: string
    address?: string
    price?: string
    description?: string
    interiorType?: InteriorKind
    shellName?: string
}

type House = {
    id: number
    name: string
    address?: string
    type: HouseType
    price?: string
    description?: string
    units?: ApartmentUnit[]
    interiorType?: InteriorKind
    shellName?: string
    coordinates?: { x: number; y: number; z: number }
}
type Displaying = 'houses' | null
export default function Sidebar({ setDisplaying, initialHouses }: { setDisplaying: (displaying: Displaying) => void, initialHouses: House[] }) {
    const [selectedHouseId, setSelectedHouseId] = useState<number | null>(null)
    const [selectedUnitId, setSelectedUnitId] = useState<number | null>(null)
    const [viewMode, setViewMode] = useState<'properties' | 'units' | 'houseForm' | 'complexForm' | 'mloSettings'>('properties')
    const [isCreating, setIsCreating] = useState(false)
    const [copiedVector, setCopiedVector] = useState(false)
    const [sidebarOpen, setSidebarOpen] = useState(true)
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
    const [showOwnerSelector, setShowOwnerSelector] = useState(false)
    const [ownerSelectorUnitId, setOwnerSelectorUnitId] = useState<number | null>(null)
    const [allPlayers, setAllPlayers] = useState<Array<{ source: number; citizenId: string; name: string }>>([])
    const [loadingPlayers, setLoadingPlayers] = useState(false)
    const [newHouseForm, setNewHouseForm] = useState({
        name: '',
        vectorX: '',
        vectorY: '',
        vectorZ: '',
        price: '',
        entrance: '',
        type: 'house' as HouseType,
        apartmentCount: '1',
        interiorType: 'Shell' as InteriorKind,
        shellName: '',
    })
    type MloDoorPart = { x: number; y: number; z: number; h?: number; model?: number }
    type MloDoorEntry = MloDoorPart | { doors: MloDoorPart[] }

    const [houses, setHouses] = useState<House[]>(initialHouses ?? [])
    const [mloConfigDraft, setMloConfigDraft] = useState<{
        propertyId: number | null
        doors: MloDoorEntry[]
        forSaleSign?: { x: number; y: number; z: number; h?: number }
    } | null>(null)
    const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

    const clearCloseTimeout = useCallback(() => {
        if (closeTimeoutRef.current) {
            clearTimeout(closeTimeoutRef.current)
            closeTimeoutRef.current = null
        }
    }, [setSidebarOpen])

    const finalizeSidebarClose = useCallback(() => {
        if (!isEnvBrowser()) {
            fetchNui("closeNui")
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

    const hasVector =
        newHouseForm.vectorX.trim() !== '' &&
        newHouseForm.vectorY.trim() !== '' &&
        newHouseForm.vectorZ.trim() !== ''

    const vectorLabel = hasVector
        ? `${newHouseForm.vectorX}, ${newHouseForm.vectorY}, ${newHouseForm.vectorZ}`
        : 'Click to set coordinates'

    const startCreateProperty = () => {
        setIsCreating(true)
        setNewHouseForm({
            name: '',
            vectorX: '',
            vectorY: '',
            vectorZ: '',
            price: '',
            entrance: '',
            type: 'house',
            apartmentCount: '1',
            interiorType: 'Shell',
            shellName: '',
        })
    }

    const cancelCreateProperty = () => {
        setIsCreating(false)
    }

    const handleVectorClickWeb = () => {
        const randomCoord = () => (Math.random() * 2000 - 1000).toFixed(2)
        setNewHouseForm((prev) => ({
            ...prev,
            vectorX: randomCoord(),
            vectorY: randomCoord(),
            vectorZ: randomCoord(),
        }))
    }

    const handleCopyVectorToClipboard = () => {
        if (!hasVector) return
        const value = vectorLabel
        try {
            const clipElem = document.createElement('textarea');
            clipElem.value = value;
            document.body.appendChild(clipElem);
            clipElem.select();
            document.execCommand('copy');
            document.body.removeChild(clipElem);
            setCopiedVector(true)
            window.setTimeout(() => setCopiedVector(false), 400)

        } catch {
        }
    }

    const handleShellSelection = useCallback(async (applySelection: (shellName: string) => void) => {
        if (isEnvBrowser()) {
            const availableShells = Object.keys((Config as { Shells?: Record<string, unknown> }).Shells ?? {})
            const fallbackShell = availableShells[0] ?? 'Demo Shell'
            applySelection(fallbackShell)
            return
        }

        setSidebarOpen(false)
        try {
            const result = await fetchNui('startShellSelection') as { success: boolean; shellName?: string }
            if (result?.success && result.shellName) {
                applySelection(result.shellName)
            }
        } finally {
            setSidebarOpen(true)
        }
    }, [])

    const handleCreateProperty = async (event: React.FormEvent) => {
        event.preventDefault()

        const apartmentCount = newHouseForm.type === 'apartment'
            ? Math.max(1, parseInt(newHouseForm.apartmentCount || '1', 10) || 1)
            : 0

        const units: ApartmentUnit[] | undefined =
            newHouseForm.type === 'apartment'
                ? Array.from({ length: apartmentCount }, (_, index) => ({
                    id: index + 1,
                    name: `Apartment ${index + 1}`,
                    address: newHouseForm.entrance || undefined,
                    price: '',
                    description: '',
                    interiorType: newHouseForm.interiorType,
                    shellName: '',
                }))
                : undefined

        const propertyData = {
            name: newHouseForm.name || 'New Property',
            address: newHouseForm.entrance || undefined,
            type: newHouseForm.type,
            price: newHouseForm.price || undefined,
            description: '',
            interiorType: newHouseForm.interiorType,
            shellName: newHouseForm.shellName || '',
            coords: {
                x: parseFloat(newHouseForm.vectorX),
                y: parseFloat(newHouseForm.vectorY),
                z: parseFloat(newHouseForm.vectorZ)
            },
            units
        }

        try {
            const result = await fetchNui('createProperty', propertyData) as { success: boolean; id?: number }
            if (result.success && result.id) {
                setHouses((prev) => [
                    ...prev,
                    {
                        ...propertyData,
                        id: result.id as number,
                    },
                ])
            }
        } catch (error) {
            console.error('Failed to create property:', error)
        }

        setSelectedHouseId(null)
        setSelectedUnitId(null)
        setIsCreating(false)
    }

    const selectedHouse = useMemo(
        () => houses.find((h) => h.id === selectedHouseId) ?? null,
        [houses, selectedHouseId]
    )

    const selectedUnit = useMemo(() => {
        if (!selectedHouse || selectedHouse.type !== 'apartment' || !selectedHouse.units?.length) {
            return null
        }

        const explicit = selectedHouse.units.find((u) => u.id === selectedUnitId)
        return explicit ?? selectedHouse.units[0]
    }, [selectedHouse, selectedUnitId])

    const handleUpdateSelectedHouse = (updates: Partial<House>) => {
        if (!selectedHouse) return

        const updatedHouse = { ...selectedHouse, ...updates }

        setHouses((prev) =>
            prev.map((house) =>
                house.id === selectedHouse.id ? updatedHouse : house
            )
        )

        if (!isEnvBrowser()) {
            fetchNui('updateProperty', {
                ...updatedHouse,
                id: selectedHouse.id
            }).catch(err => console.error('Failed to update property:', err))
        }
    }

    const handleDeleteSelectedProperty = () => {
        if (!selectedHouse) return
        setShowDeleteConfirm(true)
    }

    const confirmDelete = async () => {
        if (!selectedHouse) return
        setShowDeleteConfirm(false)

        if (isEnvBrowser()) {
            setHouses((prev) => prev.filter((h) => h.id !== selectedHouse.id))
            setSelectedHouseId(null)
            setSelectedUnitId(null)
            setViewMode('properties')
            return
        }

        try {
            const result = await fetchNui('deleteProperty', { id: selectedHouse.id }) as { success: boolean }
            if (result?.success) {
                setHouses((prev) => prev.filter((h) => h.id !== selectedHouse.id))
                setSelectedHouseId(null)
                setSelectedUnitId(null)
                setViewMode('properties')
            }
        } catch (err) {
            console.error('Failed to delete property:', err)
        }
    }

    const handleUpdateSelectedUnit = (updates: Partial<ApartmentUnit>) => {
        if (!selectedHouse || selectedHouse.type !== 'apartment' || !selectedUnit) return

        const updatedUnit = { ...selectedUnit, ...updates }

        setHouses((prev) =>
            prev.map((house) => {
                if (house.id !== selectedHouse.id || !house.units) return house

                return {
                    ...house,
                    units: house.units.map((unit) =>
                        unit.id === selectedUnit.id ? updatedUnit : unit
                    ),
                }
            })
        )

        if (!isEnvBrowser()) {
            fetchNui('updateUnit', {
                ...updatedUnit,
                id: selectedUnit.id
            }).catch(err => console.error('Failed to update unit:', err))
        }
    }

    const openOwnerSelector = async (unitId: number) => {
        setOwnerSelectorUnitId(unitId)
        setShowOwnerSelector(true)
        setLoadingPlayers(true)

        if (!isEnvBrowser()) {
            try {
                const players = await fetchNui('getAllPlayers') as Array<{ source: number; citizenId: string; name: string }>
                setAllPlayers(players || [])
            } catch (err) {
                console.error('Failed to load players:', err)
                setAllPlayers([])
            } finally {
                setLoadingPlayers(false)
            }
        } else {
            setAllPlayers([])
            setLoadingPlayers(false)
        }
    }

    const handleSetOwner = async (citizenId: string | null) => {
        if (!ownerSelectorUnitId) return

        if (!isEnvBrowser()) {
            try {
                const result = await fetchNui('setUnitOwner', { unitId: ownerSelectorUnitId, citizenId: citizenId || '' }) as { success: boolean }

                if (result?.success === true) {
                    setShowOwnerSelector(false)
                    setOwnerSelectorUnitId(null)
                    try {
                        const properties = await fetchNui('loadProperties') as House[]
                        if (properties) {
                            setHouses(properties)
                        }
                    } catch (err) {
                        console.error('Failed to reload properties:', err)
                    }
                }
            } catch (err) {
                console.error('Failed to set owner:', err)
            }
        } else {
            setShowOwnerSelector(false)
            setOwnerSelectorUnitId(null)
        }
    }

    if (!isEnvBrowser()) {
        return (
            <>
                <SideBar
                    open={sidebarOpen}
                    closeOnBackdropClick={false}
                    onOpenChange={handleSidebarOpenChange}
                    title="Housing"
                >
                    <div className="space-y-2 text-sm">
                        {isCreating ? (
                            <form onSubmit={handleCreateProperty} className="space-y-4">
                                <div>
                                    <h2 className="text-sm font-semibold mb-1">New property</h2>
                                    <p className="text-xs text-sidebar-foreground/70">
                                        Fill in the details below to create a new property.
                                    </p>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Name</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={newHouseForm.name}
                                            onChange={(e) =>
                                                setNewHouseForm((prev) => ({ ...prev, name: e.target.value }))
                                            }
                                            placeholder="Property name"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Coordinates</span>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setSidebarOpen(false)
                                                    fetchNui('generateVector3')
                                                        .then((vectorCoords: any) => {
                                                            if (!vectorCoords) return
                                                            const roundTo2 = (v: any) => {
                                                                const num =
                                                                    typeof v === 'number'
                                                                        ? v
                                                                        : parseFloat(String(v))
                                                                if (Number.isNaN(num)) return ''
                                                                return num.toFixed(2)
                                                            }
                                                            setNewHouseForm((prev) => ({
                                                                ...prev,
                                                                vectorX: roundTo2(vectorCoords.x),
                                                                vectorY: roundTo2(vectorCoords.y),
                                                                vectorZ: roundTo2(vectorCoords.z),
                                                                entrance:
                                                                    prev.entrance ||
                                                                    (vectorCoords.streetName
                                                                        ? String(vectorCoords.streetName)
                                                                        : prev.entrance),
                                                            }))
                                                        })
                                                        .finally(() => {
                                                            setSidebarOpen(true)
                                                        })
                                                }}
                                                className={`inline-flex flex-1 items-center justify-center rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${hasVector
                                                    ? 'text-sidebar-foreground'
                                                    : 'text-sidebar-foreground/40 cursor-not-allowed opacity-60'
                                                    }`}
                                            >
                                                {vectorLabel}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleCopyVectorToClipboard}
                                                disabled={!hasVector}
                                                className={[
                                                    'inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-xs',
                                                    hasVector
                                                        ? [
                                                            'text-sidebar-foreground hover:bg-sidebar-accent/20 cursor-pointer',
                                                            copiedVector ? 'animate-pulse' : '',
                                                        ].join(' ')
                                                        : 'text-sidebar-foreground/40 cursor-not-allowed opacity-60',
                                                ].join(' ')}
                                                aria-label="Copy coordinates to clipboard"
                                            >
                                                📋
                                            </button>
                                        </div>
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Interior</span>
                                        <select
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={newHouseForm.interiorType}
                                            onChange={(e) =>
                                                setNewHouseForm((prev) => ({
                                                    ...prev,
                                                    interiorType: e.target.value as InteriorKind,
                                                }))
                                            }
                                        >
                                            <option value="MLO">MLO</option>
                                            <option value="Shell">Shell</option>
                                        </select>
                                    </label>

                                    {/* {newHouseForm.interiorType === 'Shell' && (
                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Shell</span>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                value={newHouseForm.shellName}
                                                readOnly
                                                placeholder="No shell selected"
                                            />
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handleShellSelection((shellName) =>
                                                        setNewHouseForm((prev) => ({ ...prev, shellName }))
                                                    )
                                                }
                                                className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            >
                                                Set shell
                                            </button>
                                        </div>
                                    </label>
                                )} */}


                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Address</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={newHouseForm.entrance}
                                            readOnly
                                            placeholder="Auto-filled from location"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Type</span>
                                        <select
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={newHouseForm.type ?? 'house'}
                                            onChange={(e) =>
                                                setNewHouseForm((prev) => ({
                                                    ...prev,
                                                    type: e.target.value as HouseType,
                                                }))
                                            }
                                        >
                                            <option value="house">House</option>
                                            <option value="apartment">Apartment</option>
                                        </select>
                                    </label>
                                    {newHouseForm.type === 'apartment' && (
                                        <label className="flex flex-col gap-1">
                                            <span className="text-sidebar-foreground/70">Number of apartments</span>
                                            <input
                                                className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                type="number"
                                                min={1}
                                                value={newHouseForm.apartmentCount}
                                                onChange={(e) =>
                                                    setNewHouseForm((prev) => ({
                                                        ...prev,
                                                        apartmentCount: e.target.value,
                                                    }))
                                                }
                                                placeholder="How many apartments in this complex?"
                                            />
                                        </label>
                                    )}

                                </div>

                                <div className="flex items-center justify-end gap-2 pt-2">
                                    <button
                                        type="button"
                                        onClick={cancelCreateProperty}
                                        className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        className="inline-flex items-center justify-center rounded-md bg-sidebar-primary px-3 py-1.5 text-xs font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    >
                                        Save property
                                    </button>
                                </div>
                            </form>
                        ) : viewMode === 'units' && selectedHouse && selectedHouse.type === 'apartment' && !selectedUnitId ? (
                            <>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setViewMode('complexForm')
                                    }}
                                    className="mb-4 inline-flex w-full items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/10 px-3 py-2 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                >
                                    Edit Apartment Complex
                                </button>

                                <div className="mb-4 border-t border-sidebar-border"></div>

                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold">Apartments in {selectedHouse.name}</h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewMode('properties')
                                            setSelectedHouseId(null)
                                            setSelectedUnitId(null)
                                        }}
                                        className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground underline-offset-2 hover:underline"
                                    >
                                        Back to properties
                                    </button>
                                </div>

                                {selectedHouse.units && selectedHouse.units.length > 0 ? (
                                    <ul className="space-y-2">
                                        {selectedHouse.units.map((unit, index) => {
                                            const label = unit.name || `Apartment ${index + 1}`

                                            return (
                                                <li
                                                    key={unit.id}
                                                    className="rounded-md border border-sidebar-border bg-sidebar-accent/10"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => setSelectedUnitId(unit.id)}
                                                        className="flex w-full flex-col gap-1 px-3 py-2 text-left rounded-md cursor-pointer transition-colors duration-150 bg-transparent hover:bg-sidebar-accent/20"
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <p className="text-sm font-medium">{label}</p>
                                                            <span className="inline-flex items-center rounded-full border border-sidebar-border/70 bg-sidebar-accent/10 px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
                                                                Unit #{index + 1}
                                                            </span>
                                                        </div>
                                                    </button>
                                                </li>
                                            )
                                        })}
                                    </ul>
                                ) : (
                                    <p className="text-xs text-sidebar-foreground/60">
                                        No apartments configured yet for this complex.
                                    </p>
                                )}
                            </>
                        ) : viewMode === 'units' && selectedHouse && selectedHouse.type === 'apartment' && selectedUnitId && selectedUnit ? (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold">Apartment settings</h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedUnitId(null)
                                        }}
                                        className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground underline-offset-2 hover:underline"
                                    >
                                        Back to apartments
                                    </button>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Apartment name</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedUnit.name}
                                            onChange={(e) =>
                                                handleUpdateSelectedUnit({
                                                    name: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Apartment address</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedUnit.address ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedUnit({
                                                    address: e.target.value,
                                                })
                                            }
                                            placeholder="e.g. Heritage Way 2"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Apartment price</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedUnit.price ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedUnit({
                                                    price: e.target.value,
                                                })
                                            }
                                            placeholder="Set price for this apartment"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Interior</span>
                                        <select
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedUnit.interiorType ?? 'Shell'}
                                            onChange={(e) =>
                                                handleUpdateSelectedUnit({
                                                    interiorType: e.target.value as InteriorKind,
                                                })
                                            }
                                        >
                                            <option value="MLO">MLO</option>
                                            <option value="Shell">Shell</option>
                                        </select>
                                    </label>

                                    {selectedUnit.interiorType === 'Shell' && (
                                        <label className="flex flex-col gap-1">
                                            <span className="text-sidebar-foreground/70">Shell</span>
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                    value={selectedUnit.shellName ?? ''}
                                                    readOnly
                                                    placeholder="No shell selected"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleShellSelection((shellName) =>
                                                            handleUpdateSelectedUnit({ shellName })
                                                        )
                                                    }
                                                    className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                >
                                                    Set shell
                                                </button>
                                            </div>
                                        </label>
                                    )}

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">
                                            Apartment description
                                        </span>
                                        <textarea
                                            className="min-h-[60px] rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedUnit.description ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedUnit({
                                                    description: e.target.value,
                                                })
                                            }
                                            placeholder="Short description of this apartment"
                                        />
                                    </label>

                                    <div className="pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (selectedUnit) {
                                                    openOwnerSelector(selectedUnit.id)
                                                }
                                            }}
                                            className="inline-flex items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/10 px-3 py-1.5 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                        >
                                            Set Owner
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : viewMode === 'complexForm' && selectedHouse && selectedHouse.type === 'apartment' ? (
                            <>
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-sm font-semibold">Apartment Complex Settings</h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setViewMode('units')
                                                setSelectedUnitId(null)
                                            }}
                                            className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground underline-offset-2 hover:underline"
                                        >
                                            Back to apartments
                                        </button>

                                    </div>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Complex name</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.name}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    name: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Address</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.address ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    address: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Number of apartments</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.units?.length ?? 0}
                                            readOnly
                                            placeholder="Number of apartments"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Coordinates</span>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                value={selectedHouse.coordinates ? `${selectedHouse.coordinates.x.toFixed(2)}, ${selectedHouse.coordinates.y.toFixed(2)}, ${selectedHouse.coordinates.z.toFixed(2)}` : 'No coordinates'}
                                                readOnly
                                                placeholder="No coordinates set"
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (!isEnvBrowser()) {
                                                        const vectorCoords = await fetchNui('generateVector3') as { x: number; y: number; z: number }
                                                        if (vectorCoords) {
                                                            handleUpdateSelectedHouse({
                                                                coordinates: {
                                                                    x: vectorCoords.x,
                                                                    y: vectorCoords.y,
                                                                    z: vectorCoords.z,
                                                                }
                                                            })
                                                        }
                                                    }
                                                }}
                                                className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            >
                                                Set coordinates
                                            </button>
                                        </div>
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Interior</span>
                                        <select
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.interiorType ?? 'Shell'}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    interiorType: e.target.value as InteriorKind,
                                                })
                                            }
                                        >
                                            <option value="MLO">MLO</option>
                                            <option value="Shell">Shell</option>
                                        </select>
                                    </label>

                                    {selectedHouse.interiorType === 'Shell' && (
                                        <label className="flex flex-col gap-1">
                                            <span className="text-sidebar-foreground/70">Shell</span>
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                    value={selectedHouse.shellName ?? ''}
                                                    readOnly
                                                    placeholder="No shell selected"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleShellSelection((shellName) =>
                                                            handleUpdateSelectedHouse({ shellName })
                                                        )
                                                    }
                                                    className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                >
                                                    Set shell
                                                </button>
                                            </div>
                                        </label>
                                    )}

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Description</span>
                                        <textarea
                                            className="min-h-[60px] rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.description ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    description: e.target.value,
                                                })
                                            }
                                            placeholder="Short description of this complex"
                                        />
                                    </label>
                                    <button
                                        type="button"
                                        onClick={handleDeleteSelectedProperty}
                                        className="inline-flex w-full items-center justify-center rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                                    >
                                        Delete property
                                    </button>
                                </div>
                            </>
                        ) : viewMode === 'houseForm' && selectedHouse && selectedHouse.type === 'house' ? (
                            <>
                                <div className="flex items-center justify-between mb-2">
                                    <h2 className="text-sm font-semibold">House settings</h2>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setViewMode('properties')
                                                setSelectedHouseId(null)
                                            }}
                                            className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground underline-offset-2 hover:underline"
                                        >
                                            Back to properties
                                        </button>

                                    </div>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">House name</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.name}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    name: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Address</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.address ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    address: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Coordinates</span>
                                        <div className="flex gap-2">
                                            <input
                                                className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                value={selectedHouse.coordinates ? `${selectedHouse.coordinates.x.toFixed(2)}, ${selectedHouse.coordinates.y.toFixed(2)}, ${selectedHouse.coordinates.z.toFixed(2)}` : 'No coordinates'}
                                                readOnly
                                                placeholder="No coordinates set"
                                            />
                                        </div>
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Price</span>
                                        <input
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.price ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    price: e.target.value,
                                                })
                                            }
                                            placeholder="Set price for this house"
                                        />
                                    </label>

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Interior</span>
                                        <select
                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.interiorType ?? 'Shell'}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    interiorType: e.target.value as InteriorKind,
                                                })
                                            }
                                        >
                                            <option value="MLO">MLO</option>
                                            <option value="Shell">Shell</option>
                                        </select>
                                    </label>

                                    {selectedHouse.interiorType === 'Shell' && (
                                        <label className="flex flex-col gap-1">
                                            <span className="text-sidebar-foreground/70">Shell</span>
                                            <div className="flex gap-2">
                                                <input
                                                    className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                    value={selectedHouse.shellName ?? ''}
                                                    readOnly
                                                    placeholder="No shell selected"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handleShellSelection((shellName) =>
                                                            handleUpdateSelectedHouse({ shellName })
                                                        )
                                                    }
                                                    className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                >
                                                    Set shell
                                                </button>
                                            </div>
                                        </label>
                                    )}

                                    <label className="flex flex-col gap-1">
                                        <span className="text-sidebar-foreground/70">Description</span>
                                        <textarea
                                            className="min-h-[60px] rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={selectedHouse.description ?? ''}
                                            onChange={(e) =>
                                                handleUpdateSelectedHouse({
                                                    description: e.target.value,
                                                })
                                            }
                                            placeholder="Short description of this house"
                                        />
                                    </label>

                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!isEnvBrowser() && selectedHouse) {
                                                const unitId = await fetchNui('getHouseUnitId', { propertyId: selectedHouse.id }) as number | null
                                                if (unitId) {
                                                    openOwnerSelector(unitId)
                                                }
                                            }
                                        }}
                                        className="inline-flex w-full items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/10 px-3 py-1.5 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    >
                                        Set Owner
                                    </button>

                                    {selectedHouse.interiorType === 'MLO' && (
                                        <div className="pt-2 space-y-1">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    if (isEnvBrowser()) {
                                                        setMloConfigDraft({
                                                            propertyId: selectedHouse.id,
                                                            doors: [],
                                                            forSaleSign: undefined,
                                                        })
                                                        setViewMode('mloSettings')
                                                        return
                                                    }

                                                    setSidebarOpen(false)
                                                    fetchNui('getMloConfig', { propertyId: selectedHouse.id })
                                                        .then((value: unknown) => {
                                                            const config = value as {
                                                                doors?: MloDoorEntry[]
                                                                forSaleSign?: { x: number; y: number; z: number; h?: number }
                                                            } | null
                                                            setMloConfigDraft({
                                                                propertyId: selectedHouse.id,
                                                                doors: (config && Array.isArray(config.doors) ? config.doors : []),
                                                                forSaleSign: config?.forSaleSign,
                                                            })
                                                            setViewMode('mloSettings')
                                                        })
                                                        .catch((err) => {
                                                            console.error('Failed to load MLO config:', err)
                                                            setMloConfigDraft({
                                                                propertyId: selectedHouse.id,
                                                                doors: [],
                                                                forSaleSign: undefined,
                                                            })
                                                            setViewMode('mloSettings')
                                                        })
                                                        .finally(() => {
                                                            setSidebarOpen(true)
                                                        })
                                                }}
                                                className="inline-flex w-full items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent/10 px-3 py-1.5 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            >
                                                Config MLO Settings
                                            </button>
                                            <p className="text-[11px] text-sidebar-foreground/60">
                                                Open a dedicated menu to configure MLO doors and for-sale sign.
                                            </p>
                                        </div>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleDeleteSelectedProperty}
                                        className="inline-flex w-full items-center justify-center rounded-md border border-red-500/60 bg-red-500/10 px-3 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                                    >
                                        Delete property
                                    </button>
                                </div>
                            </>
                        ) : viewMode === 'mloSettings' && selectedHouse && selectedHouse.type === 'house' ? (
                            <>
                                <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-sm font-semibold">MLO Settings</h2>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setViewMode('houseForm')
                                        }}
                                        className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground underline-offset-2 hover:underline"
                                    >
                                        Back to house
                                    </button>
                                </div>

                                <div className="space-y-3 text-xs">
                                    <div className="space-y-1">
                                        <h3 className="text-xs font-semibold text-sidebar-foreground">Doors</h3>
                                        <p className="text-[11px] text-sidebar-foreground/60">
                                            Configure door interaction positions for this MLO house. At least one door
                                            should be configured.
                                        </p>
                                        <div className="space-y-1">
                                            {(mloConfigDraft?.propertyId === selectedHouse.id &&
                                                mloConfigDraft.doors.length > 0
                                                ? mloConfigDraft.doors
                                                : []
                                            ).map((door, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center justify-between rounded-md border border-sidebar-border bg-sidebar-accent/5 px-2 py-1.5"
                                                >
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-medium text-sidebar-foreground">
                                                            Door #{index + 1}
                                                        </span>
                                                        <span className="text-[11px] text-sidebar-foreground/70">
                                                            {'doors' in door && Array.isArray(door.doors) && door.doors.length >= 2
                                                                ? `Double door: ${door.doors[0].x.toFixed(2)}, ${door.doors[0].y.toFixed(2)}, ${door.doors[0].z.toFixed(2)} & ${door.doors[1].x.toFixed(2)}, ${door.doors[1].y.toFixed(2)}, ${door.doors[1].z.toFixed(2)}`
                                                                : `${(door as MloDoorPart).x.toFixed(2)}, ${(door as MloDoorPart).y.toFixed(2)}, ${(door as MloDoorPart).z.toFixed(2)}`
                                                            }
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <button
                                                            type="button"
                                                            onClick={async () => {
                                                                if (isEnvBrowser()) return
                                                                setSidebarOpen(false)
                                                                try {
                                                                    const result = await fetchNui('pickMloDoor', {
                                                                        propertyId: selectedHouse.id,
                                                                    }) as {
                                                                        success: boolean
                                                                        door?: MloDoorEntry
                                                                    }
                                                                    if (result?.success && result.door) {
                                                                        setMloConfigDraft((prev) => {
                                                                            if (!prev || prev.propertyId !== selectedHouse.id) {
                                                                                return {
                                                                                    propertyId: selectedHouse.id,
                                                                                    doors: [result.door!],
                                                                                    forSaleSign: undefined,
                                                                                }
                                                                            }
                                                                            const newDoors = [...prev.doors]
                                                                            newDoors[index] = result.door!
                                                                            return { ...prev, doors: newDoors }
                                                                        })
                                                                    }
                                                                } catch (err) {
                                                                    console.error('Failed to pick MLO door:', err)
                                                                } finally {
                                                                    setSidebarOpen(true)
                                                                }
                                                            }}
                                                            className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                        >
                                                            Set position
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setMloConfigDraft((prev) => {
                                                                    if (!prev || prev.propertyId !== selectedHouse.id) return prev
                                                                    const newDoors = prev.doors.filter((_, i) => i !== index)
                                                                    return { ...prev, doors: newDoors }
                                                                })
                                                            }}
                                                            className="inline-flex items-center justify-center rounded-md border border-red-500/60 bg-red-500/10 px-2 py-1 text-[11px] font-medium text-red-500 hover:bg-red-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                                                        >
                                                            Delete
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (isEnvBrowser()) return
                                                setSidebarOpen(false)
                                                try {
                                                    const result = await fetchNui('pickMloDoor', {
                                                        propertyId: selectedHouse.id,
                                                    }) as {
                                                        success: boolean
                                                        door?: MloDoorEntry
                                                    }
                                                    if (result?.success && result.door) {
                                                        setMloConfigDraft((prev) => {
                                                            if (!prev || prev.propertyId !== selectedHouse.id) {
                                                                return {
                                                                    propertyId: selectedHouse.id,
                                                                    doors: [result.door!],
                                                                    forSaleSign: undefined,
                                                                }
                                                            }
                                                            return {
                                                                ...prev,
                                                                doors: [...prev.doors, result.door!],
                                                            }
                                                        })
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to add MLO door:', err)
                                                } finally {
                                                    setSidebarOpen(true)
                                                }
                                            }}
                                            className="inline-flex mt-1 items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                        >
                                            Add door
                                        </button>
                                    </div>

                                    <div className="space-y-1">
                                        <h3 className="text-xs font-semibold text-sidebar-foreground">For-sale sign</h3>
                                        <p className="text-[11px] text-sidebar-foreground/60">
                                            Set where the for-sale sign should appear, just like selecting coordinates.
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <input
                                                className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-[11px] text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                value={
                                                    mloConfigDraft?.propertyId === selectedHouse.id &&
                                                        mloConfigDraft.forSaleSign
                                                        ? `${mloConfigDraft.forSaleSign.x.toFixed(2)}, ${mloConfigDraft.forSaleSign.y.toFixed(2)}, ${mloConfigDraft.forSaleSign.z.toFixed(2)}`
                                                        : 'No sign position set'
                                                }
                                                readOnly
                                            />
                                            <button
                                                type="button"
                                                onClick={async () => {
                                                    if (isEnvBrowser()) return
                                                    setSidebarOpen(false)
                                                    try {
                                                        const vectorCoords = await fetchNui('generateVector3') as {
                                                            x: number; y: number; z: number
                                                        }
                                                        if (vectorCoords) {
                                                            setMloConfigDraft((prev) => {
                                                                const base = (!prev || prev.propertyId !== selectedHouse.id)
                                                                    ? { propertyId: selectedHouse.id, doors: [], forSaleSign: undefined }
                                                                    : prev
                                                                return {
                                                                    ...base,
                                                                    forSaleSign: {
                                                                        x: vectorCoords.x,
                                                                        y: vectorCoords.y,
                                                                        z: vectorCoords.z,
                                                                    },
                                                                }
                                                            })
                                                        }
                                                    } catch (err) {
                                                        console.error('Failed to set MLO sign position:', err)
                                                    } finally {
                                                        setSidebarOpen(true)
                                                    }
                                                }}
                                                className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            >
                                                Set position
                                            </button>
                                        </div>
                                    </div>

                                    <div className="flex items-center justify-end gap-2 pt-2">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setViewMode('houseForm')
                                            }}
                                            className="inline-flex items-center justify-center rounded-md border border-sidebar-border px  -3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!selectedHouse) return
                                                const current = mloConfigDraft
                                                if (!current || current.propertyId !== selectedHouse.id || current.doors.length === 0) {
                                                    console.error('At least one door must be configured before saving MLO settings.')
                                                    return
                                                }
                                                if (isEnvBrowser()) {
                                                    setViewMode('houseForm')
                                                    return
                                                }
                                                try {
                                                    const result = await fetchNui('saveMloSettings', {
                                                        propertyId: selectedHouse.id,
                                                        doors: current.doors,
                                                        forSaleSign: current.forSaleSign,
                                                    }) as { success: boolean }
                                                    if (result?.success) {
                                                        setViewMode('houseForm')
                                                    }
                                                } catch (err) {
                                                    console.error('Failed to save MLO settings:', err)
                                                }
                                            }}
                                            className="inline-flex items-center justify-center rounded-md bg-sidebar-primary px-3 py-1.5 text-xs font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                        >
                                            Save MLO settings
                                        </button>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    onClick={startCreateProperty}
                                    className="mb-4 inline-flex w-full items-center justify-center rounded-md bg-sidebar-primary px-3 py-2 text-sm font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                >
                                    Create new property
                                </button>

                                {houses.length === 0 ? (
                                    <p className="text-xs text-sidebar-foreground/60">
                                        No properties yet. Click &quot;Create new property&quot; to add one.
                                    </p>
                                ) : (
                                    <ul className="space-y-2">
                                        {houses.map((house) => (
                                            <li
                                                key={house.id}
                                                className="rounded-md border border-sidebar-border bg-sidebar-accent/10"
                                            >
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setSelectedHouseId(house.id)
                                                        if (house.type === 'apartment' && house.units?.length) {
                                                            setViewMode('units')
                                                            setSelectedUnitId(null)
                                                        } else if (house.type === 'house') {
                                                            setViewMode('houseForm')
                                                        } else {
                                                            setViewMode('properties')
                                                            setSelectedUnitId(null)
                                                        }
                                                    }}
                                                    className={[
                                                        'flex w-full flex-col gap-1 px-3 py-2 text-left rounded-md cursor-pointer',
                                                        'transition-colors duration-150',
                                                        selectedHouseId === house.id && viewMode === 'properties'
                                                            ? 'bg-sidebar-accent/30'
                                                            : 'bg-transparent hover:bg-sidebar-accent/20',
                                                    ].join(' ')}
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <p className="text-sm font-medium">{house.name}</p>
                                                        {house.type && (
                                                            <span className="inline-flex items-center rounded-full border border-sidebar-border/70 bg-sidebar-accent/10 px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
                                                                {house.type === 'house' ? 'House' : 'Complex'}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {house.address && (
                                                        <p className="text-xs text-sidebar-foreground/70">{house.address}</p>
                                                    )}
                                                </button>
                                            </li>
                                        ))}
                                    </ul>
                                )}

                                {viewMode === 'units' && selectedHouse && selectedHouse.type === 'apartment' && (
                                    <div className="mt-4 border-t border-sidebar-border pt-3 text-xs space-y-3">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-semibold">Apartments in this complex</h3>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setViewMode('properties')
                                                    setSelectedHouseId(null)
                                                    setSelectedUnitId(null)
                                                }}
                                                className="text-[11px] text-sidebar-foreground/70 hover:text-sidebar-foreground underline-offset-2 hover:underline"
                                            >
                                                Back to properties
                                            </button>
                                        </div>

                                        <div className="space-y-2">
                                            <p className="text-[11px] text-sidebar-foreground/60">
                                                {selectedHouse.address || selectedHouse.name}
                                            </p>

                                            {selectedHouse.units && selectedHouse.units.length > 0 ? (
                                                <ul className="space-y-1">
                                                    {selectedHouse.units.map((unit, index) => {
                                                        const label = unit.name || `Apartment ${index + 1}`

                                                        const isActive = selectedUnitId === unit.id

                                                        return (
                                                            <li key={unit.id}>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setSelectedUnitId(unit.id)}
                                                                    className={[
                                                                        'flex w-full items-center justify-between rounded-md border border-sidebar-border px-3 py-1.5 text-left text-xs',
                                                                        isActive
                                                                            ? 'bg-sidebar-accent/40'
                                                                            : 'bg-sidebar hover:bg-sidebar-accent/20',
                                                                    ].join(' ')}
                                                                >
                                                                    <span className="font-medium">{label}</span>
                                                                    <span className="text-[10px] text-sidebar-foreground/60">
                                                                        Unit #{index + 1}
                                                                    </span>
                                                                </button>
                                                            </li>
                                                        )
                                                    })}
                                                </ul>
                                            ) : (
                                                <p className="text-[11px] text-sidebar-foreground/60">
                                                    No apartments configured yet for this complex.
                                                </p>
                                            )}

                                            {selectedUnit && (
                                                <div className="space-y-2 pt-3 border-t border-sidebar-border mt-3">
                                                    <h4 className="text-[11px] font-semibold text-sidebar-foreground">
                                                        Apartment settings
                                                    </h4>

                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-sidebar-foreground/70">Apartment name</span>
                                                        <input
                                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                            value={selectedUnit.name}
                                                            onChange={(e) =>
                                                                handleUpdateSelectedUnit({
                                                                    name: e.target.value,
                                                                })
                                                            }
                                                        />
                                                    </label>

                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-sidebar-foreground/70">Apartment address</span>
                                                        <input
                                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                            value={selectedUnit.address ?? ''}
                                                            onChange={(e) =>
                                                                handleUpdateSelectedUnit({
                                                                    address: e.target.value,
                                                                })
                                                            }
                                                            placeholder="e.g. Heritage Way 2"
                                                        />
                                                    </label>

                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-sidebar-foreground/70">Apartment price</span>
                                                        <input
                                                            className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                            value={selectedUnit.price ?? ''}
                                                            readOnly
                                                            placeholder="Price will be set later"
                                                        />
                                                    </label>

                                                    <label className="flex flex-col gap-1">
                                                        <span className="text-sidebar-foreground/70">
                                                            Apartment description
                                                        </span>
                                                        <textarea
                                                            className="min-h-[60px] rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                                            value={selectedUnit.description ?? ''}
                                                            onChange={(e) =>
                                                                handleUpdateSelectedUnit({
                                                                    description: e.target.value,
                                                                })
                                                            }
                                                            placeholder="Short description of this apartment"
                                                        />
                                                    </label>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <ConfirmDialog
                        open={showDeleteConfirm}
                        title="Delete Property"
                        message={`Are you sure you want to delete "${selectedHouse?.name}"? This action cannot be undone.`}
                        confirmText="Delete"
                        cancelText="Cancel"
                        variant="danger"
                        onConfirm={confirmDelete}
                        onCancel={() => setShowDeleteConfirm(false)}
                    />
                </SideBar>

                {showOwnerSelector && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm">
                        <div className="bg-[#1e1e1e] border border-gray-700 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
                            <h3 className="text-xl font-bold text-white mb-6">
                                Set Owner
                            </h3>
                            <div className="flex-1 overflow-y-auto mb-4 space-y-2">
                                {loadingPlayers ? (
                                    <div className="text-sm text-gray-400 text-center py-8">
                                        Loading players...
                                    </div>
                                ) : (
                                    <>
                                        <button
                                            onClick={() => handleSetOwner(null)}
                                            className="w-full text-left rounded-lg border border-red-500/50 bg-red-900/20 px-4 py-3 text-sm text-white hover:bg-red-900/40 hover:border-red-500 transition-all duration-200"
                                        >
                                            <div className="font-semibold text-red-400">None (Back on Market)</div>
                                            <div className="text-xs text-gray-400 mt-1">Remove ownership and put property back on market</div>
                                        </button>
                                        {allPlayers.map((player) => (
                                            <button
                                                key={player.citizenId}
                                                onClick={() => handleSetOwner(player.citizenId)}
                                                className="w-full text-left rounded-lg border border-gray-600 bg-gray-800/50 px-4 py-3 text-sm text-white hover:bg-gray-700/70 hover:border-blue-500 transition-all duration-200"
                                            >
                                                <div className="font-semibold text-blue-300">{player.name}</div>
                                                <div className="text-xs text-gray-400 mt-1">Citizen ID: {player.citizenId}</div>
                                            </button>
                                        ))}
                                        {allPlayers.length === 0 && !loadingPlayers && (
                                            <div className="text-sm text-gray-400 text-center py-8 bg-gray-800/30 rounded-lg border border-gray-700">
                                                No players currently online
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                            <div className="flex gap-3 justify-end pt-4 border-t border-gray-700">
                                <button
                                    onClick={() => {
                                        setShowOwnerSelector(false)
                                        setOwnerSelectorUnitId(null)
                                    }}
                                    className="rounded-lg border border-gray-600 bg-gray-800 px-6 py-2 text-sm font-medium text-white hover:bg-gray-700 hover:border-gray-500 transition-all duration-200"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </>
        )
    }

    return (
        <SideBar open={sidebarOpen} closeOnBackdropClick={false} onOpenChange={handleSidebarOpenChange} title="Ticker's Housing">
            <div className="space-y-2 text-sm">
                {isCreating ? (
                    <form onSubmit={handleCreateProperty} className="space-y-4">
                        <div>
                            <h2 className="text-sm font-semibold mb-1">New property</h2>
                            <p className="text-xs text-sidebar-foreground/70">
                                Fill in the details below to create a new property.
                            </p>
                        </div>

                        <div className="space-y-2 text-xs">
                            <label className="flex flex-col gap-1">
                                <span className="text-sidebar-foreground/70">Name</span>
                                <input
                                    className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    value={newHouseForm.name}
                                    onChange={(e) =>
                                        setNewHouseForm((prev) => ({ ...prev, name: e.target.value }))
                                    }
                                    placeholder="Property name"
                                />
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-sidebar-foreground/70">Vector3</span>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handleVectorClickWeb}
                                        className={`inline-flex flex-1 items-center justify-center rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${hasVector
                                            ? 'text-sidebar-foreground'
                                            : 'text-sidebar-foreground/40 cursor-not-allowed opacity-60'
                                            }`}
                                    >
                                        {vectorLabel}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={handleCopyVectorToClipboard}
                                        disabled={!hasVector}
                                        className={[
                                            'inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-xs',
                                            hasVector
                                                ? [
                                                    'text-sidebar-foreground hover:bg-sidebar-accent/20 cursor-pointer',
                                                    copiedVector ? 'animate-pulse' : '',
                                                ].join(' ')
                                                : 'text-sidebar-foreground/40 cursor-not-allowed opacity-60',
                                        ].join(' ')}
                                        aria-label="Copy vector3 to clipboard"
                                    >
                                        📋
                                    </button>
                                </div>
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-sidebar-foreground/70">Interior</span>
                                <select
                                    className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    value={newHouseForm.interiorType}
                                    onChange={(e) =>
                                        setNewHouseForm((prev) => ({
                                            ...prev,
                                            interiorType: e.target.value as InteriorKind,
                                        }))
                                    }
                                >
                                    <option value="MLO">MLO</option>
                                    <option value="Shell">Shell</option>
                                </select>
                            </label>

                            {newHouseForm.interiorType === 'Shell' && (
                                <label className="flex flex-col gap-1">
                                    <span className="text-sidebar-foreground/70">Shell</span>
                                    <div className="flex gap-2">
                                        <input
                                            className="flex-1 rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                            value={newHouseForm.shellName}
                                            readOnly
                                            placeholder="No shell selected"
                                        />
                                        <button
                                            type="button"
                                            onClick={() =>
                                                handleShellSelection((shellName) =>
                                                    setNewHouseForm((prev) => ({ ...prev, shellName }))
                                                )
                                            }
                                            className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-2 py-1 text-[11px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                        >
                                            Set shell
                                        </button>
                                    </div>
                                </label>
                            )}

                            <label className="flex flex-col gap-1">
                                <span className="text-sidebar-foreground/70">Address</span>
                                <input
                                    className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    value={newHouseForm.entrance}
                                    readOnly
                                    placeholder="Auto-filled from location"
                                />
                            </label>

                            <label className="flex flex-col gap-1">
                                <span className="text-sidebar-foreground/70">Type</span>
                                <select
                                    className="rounded-md border border-sidebar-border bg-sidebar px-2 py-1 text-xs text-sidebar-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                                    value={newHouseForm.type ?? 'house'}
                                    onChange={(e) =>
                                        setNewHouseForm((prev) => ({
                                            ...prev,
                                            type: e.target.value as HouseType,
                                        }))
                                    }
                                >
                                    <option value="house">House</option>
                                    <option value="apartment">Apartment</option>
                                </select>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={cancelCreateProperty}
                                className="inline-flex items-center justify-center rounded-md border border-sidebar-border px-3 py-1.5 text-xs font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="inline-flex items-center justify-center rounded-md bg-sidebar-primary px-3 py-1.5 text-xs font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                            >
                                Save property
                            </button>
                        </div>
                    </form>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-4">
                            <button
                                type="button"
                                onClick={startCreateProperty}
                                className="inline-flex items-center justify-center rounded-md bg-sidebar-primary px-3 py-2 text-sm font-medium text-sidebar-primary-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
                            >
                                Create new property
                            </button>
                            {selectedHouse && (
                                <button
                                    type="button"
                                    onClick={async () => {
                                        if (!selectedHouse) return
                                        if (isEnvBrowser()) {
                                            setHouses((prev) => prev.filter((h) => h.id !== selectedHouse.id))
                                            setSelectedHouseId(null)
                                            setSelectedUnitId(null)
                                            setViewMode('properties')
                                            return
                                        }
                                        try {
                                            const result = await fetchNui('deleteProperty', { id: selectedHouse.id }) as { success: boolean }
                                            if (result?.success) {
                                                setHouses((prev) => prev.filter((h) => h.id !== selectedHouse.id))
                                                setSelectedHouseId(null)
                                                setSelectedUnitId(null)
                                                setViewMode('properties')
                                            }
                                        } catch (err) {
                                            console.error('Failed to delete property:', err)
                                        }
                                    }}
                                    className="inline-flex items-center justify-center rounded-md border border-red-500/60 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60"
                                >
                                    Delete property
                                </button>
                            )}
                        </div>

                        {houses.length === 0 ? (
                            <p className="text-xs text-sidebar-foreground/60">
                                No properties yet. Click &quot;Create new property&quot; to add one.
                            </p>
                        ) : (
                            <ul className="space-y-2">
                                {houses.map((house) => (
                                    <li
                                        key={house.id}
                                        className="rounded-md border border-sidebar-border bg-sidebar-accent/10"
                                    >
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setSelectedHouseId(house.id)
                                                if (house.type === 'apartment' && house.units?.length) {
                                                    setViewMode('units')
                                                    setSelectedUnitId(null)
                                                } else if (house.type === 'house') {
                                                    setViewMode('houseForm')
                                                } else {
                                                    setViewMode('properties')
                                                    setSelectedUnitId(null)
                                                }
                                            }}
                                            className={[
                                                'flex w-full flex-col gap-1 px-3 py-2 text-left rounded-md cursor-pointer',
                                                'transition-colors duration-150',
                                                selectedHouseId === house.id
                                                    ? 'bg-sidebar-accent/30'
                                                    : 'bg-transparent hover:bg-sidebar-accent/20',
                                            ].join(' ')}
                                        >
                                            <div className="flex items-center justify-between gap-2">
                                                <p className="text-sm font-medium">{house.name}</p>
                                                {house.type && (
                                                    <span className="inline-flex items-center rounded-full border border-sidebar-border/70 bg-sidebar-accent/10 px-2 py-0.5 text-[10px] font-medium text-sidebar-foreground/70">
                                                        {house.type === 'house' ? 'House' : 'Complex'}
                                                    </span>
                                                )}
                                            </div>
                                            {house.address && (
                                                <p className="text-xs text-sidebar-foreground/70">{house.address}</p>
                                            )}
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}

                    </>
                )}
            </div>

            <ConfirmDialog
                open={showDeleteConfirm}
                title="Delete Property"
                message={`Are you sure you want to delete "${selectedHouse?.name}"? This action cannot be undone.`}
                confirmText="Delete"
                cancelText="Cancel"
                variant="danger"
                onConfirm={confirmDelete}
                onCancel={() => setShowDeleteConfirm(false)}
            />
        </SideBar>
    )
}


