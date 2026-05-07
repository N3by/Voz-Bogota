import { useEffect, useRef, useState } from 'react'
import api from '../../services/api'
import './MapScreen.css'

const BOGOTA_CENTER = [4.6097, -74.0817]
const BOGOTA_ZOOM = 11

export default function MapScreen() {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let map = null

    const initMap = async () => {
      const L = (await import('leaflet')).default
      await import('leaflet.heat')

      if (mapInstanceRef.current) return

      map = L.map(mapRef.current, {
        center: BOGOTA_CENTER,
        zoom: BOGOTA_ZOOM,
        zoomControl: true,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap',
        maxZoom: 18,
      }).addTo(map)

      mapInstanceRef.current = map

      try {
        const { data } = await api.get('/surveys/heatmap/public')
        const points = data
          .filter((d) => d.intensidad > 0)
          .map((d) => [d.lat, d.lng, Math.min(d.intensidad / 10, 1)])

        if (points.length > 0) {
          L.heatLayer(points, {
            radius: 35,
            blur: 25,
            maxZoom: 13,
            gradient: { 0.2: '#FFEB3B', 0.5: '#FF9800', 1.0: '#C8102E' },
          }).addTo(map)
        }

        data.forEach((d) => {
          if (d.intensidad > 0) {
            L.circleMarker([d.lat, d.lng], {
              radius: 6,
              fillColor: '#C8102E',
              color: '#fff',
              weight: 2,
              opacity: 1,
              fillOpacity: 0.9,
            })
              .bindPopup(`<b>${d.localidad}</b><br>${d.intensidad} participaciones`)
              .addTo(map)
          }
        })
      } catch {
        // El endpoint de heatmap requiere admin; ciudadano solo ve el mapa base
      } finally {
        setLoading(false)
      }
    }

    initMap()

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="map-screen screen">
      <div className="map-screen__header">
        <h1 className="map-screen__title">Mapa de Bogotá</h1>
        <p className="text-muted">Participación por localidad</p>
      </div>
      <div className="map-screen__container">
        {loading && (
          <div className="map-screen__loading">
            <span>Cargando mapa...</span>
          </div>
        )}
        <div ref={mapRef} className="map-screen__map" />
      </div>
    </div>
  )
}
