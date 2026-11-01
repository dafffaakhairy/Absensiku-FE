"use client";

import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api";

type PreviewResponse = {
    requires_confirmation: boolean;
    worked_minutes: number;
    remaining_minutes: number;
    minimum_work_minutes: number;
};

function formatDuration(minutes: number) {
    const safeMinutes = Math.max(0, minutes);
    const hours = Math.floor(safeMinutes / 60);
    const remaining = safeMinutes % 60;

    return `${hours} jam ${remaining} menit`;
}

export default function AttendanceCheckoutPage() {
    const router = useRouter();

    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const [showPhotoModal, setShowPhotoModal] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [showWorkWarning, setShowWorkWarning] = useState(false);
    const [workPreview, setWorkPreview] =
        useState<PreviewResponse | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [modalToast, setModalToast] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const cameraRequestRef = useRef(0);

    // Ambil lokasi GPS saat halaman dibuka.
    useEffect(() => {
        let cancelled = false;

        if (!navigator.geolocation) {
            setError("Browser tidak mendukung lokasi GPS.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                if (cancelled) return;

                setLatitude(position.coords.latitude);
                setLongitude(position.coords.longitude);
            },
            (geoError) => {
                if (cancelled) return;

                if (geoError.code === 1) {
                    setError(
                        "Izin lokasi ditolak. Aktifkan izin lokasi browser."
                    );
                } else if (geoError.code === 3) {
                    setError(
                        "Waktu pengambilan lokasi habis. Silakan coba lagi."
                    );
                } else {
                    setError(
                        "Lokasi tidak ditemukan. Pastikan GPS aktif."
                    );
                }
            },
            {
                enableHighAccuracy: true,
                timeout: 30000,
                maximumAge: 5000,
            },
        );

        return () => {
            cancelled = true;
        };
    }, []);

    // Preview foto.
    useEffect(() => {
        if (!photo) {
            setPhotoPreview("");
            return;
        }

        const url = URL.createObjectURL(photo);
        setPhotoPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [photo]);

    // Aktifkan kamera depan.
    const startCamera = useCallback(async () => {
        const requestId = ++cameraRequestRef.current;

        setCameraError("");
        setCameraReady(false);

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: "user" },
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                },
                audio: false,
            });

            if (requestId !== cameraRequestRef.current) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            const video = videoRef.current;

            if (!video) {
                stream.getTracks().forEach((track) => track.stop());
                return;
            }

            streamRef.current = stream;
            video.srcObject = stream;

            await new Promise<void>((resolve, reject) => {
                if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                    resolve();
                    return;
                }

                video.addEventListener("loadedmetadata", () => resolve(), {
                    once: true,
                });

                video.addEventListener(
                    "error",
                    () => reject(new Error("Video kamera gagal dimuat.")),
                    { once: true }
                );
            });

            if (requestId !== cameraRequestRef.current) return;

            await video.play();

            if (requestId === cameraRequestRef.current) {
                setCameraReady(true);
            }
        } catch (err) {
            if (requestId !== cameraRequestRef.current) return;

            const exception = err as DOMException;

            if (exception.name === "NotAllowedError") {
                setCameraError(
                    "Izin kamera ditolak. Aktifkan izin kamera pada browser."
                );
            } else if (exception.name === "NotFoundError") {
                setCameraError("Kamera tidak ditemukan.");
            } else if (exception.name === "NotReadableError") {
                setCameraError(
                    "Kamera sedang digunakan aplikasi lain. Tutup aplikasi tersebut lalu coba lagi."
                );
            } else {
                setCameraError(
                    "Kamera tidak dapat diakses. Periksa izin kamera lalu coba lagi."
                );
            }
        }
    }, []);

    useEffect(() => {
        void startCamera();

        return () => {
            cameraRequestRef.current++;

            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;

            if (videoRef.current) {
                videoRef.current.pause();
                videoRef.current.srcObject = null;
            }
        };
    }, [startCamera]);

    function handleCapturePhoto() {
        const video = videoRef.current;

        if (
            !video ||
            !cameraReady ||
            video.videoWidth === 0 ||
            video.videoHeight === 0
        ) {
            setCameraError("Kamera belum siap. Silakan coba lagi.");
            return;
        }

        setCameraError("");
        setError("");

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const context = canvas.getContext("2d");

        if (!context) {
            setCameraError("Gagal mengambil foto.");
            return;
        }

        context.drawImage(video, 0, 0, canvas.width, canvas.height);

        canvas.toBlob(
            (blob) => {
                if (!blob) {
                    setCameraError("Gagal memproses foto.");
                    return;
                }

                if (blob.size > 5 * 1024 * 1024) {
                    setCameraError("Ukuran foto maksimal 5 MB.");
                    return;
                }

                setPhoto(
                    new File([blob], "selfie-checkout.jpg", {
                        type: "image/jpeg",
                    })
                );

                setModalToast(null);
                setShowPhotoModal(true);
            },
            "image/jpeg",
            0.9
        );
    }

    function handleRetakePhoto() {
        setShowPhotoModal(false);
        setPhoto(null);
        setModalToast(null);
        setError("");
    }


    async function submitAttendance() {
        if (
            !photo ||
            latitude === null ||
            longitude === null
        ) {
            setModalToast({
                type: "error",
                message: "Foto selfie dan lokasi GPS wajib tersedia.",
            });
            return;
        }

        if (submitting || loading) return;

        setLoading(true);
        setModalToast(null);
        setError("");

        try {
            const preview = await apiFetch<PreviewResponse>(
                "/attendance/check-out/preview"
            );

            if (preview.requires_confirmation) {
                setWorkPreview(preview);
                setShowWorkWarning(true);
                return;
            }

            await sendCheckout();
        } catch (err) {
            setModalToast({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Gagal memeriksa jam kerja.",
            });
        } finally {
            setLoading(false);
        }
    }

    async function sendCheckout() {
        if (
            !photo ||
            latitude === null ||
            longitude === null ||
            submitting
        ) {
            return;
        }

        setSubmitting(true);
        setLoading(true);
        setModalToast(null);

        try {
            const formData = new FormData();
            formData.append("photo", photo);
            formData.append("latitude", String(latitude));
            formData.append("longitude", String(longitude));

            await apiFetch("/attendance/check-out", {
                method: "POST",
                body: formData,
            });

            setShowWorkWarning(false);

            setModalToast({
                type: "success",
                message:
                    "Check-out berhasil! Mengalihkan ke dashboard...",
            });

            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;

            window.setTimeout(() => {
                window.location.replace("/dashboard");
            }, 1500);
        } catch (err) {
            setModalToast({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Check-out gagal. Silakan coba kembali.",
            });
        } finally {
            setLoading(false);
            setSubmitting(false);
        }
    }


    return (
        <AuthGuard allowedRole="employee">
            <main className="attendance-page">
                <header className="attendance-page-header">
                    <button
                        type="button"
                        className="attendance-back-button"
                        onClick={() =>
                            window.location.replace("/dashboard")
                        }
                        disabled={loading}
                    >
                        ← Kembali
                    </button>

                    <div>
                        <p className="attendance-eyebrow">
                            ABSENSIKU · PRESENSI
                        </p>
                        <h1>Konfirmasi Check Out</h1>
                        <p className="attendance-subtitle">
                            Ambil foto selfie untuk menyelesaikan absensi pulang.
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
                                <h2>Foto selfie</h2>
                                <p>Posisikan wajah di tengah kamera.</p>
                            </div>
                        </div>

                        <div className="attendance-camera">
                            <div className="attendance-camera-frame">
                                <video
                                    ref={videoRef}
                                    autoPlay
                                    muted
                                    playsInline
                                    className="attendance-camera-preview"
                                />

                                {!cameraReady && !cameraError && (
                                    <div className="attendance-camera-overlay">
                                        <span className="attendance-camera-spinner" />
                                        <p>Mengaktifkan kamera depan...</p>
                                    </div>
                                )}
                            </div>

                            {cameraError && (
                                <div className="attendance-alert" role="alert">
                                    <p>{cameraError}</p>
                                    <button
                                        type="button"
                                        onClick={() => void startCamera()}
                                    >
                                        Coba Aktifkan Kamera
                                    </button>
                                </div>
                            )}

                            <button
                                type="button"
                                className="attendance-checkin-button attendance-capture-button"
                                disabled={!cameraReady || loading}
                                onClick={handleCapturePhoto}
                            >
                                <span aria-hidden="true">◎</span>
                                Ambil Foto Selfie
                            </button>
                        </div>
                    </div>

                    <aside className="attendance-details-panel">
                        <div className="attendance-panel-heading">
                            <div>
                                <h2>Ringkasan absensi</h2>
                                <p>Periksa lokasi sebelum check-out.</p>
                            </div>
                        </div>

                        <div className="attendance-info-row">
                            <span>Jenis absensi</span>
                            <strong>Check Out</strong>
                        </div>

                        <div className="attendance-info-row">
                            <span>Latitude</span>
                            <strong>
                                {latitude === null
                                    ? "Mengambil lokasi..."
                                    : latitude.toFixed(6)}
                            </strong>
                        </div>

                        <div className="attendance-info-row">
                            <span>Longitude</span>
                            <strong>
                                {longitude === null
                                    ? "Mengambil lokasi..."
                                    : longitude.toFixed(6)}
                            </strong>
                        </div>

                        <div className="attendance-coordinates">
                            <span>Status foto</span>
                            <strong>
                                {photo
                                    ? "Foto sudah diambil"
                                    : "Menunggu foto selfie"}
                            </strong>
                        </div>

                        <p className="attendance-small-note">
                            Pastikan foto jelas dan lokasi GPS tersedia.
                        </p>
                    </aside>
                </section>

                {showPhotoModal && photoPreview && (
                    <div
                        className="attendance-photo-modal-backdrop"
                        role="presentation"
                    >
                        <section
                            className="attendance-photo-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="attendance-photo-modal-title"
                        >
                            <div className="attendance-photo-modal-header">
                                <div className="attendance-photo-modal-icon">
                                    ✓
                                </div>

                                <h2 id="attendance-photo-modal-title">
                                    Periksa Foto Selfie
                                </h2>

                                {modalToast && (
                                    <div
                                        className={`attendance - modal - toast attendance - modal - toast--${modalToast.type} `}
                                        role="alert"
                                        aria-live="assertive"
                                    >
                                        <span className="attendance-modal-toast__icon">
                                            {modalToast.type === "success"
                                                ? "✓"
                                                : "!"}
                                        </span>
                                        <span>{modalToast.message}</span>
                                    </div>
                                )}

                                <p>
                                    Pastikan wajah terlihat jelas sebelum
                                    mengirim absensi pulang.
                                </p>
                            </div>

                            <div className="attendance-photo-modal-image-wrap">
                                <img
                                    src={photoPreview}
                                    alt="Hasil foto selfie untuk check-out"
                                    className="attendance-photo-modal-image"
                                />
                            </div>

                            <div className="attendance-photo-modal-actions">
                                <button
                                    type="button"
                                    className="attendance-retake-button"
                                    disabled={
                                        loading ||
                                        modalToast?.type === "success"
                                    }
                                    onClick={handleRetakePhoto}
                                >
                                    ↻ Coba Lagi
                                </button>

                                <button
                                    type="button"
                                    className="attendance-modal-submit"
                                    onClick={submitAttendance}
                                    disabled={
                                        loading ||
                                        modalToast?.type === "success"
                                    }
                                >
                                    {loading
                                        ? "Mengirim absensi..."
                                        : modalToast?.type === "success"
                                            ? "Check-Out Berhasil"
                                            : "Gunakan Foto & Submit"}
                                </button>
                            </div>

                            {loading && (
                                <p className="attendance-modal-loading">
                                    Sedang mengirim absensi, mohon tunggu...
                                </p>
                            )}
                        </section>
                    </div>
                )}


                {showWorkWarning && workPreview && (
                    <div
                        className="attendance-photo-modal-backdrop"
                        role="presentation"
                    >
                        <section
                            className="attendance-photo-modal attendance-work-warning-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="work-warning-title"
                        >
                            <div className="attendance-photo-modal-header">
                                <div className="attendance-photo-modal-icon">
                                    !
                                </div>

                                <h2 id="work-warning-title">
                                    Jam Kerja Belum Mencapai 9 Jam
                                </h2>

                                <p>
                                    Waktu kerja kamu belum memenuhi target harian.
                                    Apakah kamu tetap ingin melakukan check-out?
                                </p>
                            </div>

                            <div className="attendance-work-warning-summary">
                                <div>
                                    <span>Total jam kerja</span>
                                    <strong>
                                        {formatDuration(workPreview.worked_minutes)}
                                    </strong>
                                </div>

                                <div>
                                    <span>Target jam kerja</span>
                                    <strong>
                                        {formatDuration(
                                            workPreview.minimum_work_minutes
                                        )}
                                    </strong>
                                </div>

                                <div>
                                    <span>Kekurangan waktu</span>
                                    <strong>
                                        {formatDuration(workPreview.remaining_minutes)}
                                    </strong>
                                </div>
                            </div>

                            <div className="attendance-photo-modal-actions">
                                <button
                                    type="button"
                                    className="attendance-retake-button"
                                    disabled={loading}
                                    onClick={() => setShowWorkWarning(false)}
                                >
                                    Batal
                                </button>

                                <button
                                    type="button"
                                    className="attendance-modal-submit"
                                    disabled={loading}
                                    onClick={() => void sendCheckout()}
                                >
                                    {loading
                                        ? "Memproses..."
                                        : "Ya, Tetap Check-Out"}
                                </button>
                            </div>
                        </section>
                    </div>
                )}

            </main>
        </AuthGuard>
    );
}
