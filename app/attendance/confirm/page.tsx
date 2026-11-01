
"use client";

import {
    FormEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api";

type AttendanceType = "check-in";

export default function AttendanceConfirmPage() {
    const router = useRouter();

    const [type] = useState<AttendanceType>("check-in");
    const [latitude, setLatitude] = useState<number | null>(null);
    const [longitude, setLongitude] = useState<number | null>(null);

    const [photo, setPhoto] = useState<File | null>(null);
    const [photoPreview, setPhotoPreview] = useState("");
    const [showPhotoModal, setShowPhotoModal] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [toast, setToast] = useState("");
    const [success, setSuccess] = useState(false);

    const videoRef = useRef<HTMLVideoElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const cameraRequestRef = useRef(0);

    const [cameraReady, setCameraReady] = useState(false);
    const [cameraError, setCameraError] = useState("");
    const [modalToast, setModalToast] = useState<{
        type: "success" | "error";
        message: string;
    } | null>(null);

    // Validasi koordinat dari halaman sebelumnya.
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const rawLat = params.get("lat");
        const rawLng = params.get("lng");

        const lat = Number(rawLat);
        const lng = Number(rawLng);

        if (params.get("type") !== "check-in") {
            setError("Jenis absensi tidak valid.");
            return;
        }

        if (
            rawLat === null ||
            rawLng === null ||
            rawLat.trim() === "" ||
            rawLng.trim() === "" ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            Math.abs(lat) > 90 ||
            Math.abs(lng) > 180
        ) {
            setError(
                "Koordinat lokasi tidak valid. Silakan ambil lokasi ulang."
            );
            return;
        }

        setLatitude(lat);
        setLongitude(lng);
    }, []);

    // Membuat preview foto
    useEffect(() => {
        if (!photo) {
            setPhotoPreview("");
            return;
        }

        const url = URL.createObjectURL(photo);
        setPhotoPreview(url);

        return () => URL.revokeObjectURL(url);
    }, [photo]);

    useEffect(() => {
        if (!toast) return;

        const timer = window.setTimeout(() => setToast(""), 4000);
        return () => window.clearTimeout(timer);
    }, [toast]);

    // Aktifkan kamera depan secara otomatis.
    const startCamera = useCallback(async () => {
        const requestId = ++cameraRequestRef.current;

        setCameraError("");
        setCameraReady(false);

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;

        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                throw new Error("Browser tidak mendukung akses kamera.");
            }

            let stream: MediaStream;

            try {
                stream = await navigator.mediaDevices.getUserMedia({
                    video: {
                        facingMode: { ideal: "user" },
                        width: { ideal: 1280 },
                        height: { ideal: 720 },
                    },
                    audio: false,
                });
            } catch (err) {
                if (requestId !== cameraRequestRef.current) return;

                const cameraException = err as DOMException;

                if (
                    ["NotAllowedError", "NotFoundError", "NotReadableError"]
                        .includes(cameraException.name)
                ) {
                    throw err;
                }

                stream = await navigator.mediaDevices.getUserMedia({
                    video: true,
                    audio: false,
                });
            }

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

            const playVideo = async () => {
                if (requestId !== cameraRequestRef.current) return;

                try {
                    await video.play();

                    if (requestId === cameraRequestRef.current) {
                        setCameraReady(true);
                    }
                } catch (err) {
                    const playException = err as DOMException;

                    if (playException.name === "AbortError") return;

                    if (requestId === cameraRequestRef.current) {
                        setCameraError("Video kamera gagal diputar.");
                    }
                }
            };

            if (video.readyState >= HTMLMediaElement.HAVE_METADATA) {
                await playVideo();
            } else {
                video.addEventListener("loadedmetadata", playVideo, {
                    once: true,
                });
            }
        } catch (err) {
            if (requestId !== cameraRequestRef.current) return;

            console.error("Gagal mengaktifkan kamera:", err);

            const cameraException = err as DOMException;

            if (cameraException.name === "NotAllowedError") {
                setCameraError(
                    "Izin kamera ditolak. Aktifkan izin kamera pada browser."
                );
            } else if (cameraException.name === "NotFoundError") {
                setCameraError("Kamera tidak ditemukan.");
            } else if (cameraException.name === "NotReadableError") {
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

            const video = videoRef.current;

            if (video) {
                video.pause();
                video.srcObject = null;
            }
        };
    }, [startCamera]);

    // Ambil foto, lalu langsung tampilkan popup konfirmasi.
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
                    setCameraError(
                        "Ukuran foto melebihi 5 MB. Silakan coba lagi."
                    );
                    return;
                }

                const file = new File([blob], "selfie.jpg", {
                    type: "image/jpeg",
                });

                setPhoto(file);
                setShowPhotoModal(true);
            },
            "image/jpeg",
            0.9
        );
    }

    // Ambil ulang tanpa mematikan kamera.
    function handleRetakePhoto() {
        setShowPhotoModal(false);
        setPhoto(null);
        setModalToast(null);
        setError("");
    }
    // Kirim absensi hanya setelah tombol Submit ditekan.
    async function submitAttendance() {
        if (
            !photo ||
            latitude === null ||
            longitude === null
        ) {
            setModalToast({
                type: "error",
                message: "Foto selfie dan lokasi wajib tersedia.",
            });
            return;
        }

        setLoading(true);
        setModalToast(null);
        setError("");

        try {
            const formData = new FormData();
            formData.append("photo", photo);
            formData.append("latitude", String(latitude));
            formData.append("longitude", String(longitude));

            await apiFetch("/attendance/check-in", {
                method: "POST",
                body: formData,
            });

            setModalToast({
                type: "success",
                message: "Absensi berhasil dikirim! Mengalihkan ke dashboard...",
            });

            // Hentikan kamera.
            streamRef.current?.getTracks().forEach((track) => track.stop());
            streamRef.current = null;

            // Beri waktu agar toast sukses terbaca, lalu hard refresh ke dashboard.
            window.setTimeout(() => {
                window.location.replace("/dashboard");
            }, 1500);
        } catch (err) {
            setModalToast({
                type: "error",
                message:
                    err instanceof Error
                        ? err.message
                        : "Absensi gagal dikirim. Silakan coba lagi.",
            });
        } finally {
            setLoading(false);
        }
    }

    function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        void submitAttendance();
    }

    return (
        <AuthGuard allowedRole="employee">
            <main className="attendance-page">
                {toast && (
                    <div className="attendance-toast" role="status">
                        <span>✓</span>
                        <strong>{toast}</strong>
                    </div>
                )}

                <header className="attendance-page-header">
                    <button
                        type="button"
                        className="attendance-back-button"
                        onClick={() => window.location.href = "/attendance"}
                        disabled={loading || success}
                    >
                        ← Kembali
                    </button>

                    <div>
                        <p className="attendance-eyebrow">
                            ABSENSIKU · PRESENSI
                        </p>
                        <h1>Konfirmasi Check In</h1>
                        <p className="attendance-subtitle">
                            Ambil foto selfie untuk menyelesaikan absensi.
                        </p>
                    </div>
                </header>

                {error && (
                    <div className="attendance-alert" role="alert">
                        <span>{error}</span>
                        <button
                            type="button"
                            onClick={() => setError("")}
                        >
                            Tutup
                        </button>
                    </div>
                )}

                {success ? (
                    <section className="content-card attendance-confirm-card">
                        <div className="attendance-confirm-success">
                            <div className="attendance-success-icon">✓</div>
                            <h2>Check-in berhasil!</h2>
                            <p>
                                Absensi kamu berhasil dikirim ke server.
                            </p>
                            <button
                                type="button"
                                className="attendance-checkin-button"
                                onClick={() => router.replace("/dashboard")}
                            >
                                Kembali ke Dashboard →
                            </button>
                        </div>
                    </section>
                ) : (
                    <section className="attendance-layout">
                        <div className="attendance-map-panel">
                            <div className="attendance-panel-heading">
                                <div>
                                    <h2>Foto selfie</h2>
                                    <p>
                                        Posisikan wajah di tengah kamera.
                                    </p>
                                </div>
                            </div>

                            <form
                                id="attendance-confirm-form"
                                onSubmit={handleSubmit}
                            >
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
                                                <p>
                                                    Mengaktifkan kamera depan...
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {cameraError && (
                                        <div
                                            className="attendance-alert"
                                            role="alert"
                                        >
                                            <p>{cameraError}</p>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    void startCamera()
                                                }
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
                            </form>
                        </div>

                        <aside className="attendance-details-panel">
                            <div className="attendance-panel-heading">
                                <div>
                                    <h2>Ringkasan absensi</h2>
                                    <p>Periksa informasi lokasi kamu.</p>
                                </div>
                            </div>

                            <div className="attendance-info-row">
                                <span>Jenis absensi</span>
                                <strong>Check In</strong>
                            </div>

                            <div className="attendance-info-row">
                                <span>Latitude</span>
                                <strong>
                                    {latitude === null
                                        ? "Tidak tersedia"
                                        : latitude.toFixed(6)}
                                </strong>
                            </div>

                            <div className="attendance-info-row">
                                <span>Longitude</span>
                                <strong>
                                    {longitude === null
                                        ? "Tidak tersedia"
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
                                Setelah foto diambil, periksa hasilnya pada
                                popup sebelum mengirim absensi.
                            </p>
                        </aside>
                    </section>
                )}

                {/* Popup konfirmasi foto */}
                {showPhotoModal && photoPreview && !success && (
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
                                        className={`attendance-modal-toast attendance-modal-toast--${modalToast.type}`}
                                        role="alert"
                                        aria-live="assertive"
                                    >
                                        <span className="attendance-modal-toast__icon">
                                            {modalToast.type === "success" ? "✓" : "!"}
                                        </span>

                                        <span>{modalToast.message}</span>
                                    </div>
                                )}

                                <p>
                                    Pastikan wajah terlihat jelas sebelum
                                    mengirim absensi.
                                </p>
                            </div>

                            <div className="attendance-photo-modal-image-wrap">
                                <img
                                    src={photoPreview}
                                    alt="Hasil foto selfie untuk absensi"
                                    className="attendance-photo-modal-image"
                                />
                            </div>

                            <div className="attendance-photo-modal-actions">
                                <button
                                    type="button"
                                    className="attendance-retake-button"
                                    disabled={loading}
                                    onClick={handleRetakePhoto}
                                >
                                    ↻ Coba Lagi
                                </button>

                                <button
                                    type="button"
                                    className="attendance-modal-submit"
                                    onClick={submitAttendance}
                                    disabled={loading || modalToast?.type === "success"}
                                >
                                    {loading
                                        ? "Mengirim absensi..."
                                        : modalToast?.type === "success"
                                            ? "Absensi Berhasil"
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
            </main>
        </AuthGuard>
    );
}
