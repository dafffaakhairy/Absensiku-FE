
"use client";

import { useEffect } from "react";
import L from "leaflet";
import {
    Circle,
    MapContainer,
    Marker,
    Popup,
    TileLayer,
    useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";

type Coordinates = {
    latitude: number;
    longitude: number;
};

type AttendanceMapProps = {
    userLocation: Coordinates | null;
    officeLocation: Coordinates | null;
    radiusMeters: number;
};

function MapViewport({
    userLocation,
    officeLocation,
}: Pick<AttendanceMapProps, "userLocation" | "officeLocation">) {
    const map = useMap();

    useEffect(() => {
        if (userLocation && officeLocation) {
            const bounds = L.latLngBounds(
                [userLocation.latitude, userLocation.longitude],
                [officeLocation.latitude, officeLocation.longitude],
            );

            map.fitBounds(bounds, { padding: [48, 48], maxZoom: 17 });
            return;
        }

        const location = userLocation ?? officeLocation;

        if (location) {
            map.setView([location.latitude, location.longitude], 16);
        }
    }, [map, userLocation, officeLocation]);

    return null;
}

const userIcon = L.divIcon({
    className: "attendance-map-icon-wrapper",
    html: '<div class="attendance-map-pin attendance-map-pin-user"><span></span></div>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
});

const officeIcon = L.divIcon({
    className: "attendance-map-icon-wrapper",
    html: '<div class="attendance-map-pin attendance-map-pin-office"><span>K</span></div>',
    iconSize: [36, 36],
    iconAnchor: [18, 18],
});

export default function AttendanceMap({
    userLocation,
    officeLocation,
    radiusMeters,
}: AttendanceMapProps) {
    const initialLocation =
        userLocation ?? officeLocation ?? { latitude: -2.5, longitude: 118 };

    return (
        <div className="attendance-map">
            <MapContainer
                center={[
                    initialLocation.latitude,
                    initialLocation.longitude,
                ]}
                zoom={userLocation || officeLocation ? 16 : 5}
                scrollWheelZoom
                className="attendance-map-canvas"
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                />

                {officeLocation && (
                    <>
                        <Circle
                            center={[
                                officeLocation.latitude,
                                officeLocation.longitude,
                            ]}
                            radius={radiusMeters}
                            pathOptions={{
                                color: "#2563eb",
                                fillColor: "#3b82f6",
                                fillOpacity: 0.13,
                                weight: 2,
                            }}
                        />
                        <Marker
                            position={[
                                officeLocation.latitude,
                                officeLocation.longitude,
                            ]}
                            icon={officeIcon}
                        >
                            <Popup>
                                <strong>Lokasi Kantor</strong>
                                <br />
                                Radius absensi: {radiusMeters} meter
                            </Popup>
                        </Marker>
                    </>
                )}

                {userLocation && (
                    <Marker
                        position={[userLocation.latitude, userLocation.longitude]}
                        icon={userIcon}
                    >
                        <Popup>
                            <strong>Lokasi Kamu</strong>
                            <br />
                            Posisi GPS perangkat saat ini
                        </Popup>
                    </Marker>
                )}

                <MapViewport
                    userLocation={userLocation}
                    officeLocation={officeLocation}
                />
            </MapContainer>
        </div>
    );
}
