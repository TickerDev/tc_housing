import { useEffect, useState } from 'react'
import Sidebar from './pages/Sidebar'
import ApartmentComplex from './pages/ApartmentComplex'
import MyApartments from './pages/MyApartments'
import HousePurchase from './pages/HousePurchase'
import { fetchNui } from './lib/fetchNui'
import { useNuiEvent } from './hooks/useNuiEvent'
import { Locale } from './locale'
import { Config } from './Config'
import { isEnvBrowser } from './isEnvWeb'

type Displaying = 'houses' | 'apartment_complex' | 'my_apartments' | 'house_purchase' | null
type HouseType = 'house' | 'apartment' | null
type House = {
  id: number
  name: string
  address?: string
  type: HouseType
}

type ApartmentUnit = {
  id: number
  name: string
  price: number
  rentPrice?: number
  status: 'owned' | 'rented' | 'available'
  isRentable: boolean
}

type ApartmentComplexData = {
  id: number
  name: string
  units: ApartmentUnit[]
}

type MyApartmentUnit = {
  id: number
  name: string
  price: number
  rentPrice?: number
  ownershipType: 'owner' | 'renter'
}

type MyApartmentsData = {
  id: number
  name: string
  units: MyApartmentUnit[]
}

type HouseData = {
  id: number
  unitId: number
  name: string
  address?: string
  price: number
  rentPrice?: number
  status: 'owned' | 'rented' | 'available'
  isRentable: boolean
}

export default function App() {
  const [displaying, setDisplaying] = useState<Displaying>(null)
  const [houses, setHouses] = useState<House[]>([])
  const [complexData, setComplexData] = useState<ApartmentComplexData | null>(null)
  const [myApartmentsData, setMyApartmentsData] = useState<MyApartmentsData | null>(null)
  const [houseData, setHouseData] = useState<HouseData | null>(null)
  const isBrowser = isEnvBrowser()
  useEffect(() => {
    console.log(displaying)
  }, [displaying])
  useEffect(() => {
    if (isBrowser) return
    try {
      fetchNui('loaded')
    } catch (error) {
      console.log(error)
    }
  }, [isBrowser])

  useNuiEvent(
    'init',
    (data: { locale: Record<string, string>; config: any }) => {
      try {
        for (const [name, key] of Object.entries(data.locale)) Locale[name] = key
        Object.keys(Config).forEach((key) => delete (Config as any)[key])
        Object.assign(Config, data.config)
      } catch (error) {
        console.log(error)
      }
    }
  )
  useNuiEvent('displaying', (response: any) => {
    console.log(response)
    console.log(JSON.stringify(response))
    setDisplaying(response.data.type)
    if (response.data.type === 'houses') {
      setHouses(response.data.houses)
    } else if (response.data.type === 'apartment_complex') {
      setComplexData(response.data.complex)
    } else if (response.data.type === 'my_apartments') {
      setMyApartmentsData(response.data.complex)
    } else if (response.data.type === 'house_purchase') {
      setHouseData(response.data.house)
    }
  })

  if (isBrowser) {
    if (!displaying) return null
    else if (displaying === 'houses') {
      return <Sidebar setDisplaying={setDisplaying} initialHouses={houses} />
    } else if (displaying === 'apartment_complex' && complexData) {
      return <ApartmentComplex complexData={complexData} setDisplaying={setDisplaying} />
    } else if (displaying === 'my_apartments' && myApartmentsData) {
      return <MyApartments complexData={myApartmentsData} setDisplaying={setDisplaying} />
    } else if (displaying === 'house_purchase' && houseData) {
      return <HousePurchase houseData={houseData} setDisplaying={setDisplaying} />
    }

    return null
  }
  if (!displaying) return null
  else if (displaying === 'houses') {
    return <Sidebar setDisplaying={setDisplaying} initialHouses={houses} />
  } else if (displaying === 'apartment_complex' && complexData) {
    return <ApartmentComplex complexData={complexData} setDisplaying={setDisplaying} />
  } else if (displaying === 'my_apartments' && myApartmentsData) {
    return <MyApartments complexData={myApartmentsData} setDisplaying={setDisplaying} />
  } else if (displaying === 'house_purchase' && houseData) {
    return <HousePurchase houseData={houseData} setDisplaying={setDisplaying} />
  }

}
