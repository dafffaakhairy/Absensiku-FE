
"use client";

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import AdminGuard from "@/components/AdminGuard";
import { apiFetch } from "@/lib/api";
import { clearToken, User } from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";

export default function AdminDashboardPage() {
    const router = useRouter();
    const [user, setUser] = useState<User | null>(null);
    const [loggingOut, setLoggingOut] = useState(false);

    const handleUserLoaded = useCallback((value: User) => {
        setUser(value);
    }, []);

    async function handleLogout() {
        setLoggingOut(true);

        try {
            await apiFetch<{ message: string }>("/logout", {
                method: "POST",
            });
        } catch {
            // Token lokal tetap dihapus meskipun server gagal.
        } finally {
            clearToken();
            sessionStorage.removeItem("absensi_session_expired");
            router.replace("/login");
        }
    }

    return (
        <AuthGuard allowedRole="admin">
            <main className="dashboard-page">
                <aside className="sidebar">
                    <div className="sidebar-brand">
                        <span className="brand-mark small">A</span>
                        <span>AbsensiKu</span>
                    </div>

                    <p className="nav-caption">MENU UTAMA</p>

                    <div className="nav-item active">
                        <span>▦</span>
                        Dashboard
                    </div>

                    <Link
                        href="/admin/employees"
                        className="nav-item"
                    >
                        <span>♙</span>
                        Data Karyawan
                    </Link>

                    {/* <div className="nav-item disabled">
                        <span>◷</span>
                        Rekap Absensi
                    </div> */}

                    <Link
                        href="/admin/work-schedules"
                        className="nav-item"
                    >
                        <span>⚙</span>
                        Jadwal Kerja
                    </Link>
                    <div className="sidebar-bottom">
                        <div className="profile">
                            <div className="avatar">A</div>
                            <div className="profile-info">
                                <strong>Administrator</strong>
                                <span>Administrator</span>
                            </div>
                        </div>

                        <button
                            className="logout-button"
                            onClick={handleLogout}
                            disabled={loggingOut}
                        >
                            {loggingOut ? "Keluar..." : "Keluar akun"}
                        </button>
                    </div>
                </aside>

                <section className="dashboard-content">
                    <header className="topbar">
                        <div>
                            <p className="eyebrow">OVERVIEW</p>
                            <h1>Dashboard</h1>
                        </div>
                        <div className="admin-badge">
                            <span className="status-indicator" />
                            Admin
                        </div>
                    </header>

                    <section className="welcome-panel">
                        <div>
                            <p className="welcome-label">PANEL ADMINISTRATOR</p>
                            <h2>
                                Selamat datang{user ? `, ${user.name}` : ""}!
                            </h2>
                            <p>
                                Kelola kehadiran dan data karyawan
                                dari satu tempat.
                            </p>
                        </div>
                        <div className="welcome-icon">✦</div>
                    </section>

                    <div className="section-heading">
                        <div>
                            <h2>Ringkasan sistem</h2>
                            <p>
                                Modul berikutnya akan dihubungkan ke API Laravel.
                            </p>
                        </div>
                    </div>

                    <section className="summary-grid">
                        <article className="summary-card">
                            <div className="summary-icon blue">♙</div>
                            <p>Total Karyawan</p>
                            <h3>—</h3>
                            <span>Data belum dimuat</span>
                        </article>

                        <article className="summary-card">
                            <div className="summary-icon green">✓</div>
                            <p>Hadir Hari Ini</p>
                            <h3>—</h3>
                            <span>Data belum dimuat</span>
                        </article>

                        <article className="summary-card">
                            <div className="summary-icon orange">◷</div>
                            <p>Terlambat</p>
                            <h3>—</h3>
                            <span>Data belum dimuat</span>
                        </article>

                        <article className="summary-card">
                            <div className="summary-icon purple">▤</div>
                            <p>Rekap Absensi</p>
                            <h3>Siap</h3>
                            <span>Modul selanjutnya</span>
                        </article>
                    </section>

                    <section className="content-card">
                        <div className="section-heading">
                            <div>
                                <h2>Langkah selanjutnya</h2>
                                <p>
                                    Fitur akan kita tambahkan secara bertahap.
                                </p>
                            </div>
                        </div>

                        <div className="next-step">
                            <span className="step-number">01</span>
                            <div>
                                <strong>Manajemen karyawan</strong>
                                <p>
                                    Menambah, mencari, mengubah, dan
                                    menonaktifkan akun karyawan.
                                </p>
                            </div>
                            <span className="coming-soon">Berikutnya</span>
                        </div>

                        <div className="next-step">
                            <span className="step-number">02</span>
                            <div>
                                <strong>Jadwal dan lokasi kantor</strong>
                                <p>
                                    Mengatur jam kerja, hari kerja,
                                    koordinat kantor, dan radius absensi.
                                </p>
                            </div>
                            <span className="coming-soon">Berikutnya</span>
                        </div>

                        <div className="next-step">
                            <span className="step-number">03</span>
                            <div>
                                <strong>Rekap absensi</strong>
                                <p>
                                    Melihat riwayat kehadiran dan
                                    memperbaiki data sesuai hak admin.
                                </p>
                            </div>
                            <span className="coming-soon">Berikutnya</span>
                        </div>
                    </section>
                </section>
            </main>
        </AuthGuard>
    );
}
