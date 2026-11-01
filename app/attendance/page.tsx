
"use client";

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api";

import dynamic from "next/dynamic";

const AttendanceMap = dynamic(
    () => import("@/components/AttendanceMap"),
    {
        ssr: false,
        loading: () => (
            <div className="attendance-map attendance-map-loading">
                Memuat peta...
            </div>
        ),
    }
);
type Coordinates = {
    latitude: number;
    longitude: number;
};

type Schedule = {
    name?: string;
    office_latitude: number | string | null;
    office_longitude: number | string | null;
    geofence_radius_meters: number | string;
    start_time?: string;
    end_time?: string;
};

function distanceInMeters(a: Coordinates, b: Coordinates) {
    const earthRadius = 6371000;
    const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

    const dLat = toRadians(b.latitude - a.latitude);
    const dLng = toRadians(b.longitude - a.longitude);
    const lat1 = toRadians(a.latitude);
    const lat2 = toRadians(b.latitude);

    const value =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1) *
        Math.cos(lat2) *
        Math.sin(dLng / 2) ** 2;

    return 2 * earthRadius * Math.asin(Math.sqrt(value));
}

export default function AttendancePage() {
    const router = useRouter();

    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [userLocation, setUserLocation] = useState<Coordinates | null>(null);
    const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null);
    const [loadingSchedule, setLoadingSchedule] = useState(true);
    const [locating, setLocating] = useState(false);
    const [error, setError] = useState("");
    const [fakeGpsDetected, setFakeGpsDetected] = useState(false);
    const [toastMessage, setToastMessage] = useState("");

    const lastLocationRef = useRef<{
        latitude: number;
        longitude: number;
        accuracy: number;
        timestamp: number;
    } | null>(null);
    const [locationMessage, setLocationMessage] = useState(
        "Izinkan akses lokasi untuk melihat posisi kamu.",
    );

    useEffect(() => {
        let cancelled = false;


        async function loadSchedule() {
            try {
                const result = await apiFetch<{
                    data: Schedule;
                    message?: string;
                }>("/attendance/schedule");

                if (!result?.data) {
                    throw new Error(
                        result?.message || "Data jadwal kantor tidak ditemukan.",
                    );
                }

                if (!cancelled) {
                    setSchedule(result.data);
                }
            } catch (err) {
                if (!cancelled) {
                    setError(
                        err instanceof Error
                            ? err.message
                            : "Jadwal kantor tidak dapat dimuat.",
                    );
                }
            } finally {
                if (!cancelled) {
                    setLoadingSchedule(false);
                }
            }
        }

        void loadSchedule();

        return () => {
            cancelled = true;
        };
    }, []);

    const officeLocation = useMemo<Coordinates | null>(() => {
        if (!schedule) return null;

        const latitude = Number(schedule.office_latitude);
        const longitude = Number(schedule.office_longitude);

        if (
            schedule.office_latitude == null ||
            schedule.office_longitude == null ||
            !Number.isFinite(latitude) ||
            !Number.isFinite(longitude) ||
            Math.abs(latitude) > 90 ||
            Math.abs(longitude) > 180
        ) {
            return null;
        }

        return { latitude, longitude };
    }, [schedule]);

    const radiusMeters = Math.max(
        0,
        Number(schedule?.geofence_radius_meters ?? 100) || 100,
    );

    const distance = useMemo(() => {
        if (!userLocation || !officeLocation) return null;
        return distanceInMeters(userLocation, officeLocation);
    }, [userLocation, officeLocation]);

    const insideRadius =
        distance !== null && distance <= radiusMeters;

    const getMyLocation = useCallback(() => {
        setError("");

        if (!navigator.geolocation) {
            setError("Browser ini tidak mendukung GPS/geolocation.");
            return;
        }

        setLocating(true);
        setLocationMessage("Sedang mengambil lokasi GPS...");

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setUserLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                });
                setLocationAccuracy(position.coords.accuracy);
                setLocationMessage("Lokasi berhasil diperbarui.");
                setLocating(false);
            },
            (geoError) => {
                const messages: Record<number, string> = {
                    1: "Izin lokasi ditolak. Aktifkan izin lokasi di browser.",
                    2: "Lokasi belum tersedia. Coba aktifkan GPS perangkat.",
                    3: "Pengambilan lokasi terlalu lama. Silakan coba lagi.",
                };

                setError(
                    messages[geoError.code] ??
                    "Tidak dapat mengambil lokasi perangkat.",
                );
                setLocationMessage("Lokasi belum berhasil didapatkan.");
                setLocating(false);
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 5000,
            },
        );
    }, []);


    useEffect(() => {
        getMyLocation();
    }, [getMyLocation]);


    useEffect(() => {
        if (!navigator.geolocation) {
            return;
        }

        const MAX_SPEED_KMH = 50;
        const MIN_DISTANCE_METERS = 50;
        const MAX_INTERVAL_SECONDS = 300;

        const watchId = navigator.geolocation.watchPosition(
            (position) => {
                const current = {
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy,
                    timestamp: Date.now(),
                };

                const previous = lastLocationRef.current;

                if (previous) {
                    const elapsedSeconds =
                        (current.timestamp - previous.timestamp) / 1000;

                    if (
                        elapsedSeconds >= 1 &&
                        elapsedSeconds <= MAX_INTERVAL_SECONDS
                    ) {
                        const traveledMeters = distanceInMeters(
                            previous,
                            current,
                        );

                        // Kurangi jarak dengan toleransi akurasi GPS
                        // untuk mengurangi false positive akibat GPS yang bergeser.
                        const effectiveDistance = Math.max(
                            0,
                            traveledMeters -
                            previous.accuracy -
                            current.accuracy,
                        );

                        const speedKmh =
                            (effectiveDistance / elapsedSeconds) * 3.6;

                        if (
                            traveledMeters >= MIN_DISTANCE_METERS &&
                            speedKmh > MAX_SPEED_KMH
                        ) {
                            setFakeGpsDetected(true);
                            setToastMessage("MATIKAN FAKE GPS");
                        }
                    }
                }

                lastLocationRef.current = current;

                setUserLocation({
                    latitude: current.latitude,
                    longitude: current.longitude,
                });
                setLocationAccuracy(current.accuracy);
                setLocationMessage("Lokasi berhasil diperbarui.");
                setLocating(false);
            },
            (geoError) => {
                if (geoError.code === 1) {
                    setError(
                        "Izin lokasi ditolak. Aktifkan izin lokasi di browser.",
                    );
                } else if (geoError.code === 2) {
                    setError("Lokasi belum tersedia. Periksa GPS perangkat.");
                } else if (geoError.code === 3) {
                    setError("Pengambilan lokasi terlalu lama. Coba lagi.");
                }

                setLocating(false);
            },
            {
                enableHighAccuracy: false,
                maximumAge: 10000,
                timeout: 30000,
            },
        );

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, []);


    const handleCheckIn = () => {
        if (fakeGpsDetected) {
            setToastMessage("MATIKAN FAKE GPS");
            return;
        }
        if (!userLocation) {
            setError("Ambil lokasi GPS kamu terlebih dahulu.");
            return;
        }

        if (!officeLocation) {
            setError("Koordinat kantor belum dikonfigurasi.");
            return;
        }

        if (distance !== null && !insideRadius) {
            setError(
                `Kamu masih di luar radius kantor. Jarak saat ini ${Math.round(
                    distance,
                )} meter, sedangkan radius yang diizinkan ${radiusMeters} meter.`,
            );
            return;
        }

        router.push(
            `/attendance/confirm?type=check-in&lat=${encodeURIComponent(
                String(userLocation.latitude),
            )}&lng=${encodeURIComponent(String(userLocation.longitude))}`,
        );
    };

    useEffect(() => {
        if (!toastMessage) return;

        const timer = window.setTimeout(() => {
            setToastMessage("");
        }, 4000);

        return () => window.clearTimeout(timer);
    }, [toastMessage]);

    useEffect(() => {
        if (!toastMessage) return;

        const timer = window.setTimeout(() => {
            setToastMessage("");
        }, 4000);

        return () => window.clearTimeout(timer);
    }, [toastMessage]);

    return (
        <AuthGuard allowedRole="employee">
            <main className="attendance-page">
                {toastMessage && (
                    <div className="attendance-toast" role="alert">
                        <span>⚠</span>
                        <strong>{toastMessage}</strong>
                    </div>
                )}
                <header className="attendance-page-header">
                    <button
                        type="button"
                        className="attendance-back-button"
                        onClick={() => router.push("/dashboard")}
                    >
                        ← Dashboard
                    </button>

                    <div>
                        <p className="attendance-eyebrow">ABSENSIKU · PRESENSI</p>
                        <h1>Check In</h1>
                        <p className="attendance-subtitle">
                            Pastikan kamu berada di area kantor sebelum melakukan absensi.
                        </p>
                    </div>
                </header>

                {error && (
                    <div className="attendance-alert" role="alert">
                        <span>{error}</span>
                        <button type="button" onClick={() => setError("")}>
                            Tutup
                        </button>
                    </div>
                )}

                <section className="attendance-layout">
                    <div className="attendance-map-panel">
                        <div className="attendance-panel-heading">
                            <div>
                                <h2>Peta lokasi</h2>
                                <p>Lokasi kamu, kantor, dan radius absensi</p>
                            </div>

                            <button
                                type="button"
                                className="attendance-location-button"
                                onClick={getMyLocation}
                                disabled={locating}
                            >
                                {locating ? "Mencari..." : "◎ Ambil lokasi saya"}
                            </button>
                        </div>

                        {loadingSchedule ? (
                            <div className="attendance-map-loading">
                                Memuat jadwal kantor...
                            </div>
                        ) : (
                            <AttendanceMap
                                userLocation={userLocation}
                                officeLocation={officeLocation}
                                radiusMeters={radiusMeters}
                            />
                        )}

                        <div className="attendance-map-legend">
                            <span>
                                <i className="attendance-legend-dot attendance-legend-user" />
                                Lokasi kamu
                            </span>
                            <span>
                                <i className="attendance-legend-dot attendance-legend-office" />
                                Lokasi kantor
                            </span>
                            <span>
                                <i className="attendance-legend-circle" />
                                Radius kantor
                            </span>
                        </div>
                        <button
                            type="button"
                            className="attendance-checkin-button"
                            onClick={handleCheckIn}
                            disabled={
                                loadingSchedule ||
                                locating ||
                                fakeGpsDetected ||
                                !userLocation ||
                                !officeLocation ||
                                (distance !== null && !insideRadius)
                            }
                        >
                            Lanjutkan Check In <span>→</span>
                        </button>
                    </div>

                    <aside className="attendance-details-panel">
                        <div className="attendance-panel-heading">
                            <div>
                                <h2>Status lokasi</h2>
                                <p>Informasi GPS dan jarak ke kantor</p>
                            </div>
                        </div>

                        <div
                            className={`attendance-location-status ${insideRadius ? "is-inside" : userLocation ? "is-outside" : ""
                                }`}
                        >
                            <span className="attendance-status-icon">
                                {insideRadius ? "✓" : userLocation ? "!" : "◎"}
                            </span>
                            <div>
                                <strong>
                                    {insideRadius
                                        ? "Kamu berada dalam radius"
                                        : userLocation
                                            ? "Di luar radius kantor"
                                            : "Lokasi belum diketahui"}
                                </strong>
                                <p>{locationMessage}</p>
                            </div>
                        </div>

                        <div className="attendance-info-row">
                            <span>Jadwal kantor</span>
                            <strong>{schedule?.name || "Jadwal aktif"}</strong>
                        </div>

                        <div className="attendance-info-row">
                            <span>Radius absensi</span>
                            <strong>{radiusMeters} meter</strong>
                        </div>

                        <div className="attendance-info-row">
                            <span>Jarak ke kantor</span>
                            <strong>
                                {distance === null
                                    ? "—"
                                    : distance >= 1000
                                        ? `${(distance / 1000).toFixed(2)} km`
                                        : `${Math.round(distance)} meter`}
                            </strong>
                        </div>

                        <div className="attendance-info-row">
                            <span>Akurasi GPS</span>
                            <strong>
                                {locationAccuracy === null
                                    ? "—"
                                    : `±${Math.round(locationAccuracy)} meter`}
                            </strong>
                        </div>

                        {userLocation && (
                            <div className="attendance-coordinates">
                                <span>Koordinat kamu</span>
                                <code>
                                    {userLocation.latitude.toFixed(6)},{" "}
                                    {userLocation.longitude.toFixed(6)}
                                </code>
                            </div>
                        )}

                        {!officeLocation && !loadingSchedule && (
                            <p className="attendance-config-warning">
                                Koordinat kantor belum tersedia. Hubungi admin untuk
                                mengatur latitude dan longitude kantor.
                            </p>
                        )}



                        <p className="attendance-small-note">
                            Kamu akan diminta mengambil foto selfie pada halaman berikutnya.
                            Pastikan GPS aktif dan izin lokasi diberikan.
                        </p>
                    </aside>
                </section>
            </main>
        </AuthGuard>
    );
}
