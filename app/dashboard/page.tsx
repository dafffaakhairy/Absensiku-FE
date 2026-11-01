
"use client";

import {
    ChangeEvent,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api";
import { clearToken, User } from "@/lib/auth";

type Attendance = {
    id: number;
    work_date: string;
    check_in_at: string | null;
    check_out_at: string | null;
    check_in_photo_path?: string | null;
    check_out_photo_path?: string | null;
    status: string;
    notes?: string | null;
};

type TodayResponse = {
    data: Attendance | null;
};

type HistoryResponse = {
    data?: Attendance[] | { data?: Attendance[] };
    current_page?: number;
};

type PreviewResponse = {
    requires_confirmation: boolean;
    worked_minutes: number;
    remaining_minutes: number;
    minimum_work_minutes: number;
};

type ActionType = "check-in" | "check-out";

function getHistoryRows(response: HistoryResponse): Attendance[] {
    if (Array.isArray(response.data)) {
        return response.data;
    }

    if (
        response.data &&
        !Array.isArray(response.data) &&
        Array.isArray(response.data.data)
    ) {
        return response.data.data;
    }

    return [];
}

function formatTime(value: string | null | undefined) {
    if (!value) return "--:--";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "--:--";

    return new Intl.DateTimeFormat("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
        timeZone: "Asia/Jakarta",
    }).format(date);
}


function getPhotoUrl(path: string | null | undefined) {
    if (!path) return null;

    if (/^https?:\/\//i.test(path)) {
        return path;
    }

    return `/storage/${path.replace(/^\/+/, "")}`;
}


function formatDate(value: string) {
    const date = new Date(`${value.slice(0, 10)}T00:00:00`);

    return new Intl.DateTimeFormat("id-ID", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
    }).format(date);
}

function formatDuration(minutes: number) {
    const safeMinutes = Math.max(0, minutes);
    const hours = Math.floor(safeMinutes / 60);
    const remaining = safeMinutes % 60;

    return `${hours} jam ${remaining} menit`;
}

function calculateWorkDuration(
    checkIn: string | null,
    checkOut: string | null,
) {
    if (!checkIn || !checkOut) return "--";

    const checkInTime = new Date(checkIn).getTime();
    const checkOutTime = new Date(checkOut).getTime();

    if (
        Number.isNaN(checkInTime) ||
        Number.isNaN(checkOutTime) ||
        checkOutTime < checkInTime
    ) {
        return "--";
    }

    const totalMinutes =
        Math.floor((checkOutTime - checkInTime) / 60000);

    return formatDuration(Math.max(0, totalMinutes));
}

function statusLabel(status: string) {
    const labels: Record<string, string> = {
        present: "Hadir",
        late: "Terlambat",
        absent: "Tidak hadir",
        permission: "Izin",
        sick: "Sakit",
    };

    return labels[status] ?? status;
}

function statusClass(status: string) {
    if (status === "present") return "employee-status employee-status--present";
    if (status === "late") return "employee-status employee-status--late";

    return "employee-status employee-status--other";
}

export default function EmployeeDashboardPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [today, setToday] = useState<Attendance | null>(null);
    const [history, setHistory] = useState<Attendance[]>([]);
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState<ActionType | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);
    const [notice, setNotice] = useState("");
    const [error, setError] = useState("");
    const [currentDate, setCurrentDate] = useState("");
    const [currentYear, setCurrentYear] = useState<number | null>(null);

    const photoInputRef = useRef<HTMLInputElement>(null);
    const pendingActionRef = useRef<ActionType | null>(null);

    const loadDashboard = useCallback(async () => {
        setError("");

        try {
            const [meResponse, todayResponse, historyResponse] =
                await Promise.all([
                    apiFetch<{ user: User }>("/me"),
                    apiFetch<TodayResponse>("/attendance/today"),
                    apiFetch<HistoryResponse>("/attendance/history"),
                ]);

            setUser(meResponse.user);
            setToday(todayResponse.data ?? null);

            const rows = getHistoryRows(historyResponse);
            const todayDate = new Date();
            todayDate.setHours(0, 0, 0, 0);

            const fiveDaysAgo = new Date(todayDate);
            fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 4);

            const recentRows = rows
                .filter((item) => {
                    const date = new Date(
                        `${item.work_date.slice(0, 10)}T00:00:00`,
                    );

                    return date >= fiveDaysAgo && date <= todayDate;
                })
                .sort((a, b) =>
                    b.work_date.localeCompare(a.work_date),
                )
                .slice(0, 5);

            setHistory(recentRows);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal memuat data dashboard.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadDashboard();
    }, [loadDashboard]);

    useEffect(() => {
        const now = new Date();

        setCurrentDate(
            new Intl.DateTimeFormat("id-ID", {
                weekday: "long",
                day: "numeric",
                month: "long",
                year: "numeric",
                timeZone: "Asia/Jakarta",
            }).format(now),
        );

        setCurrentYear(
            Number(
                new Intl.DateTimeFormat("en-US", {
                    year: "numeric",
                    timeZone: "Asia/Jakarta",
                }).format(now),
            ),
        );
    }, []);


    function requestAttendance(type: ActionType) {
        setError("");
        setNotice("");

        if (type === "check-in") {
            router.push("/attendance");
            return;
        }

        // Check-out menggunakan halaman konfirmasi tersendiri.
        window.location.href = "/attendance/checkout";
    }


    async function handlePhotoSelected(
        event: ChangeEvent<HTMLInputElement>,
    ) {
        const file = event.target.files?.[0];
        const type = pendingActionRef.current;

        // Reset input agar foto yang sama dapat dipilih kembali.
        event.target.value = "";

        if (!file || !type) return;

        if (!file.type.startsWith("image/")) {
            setError("File harus berupa gambar.");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            setError("Ukuran foto maksimal 5 MB.");
            return;
        }

        setAction(type);
        setError("");
        setNotice("");

        try {
            if (!navigator.geolocation) {
                throw new Error(
                    "Browser tidak mendukung lokasi GPS.",
                );
            }

            const position = await new Promise<GeolocationPosition>(
                (resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(
                        resolve,
                        reject,
                        {
                            enableHighAccuracy: true,
                            timeout: 30000,
                            maximumAge: 5000,
                        },
                    );
                },
            ).catch((geoError: GeolocationPositionError) => {
                if (geoError.code === 1) {
                    throw new Error(
                        "Izin lokasi ditolak. Aktifkan izin lokasi browser untuk melakukan absensi.",
                    );
                }

                if (geoError.code === 3) {
                    throw new Error(
                        "Waktu pengambilan lokasi habis. Coba kembali.",
                    );
                }

                throw new Error(
                    "Lokasi tidak dapat ditemukan. Pastikan GPS aktif.",
                );
            });

            if (type === "check-out") {
                const preview = await apiFetch<PreviewResponse>(
                    "/attendance/check-out/preview",
                );

                if (preview.requires_confirmation) {
                    const confirmed = window.confirm(
                        `Jam kerja Anda baru ${formatDuration(
                            preview.worked_minutes,
                        )}. Target minimal ${formatDuration(
                            preview.minimum_work_minutes,
                        )}.\n\nAnda masih kurang ${formatDuration(
                            preview.remaining_minutes,
                        )} dari target. Tetap lanjutkan absen pulang?`,
                    );

                    if (!confirmed) return;
                }
            }

            const formData = new FormData();

            formData.append(
                "latitude",
                String(position.coords.latitude),
            );
            formData.append(
                "longitude",
                String(position.coords.longitude),
            );
            formData.append("photo", file);

            await apiFetch(
                type === "check-in"
                    ? "/attendance/check-in"
                    : "/attendance/check-out",
                {
                    method: "POST",
                    body: formData,
                },
            );

            setNotice(
                type === "check-in"
                    ? "Berhasil check-in. Selamat bekerja!"
                    : "Berhasil check-out. Hati-hati di perjalanan!",
            );

            await loadDashboard();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Absensi gagal. Silakan coba kembali.",
            );
        } finally {
            setAction(null);
            pendingActionRef.current = null;
        }
    }

    async function handleLogout() {
        setLoggingOut(true);

        try {
            await apiFetch("/logout", {
                method: "POST",
            });
        } catch {
            // Tetap hapus token lokal jika request gagal.
        } finally {
            clearToken();
            router.replace("/login");
        }
    }

    const checkedIn = Boolean(today?.check_in_at);
    const checkedOut = Boolean(today?.check_out_at);

    return (
        <AuthGuard allowedRole="employee">
            <main className="employee-page">
                <header className="employee-topbar">
                    <div className="employee-brand">
                        <div className="employee-brand-icon">A</div>
                        <div>
                            <p className="employee-brand-name">
                                ABSENSIKU
                            </p>
                            <p className="employee-brand-caption">
                                Portal Kehadiran
                            </p>
                        </div>
                    </div>

                    <div className="employee-topbar-right">
                        <div className="employee-user">
                            <div className="employee-avatar">
                                {(user?.name ?? "K")
                                    .trim()
                                    .charAt(0)
                                    .toUpperCase()}
                            </div>
                            <div className="employee-user-info">
                                <strong>
                                    {user?.name ?? "Karyawan"}
                                </strong>
                                <span>
                                    {user?.employee_number ?? "Karyawan"}
                                </span>
                            </div>
                        </div>

                        <button
                            type="button"
                            className="employee-logout"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            {loggingOut ? "Keluar..." : "Keluar"}
                        </button>
                    </div>
                </header>

                <div className="employee-container">
                    <section className="employee-welcome">
                        <div>
                            <p className="employee-overline">
                                DASHBOARD KARYAWAN
                            </p>
                            <h1>
                                Halo, {user?.name?.split(" ")[0] ?? "Karyawan"}!
                            </h1>
                            <p>
                                Pantau kehadiran dan catat aktivitas
                                kerja Anda hari ini.
                            </p>
                        </div>

                        <div className="employee-date">
                            <span className="employee-date-dot" />
                            {currentDate || "Memuat tanggal..."}
                        </div>
                    </section>

                    {notice && (
                        <div
                            className="employee-alert employee-alert--success"
                            role="status"
                        >
                            <span>✓</span>
                            {notice}
                            <button
                                type="button"
                                onClick={() => setNotice("")}
                                aria-label="Tutup pesan"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    {error && (
                        <div
                            className="employee-alert employee-alert--error"
                            role="alert"
                        >
                            <span>!</span>
                            {error}
                            <button
                                type="button"
                                onClick={() => setError("")}
                                aria-label="Tutup pesan"
                            >
                                ×
                            </button>
                        </div>
                    )}

                    <section className="employee-section">
                        <div className="employee-section-heading">
                            <div>
                                <h2>Absensi hari ini</h2>
                                <p>
                                    Pastikan Anda mencatat waktu masuk
                                    dan pulang.
                                </p>
                            </div>
                            <span className="employee-live-badge">
                                <span />
                                Hari ini
                            </span>
                        </div>

                        <div className="employee-attendance-grid">
                            <article className="employee-time-card employee-time-card--in">
                                <div className="employee-time-card-top">
                                    <div className="employee-time-icon">
                                        <svg
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 3v12m-5-5 5 5 5-5M5 19h14" />
                                        </svg>
                                    </div>
                                    <span className="employee-time-label">
                                        JAM MASUK
                                    </span>
                                    <span
                                        className={`employee-mini-status ${checkedIn
                                            ? "is-done"
                                            : "is-pending"
                                            }`}
                                    >
                                        {checkedIn ? "Tercatat" : "Belum"}
                                    </span>
                                </div>

                                <div className="employee-time-value">
                                    {loading
                                        ? "--:--"
                                        : formatTime(today?.check_in_at)}
                                    <span>WIB</span>
                                </div>

                                <p className="employee-time-description">
                                    {checkedIn
                                        ? "Waktu check-in Anda hari ini."
                                        : "Anda belum melakukan check-in."}
                                </p>
                            </article>

                            <article className="employee-time-card employee-time-card--out">
                                <div className="employee-time-card-top">
                                    <div className="employee-time-icon">
                                        <svg
                                            viewBox="0 0 24 24"
                                            aria-hidden="true"
                                        >
                                            <path d="M12 3v12m-5-5 5 5 5-5M5 19h14" />
                                        </svg>
                                    </div>
                                    <span className="employee-time-label">
                                        JAM PULANG
                                    </span>
                                    <span
                                        className={`employee-mini-status ${checkedOut
                                            ? "is-done"
                                            : "is-pending"
                                            }`}
                                    >
                                        {checkedOut ? "Tercatat" : "Belum"}
                                    </span>
                                </div>

                                <div className="employee-time-value">
                                    {loading
                                        ? "--:--"
                                        : formatTime(today?.check_out_at)}
                                    <span>WIB</span>
                                </div>

                                <p className="employee-time-description">
                                    {checkedOut
                                        ? "Waktu check-out Anda hari ini."
                                        : "Jam pulang akan tercatat setelah check-out."}
                                </p>
                            </article>
                        </div>

                        <div className="employee-action-panel">
                            <div className="employee-action-copy">
                                <h3>
                                    {checkedOut
                                        ? "Absensi hari ini selesai"
                                        : checkedIn
                                            ? "Jangan lupa absen pulang"
                                            : "Mulai hari kerja Anda"}
                                </h3>
                                <p>
                                    {checkedOut
                                        ? "Check-in dan check-out Anda sudah tercatat."
                                        : checkedIn
                                            ? "Selesaikan pekerjaan Anda dan catat waktu pulang."
                                            : "Gunakan lokasi GPS dan foto selfie untuk mencatat kehadiran."}
                                </p>
                            </div>

                            <div className="employee-action-buttons">
                                <button
                                    type="button"
                                    className="employee-action-button employee-action-button--in"
                                    onClick={() => requestAttendance("check-in")}
                                    disabled={
                                        loading ||
                                        action !== null ||
                                        checkedIn ||
                                        checkedOut
                                    }
                                >
                                    <span className="employee-button-icon">↘</span>
                                    {checkedIn ? "Sudah Masuk" : "Masuk"}
                                </button>

                                <button
                                    type="button"
                                    className="employee-action-button employee-action-button--out"
                                    onClick={() =>
                                        requestAttendance("check-out")
                                    }
                                    disabled={
                                        loading ||
                                        action !== null ||
                                        !checkedIn ||
                                        checkedOut
                                    }
                                >
                                    <span className="employee-button-icon">
                                        ↗
                                    </span>
                                    {action === "check-out"
                                        ? "Memproses..."
                                        : checkedOut
                                            ? "Sudah Pulang"
                                            : "Pulang"}
                                </button>
                            </div>

                            <input
                                ref={photoInputRef}
                                className="employee-hidden-input"
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                capture="user"
                                onChange={handlePhotoSelected}
                                aria-label="Ambil foto selfie untuk absensi"
                            />
                        </div>
                    </section>

                    <section className="employee-section employee-history-section">
                        <div className="employee-section-heading">
                            <div>
                                <h2>Riwayat absensi</h2>
                                <p>
                                    Catatan kehadiran selama 5 hari terakhir.
                                </p>
                            </div>
                            <span className="employee-history-count">
                                {history.length} catatan
                            </span>
                        </div>

                        <div className="employee-table-wrap">
                            <table className="employee-table">
                                <thead>
                                    <tr>
                                        <th>Tanggal</th>
                                        <th>Jam masuk</th>
                                        <th>Jam pulang</th>
                                        <th>Total jam kerja</th>
                                        <th>Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="employee-table-empty"
                                            >
                                                Memuat riwayat absensi...
                                            </td>
                                        </tr>
                                    ) : history.length === 0 ? (
                                        <tr>
                                            <td
                                                colSpan={5}
                                                className="employee-table-empty"
                                            >
                                                <div className="employee-empty-icon">
                                                    ▤
                                                </div>
                                                Belum ada riwayat absensi
                                                dalam 5 hari terakhir.
                                            </td>
                                        </tr>
                                    ) : (
                                        history.map((item) => (
                                            <tr key={item.id}>
                                                <td>
                                                    <strong>
                                                        {formatDate(
                                                            item.work_date,
                                                        )}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <div className="attendance-time-cell">
                                                        <span>{formatTime(item.check_in_at)}</span>

                                                        {getPhotoUrl(item.check_in_photo_path) ? (
                                                            <a
                                                                href={getPhotoUrl(item.check_in_photo_path)!}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <img
                                                                    src={getPhotoUrl(item.check_in_photo_path)!}
                                                                    alt="Foto check-in"
                                                                    className="attendance-table-photo"
                                                                />
                                                            </a>
                                                        ) : null}
                                                    </div>
                                                </td>

                                                <td>
                                                    <div className="attendance-time-cell">
                                                        <span>{formatTime(item.check_out_at)}</span>

                                                        {getPhotoUrl(item.check_out_photo_path) ? (
                                                            <a
                                                                href={getPhotoUrl(item.check_out_photo_path)!}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                            >
                                                                <img
                                                                    src={getPhotoUrl(item.check_out_photo_path)!}
                                                                    alt="Foto check-out"
                                                                    className="attendance-table-photo"
                                                                />
                                                            </a>
                                                        ) : null}
                                                    </div>
                                                </td>
                                                <td>
                                                    <strong>
                                                        {calculateWorkDuration(
                                                            item.check_in_at,
                                                            item.check_out_at,
                                                        )}
                                                    </strong>
                                                </td>
                                                <td>
                                                    <span
                                                        className={statusClass(
                                                            item.status,
                                                        )}
                                                    >
                                                        <span />
                                                        {statusLabel(
                                                            item.status,
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="employee-table-footer">
                            <span>
                                Menampilkan maksimal 5 catatan absensi.
                            </span>
                            <button
                                type="button"
                                onClick={() => void loadDashboard()}
                                disabled={loading}
                                className="employee-refresh-button"
                            >
                                ↻ Perbarui data
                            </button>
                        </div>
                    </section>

                    <footer className="employee-footer">
                        <span>
                            © {currentYear ?? "—"} AbsensiKu
                        </span>
                        <span>Sistem Kehadiran Karyawan</span>
                    </footer>
                </div>
            </main>
        </AuthGuard>
    );
}
