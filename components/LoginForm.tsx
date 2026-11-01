"use client";

import {
    FormEvent,
    useEffect,
    useState,
} from "react";
import {
    useRouter,
    useSearchParams,
} from "next/navigation";

import { apiFetch } from "@/lib/api";
import { saveToken, User } from "@/lib/auth";

type LoginResponse = {
    message: string;
    token: string;
    user: User;
};

export default function LoginForm() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const reason = searchParams.get("reason");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const expired = sessionStorage.getItem(
            "absensi_session_expired",
        );

        if (expired === "inactive") {
            setError(
                "Sesi berakhir karena tidak ada aktivitas. Silakan login kembali.",
            );

            sessionStorage.removeItem(
                "absensi_session_expired",
            );
        } else if (expired === "expired") {
            setError(
                "Sesi berakhir. Silakan login kembali.",
            );

            sessionStorage.removeItem(
                "absensi_session_expired",
            );
        } else if (reason === "forbidden") {
            setError(
                "Akun ini tidak memiliki akses ke halaman tersebut.",
            );
        }
    }, [reason]);

    async function handleSubmit(
        event: FormEvent<HTMLFormElement>,
    ) {
        event.preventDefault();

        setError("");
        setLoading(true);


        try {
            const result = await apiFetch<LoginResponse>(
                "/login",
                {
                    method: "POST",
                    body: JSON.stringify({
                        email,
                        password,
                    }),
                },
            );

            if (!result.token || !result.user) {
                throw new Error(
                    "Respons login tidak lengkap dari server.",
                );
            }

            // BARU: validasi role sebelum token disimpan.
            if (
                result.user.role !== "admin" &&
                result.user.role !== "employee"
            ) {
                throw new Error("Role akun tidak dikenali.");
            }

            saveToken(result.token);

            sessionStorage.removeItem(
                "absensi_session_expired",
            );

            if (result.user.role === "admin") {
                router.replace("/admin/dashboard");
            } else {
                // DIUBAH: sebelumnya memakai `else if`
                // dengan pengecekan role === "employee".
                // Sekarang cukup `else` karena role sudah divalidasi.
                router.replace("/dashboard");
            }
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Login gagal. Silakan coba kembali.",
            );
        } finally {
            setLoading(false);
        }

    }

    return (
        <main className="login-page">
            <section className="login-card">
                <div className="brand-mark">A</div>

                <p className="eyebrow">ABSENSIKU</p>

                <h1>Selamat datang</h1>

                <p className="muted">
                    Masuk untuk melanjutkan ke sistem absensi.
                </p>

                {error && (
                    <div
                        className="alert"
                        role="alert"
                    >
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <label htmlFor="email">
                        Email
                    </label>

                    <input
                        id="email"
                        type="email"
                        autoComplete="username"
                        placeholder="nama@perusahaan.com"
                        value={email}
                        onChange={(event) =>
                            setEmail(event.target.value)
                        }
                        required
                    />

                    <label htmlFor="password">
                        Password
                    </label>

                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Masukkan password"
                        value={password}
                        onChange={(event) =>
                            setPassword(event.target.value)
                        }
                        required
                    />

                    <button
                        className="primary-button"
                        type="submit"
                        disabled={loading}
                    >
                        {loading
                            ? "Memproses..."
                            : "Masuk"}
                    </button>
                </form>

                <p className="login-footer">
                    AbsensiKu · Sistem Kehadiran Karyawan
                </p>
            </section>
        </main>
    );
}
