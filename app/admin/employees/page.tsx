
"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/api";
import { clearToken, User } from "@/lib/auth";
import AuthGuard from "@/components/AuthGuard";
import { useRouter } from "next/navigation";

type Employee = {
    id: number;
    employee_number: string;
    name: string;
    email: string;
    is_active: boolean;
    created_at: string;
};

type EmployeeForm = {
    employee_number: string;
    name: string;
    email: string;
    password: string;
};

type EmployeeResponse = {
    data?: Employee[] | {
        data?: Employee[];
        current_page?: number;
        last_page?: number;
        total?: number;
    };
    current_page?: number;
    last_page?: number;
    total?: number;
    message?: string;
};

const emptyForm: EmployeeForm = {
    employee_number: "",
    name: "",
    email: "",
    password: "",
};

export default function AdminEmployeesPage() {
    const router = useRouter();

    const [user, setUser] = useState<User | null>(null);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const [searchInput, setSearchInput] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<Employee | null>(null);
    const [form, setForm] = useState<EmployeeForm>(emptyForm);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [deactivating, setDeactivating] = useState<Employee | null>(null);
    const [activating, setActivating] = useState<Employee | null>(null);
    const [toast, setToast] = useState("");
    useEffect(() => {
        if (!toast) return;

        const timer = setTimeout(() => {
            setToast("");
        }, 3000);

        return () => clearTimeout(timer);
    }, [toast]);

    const handleUserLoaded = useCallback((value: User) => {
        setUser(value);
    }, []);

    const loadEmployees = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set("search", search.trim());
            params.set("page", String(page));

            const response = await apiFetch<EmployeeResponse>(
                `/admin/employees?${params.toString()}`
            );

            // Mendukung paginator Laravel biasa maupun respons yang dibungkus "data".
            const payload = response.data;
            const pagination =
                payload && !Array.isArray(payload) ? payload : response;

            const rows = Array.isArray(payload)
                ? payload
                : Array.isArray(pagination.data)
                    ? pagination.data
                    : [];

            setEmployees(rows);
            setLastPage(pagination.last_page ?? 1);
            setTotal(pagination.total ?? rows.length);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal memuat data karyawan."
            );
        } finally {
            setLoading(false);
        }
    }, [page, search]);

    useEffect(() => {
        void loadEmployees();
    }, [loadEmployees]);

    function handleSearch(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setPage(1);
        setSearch(searchInput);
    }

    function openCreateModal() {
        setEditing(null);
        setForm(emptyForm);
        setError("");
        setModalOpen(true);
    }

    function openEditModal(employee: Employee) {
        setEditing(employee);
        setForm({
            employee_number: employee.employee_number,
            name: employee.name,
            email: employee.email,
            password: "",
        });
        setError("");
        setModalOpen(true);
    }

    async function handleSave(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!form.employee_number.trim()) {
            setToast("Nomor karyawan wajib diisi.");
            return;
        }

        if (!form.name.trim()) {
            setToast("Nama lengkap wajib diisi.");
            return;
        }

        if (!form.email.trim()) {
            setToast("Email wajib diisi.");
            return;
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
            setToast("Format email tidak valid.");
            return;
        }

        if (!editing && !form.password) {
            setToast("Password wajib diisi.");
            return;
        }

        if (form.password && form.password.length < 8) {
            setToast("Password minimal 8 karakter.");
            return;
        }

        setToast("");
        setSaving(true);
        setError("");
        setNotice("");

        try {
            if (editing) {
                const payload: Record<string, string> = {
                    employee_number: form.employee_number.trim(),
                    name: form.name.trim(),
                    email: form.email.trim(),
                };

                if (form.password) payload.password = form.password;

                await apiFetch(
                    `/admin/employees/${editing.id}`,
                    {
                        method: "PUT",
                        body: JSON.stringify(payload),
                    }
                );
                setNotice("Data karyawan berhasil diperbarui.");
            } else {
                await apiFetch("/admin/employees", {
                    method: "POST",
                    body: JSON.stringify({
                        employee_number: form.employee_number.trim(),
                        name: form.name.trim(),
                        email: form.email.trim(),
                        password: form.password,
                    }),
                });
                setNotice("Karyawan berhasil ditambahkan.");
            }

            setModalOpen(false);
            await loadEmployees();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal menyimpan data karyawan."
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleDeactivate() {
        if (!deactivating) return;

        setSaving(true);
        setError("");
        setNotice("");

        try {
            await apiFetch(
                `/admin/employees/${deactivating.id}/deactivate`,
                { method: "PATCH" }
            );

            setDeactivating(null);
            setNotice(
                `Akun ${deactivating.name} berhasil dinonaktifkan.`
            );
            await loadEmployees();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal menonaktifkan akun karyawan."
            );
            setDeactivating(null);
        } finally {
            setSaving(false);
        }
    }

    async function handleActivate() {
        if (!activating) return;

        setSaving(true);
        setError("");
        setNotice("");

        try {
            await apiFetch(
                `/admin/employees/${activating.id}/activate`,
                { method: "PATCH" }
            );

            setNotice(
                `Akun ${activating.name} berhasil diaktifkan kembali.`
            );
            setActivating(null);
            await loadEmployees();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal mengaktifkan akun karyawan."
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleLogout() {
        setLoggingOut(true);

        try {
            await apiFetch<{ message: string }>("/logout", {
                method: "POST",
            });
        } catch {
            // Token lokal tetap dihapus jika request gagal.
        } finally {
            clearToken();
            sessionStorage.removeItem("absensi_session_expired");
            router.replace("/login");
        }
    }

    const visibleEmployees = employees.filter((employee) => {
        if (statusFilter === "active") return employee.is_active;
        if (statusFilter === "inactive") return !employee.is_active;
        return true;
    });

    return (
        <AuthGuard allowedRole="admin">


            <main className="dashboard-page">
                <aside className="sidebar">
                    <div className="sidebar-brand">
                        <span className="brand-mark small">A</span>
                        <span>AbsensiKu</span>
                    </div>

                    <p className="nav-caption">MENU UTAMA</p>

                    <Link href="/admin/dashboard" className="nav-item">
                        <span>▦</span>
                        Dashboard
                    </Link>

                    <Link
                        href="/admin/employees"
                        className="nav-item active"
                    >
                        <span>♙</span>
                        Data Karyawan
                    </Link>

                    <Link
                        href="/admin/work-schedules"
                        className="nav-item"
                    >
                        <span>⚙</span>
                        Jadwal Kerja
                    </Link>

                    <div className="sidebar-bottom">
                        <div className="profile">
                            <div className="avatar">
                                {user?.name?.charAt(0).toUpperCase() ?? "A"}
                            </div>
                            <div className="profile-info">
                                <strong>{user?.name ?? "Administrator"}</strong>
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
                            <p className="eyebrow">MANAJEMEN</p>
                            <h1>Data Karyawan</h1>
                        </div>
                        <div className="admin-badge">
                            <span className="status-indicator" />
                            Admin
                        </div>
                    </header>

                    <section className="welcome-panel">
                        <div>
                            <p className="welcome-label">PENGELOLAAN SDM</p>
                            <h2>Kelola data karyawan</h2>
                            <p>
                                Tambah, cari, ubah, dan nonaktifkan akun
                                karyawan dalam satu halaman.
                            </p>
                        </div>
                        <div className="welcome-icon">♙</div>
                    </section>

                    {notice && (
                        <div className="employee-alert success" role="status">
                            <span>{notice}</span>
                            <button onClick={() => setNotice("")} aria-label="Tutup">
                                ×
                            </button>
                        </div>
                    )}

                    {error && !modalOpen && (
                        <div className="employee-alert error" role="alert">
                            <span>{error}</span>
                            <button onClick={() => setError("")} aria-label="Tutup">
                                ×
                            </button>
                        </div>
                    )}

                    <section className="content-card employee-card">
                        <div className="employee-toolbar">
                            <div>
                                <h2>Daftar karyawan</h2>
                                <p>
                                    {total} karyawan terdaftar di sistem.
                                </p>
                            </div>
                            <button
                                className="employee-primary-button"
                                onClick={openCreateModal}
                            >
                                + Tambah Karyawan
                            </button>
                        </div>

                        <div className="employee-filters">
                            <form onSubmit={handleSearch} className="employee-search">
                                <span aria-hidden="true">⌕</span>
                                <input
                                    type="search"
                                    value={searchInput}
                                    onChange={(event) =>
                                        setSearchInput(event.target.value)
                                    }
                                    placeholder="Cari nama, NIP, atau email..."
                                    aria-label="Cari karyawan"
                                />
                                <button type="submit">Cari</button>
                            </form>

                            <select
                                value={statusFilter}
                                onChange={(event) =>
                                    setStatusFilter(event.target.value)
                                }
                                aria-label="Filter status karyawan"
                            >
                                <option value="all">Semua status</option>
                                <option value="active">Aktif</option>
                                <option value="inactive">Nonaktif</option>
                            </select>
                        </div>

                        <div className="employee-table-wrap">
                            <table className="employee-table">
                                <thead>
                                    <tr>
                                        <th>Karyawan</th>
                                        <th>Nomor Karyawan</th>
                                        <th>Email</th>
                                        <th>Status</th>
                                        <th className="employee-action-heading">
                                            Aksi
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={5} className="employee-empty">
                                                Memuat data karyawan...
                                            </td>
                                        </tr>
                                    ) : visibleEmployees.length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="employee-empty">
                                                Tidak ada data karyawan yang cocok.
                                            </td>
                                        </tr>
                                    ) : (
                                        visibleEmployees.map((employee) => (
                                            <tr key={employee.id}>
                                                <td>
                                                    <div className="employee-person">
                                                        <div className="employee-avatar">
                                                            {employee.name
                                                                .charAt(0)
                                                                .toUpperCase()}
                                                        </div>
                                                        <div>
                                                            <strong>{employee.name}</strong>
                                                            <span>
                                                                Bergabung{" "}
                                                                {employee.created_at
                                                                    ? new Date(
                                                                        employee.created_at
                                                                    ).toLocaleDateString(
                                                                        "id-ID",
                                                                        {
                                                                            day: "2-digit",
                                                                            month: "short",
                                                                            year: "numeric",
                                                                        }
                                                                    )
                                                                    : "—"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td>{employee.employee_number}</td>
                                                <td>{employee.email}</td>
                                                <td>
                                                    <span
                                                        className={`employee-status ${employee.is_active
                                                            ? "is-active"
                                                            : "is-inactive"
                                                            }`}
                                                    >
                                                        <span />
                                                        {employee.is_active
                                                            ? "Aktif"
                                                            : "Nonaktif"}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="employee-actions">
                                                        <button
                                                            type="button"
                                                            className="employee-edit-button"
                                                            onClick={() =>
                                                                openEditModal(employee)
                                                            }
                                                        >
                                                            Edit
                                                        </button>

                                                        {employee.is_active ? (
                                                            <button
                                                                type="button"
                                                                className="employee-deactivate-button"
                                                                disabled={saving}
                                                                onClick={() =>
                                                                    setDeactivating(employee)
                                                                }
                                                            >
                                                                Nonaktifkan
                                                            </button>
                                                        ) : (
                                                            <button
                                                                type="button"
                                                                className="employee-activate-button"
                                                                disabled={saving}
                                                                onClick={() => {
                                                                    setError("");
                                                                    setActivating(employee);
                                                                }}
                                                            >
                                                                {saving ? "Memproses..." : "Aktifkan"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        <div className="employee-pagination">
                            <span>
                                Halaman {page} dari {lastPage}
                            </span>
                            <div>
                                <button
                                    type="button"
                                    disabled={loading || page <= 1}
                                    onClick={() => setPage((value) => value - 1)}
                                >
                                    ← Sebelumnya
                                </button>
                                <button
                                    type="button"
                                    disabled={loading || page >= lastPage}
                                    onClick={() => setPage((value) => value + 1)}
                                >
                                    Berikutnya →
                                </button>
                            </div>
                        </div>
                    </section>
                </section>

                {modalOpen && (
                    <div
                        className="employee-modal-backdrop"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget && !saving) {
                                setModalOpen(false);
                            }
                        }}
                    >
                        <section
                            className="employee-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="employee-modal-title"
                        >
                            <div className="employee-modal-heading">
                                <div>
                                    <p className="eyebrow">DATA KARYAWAN</p>
                                    <h2 id="employee-modal-title">
                                        {editing ? "Edit Karyawan" : "Tambah Karyawan"}
                                    </h2>
                                    <p>
                                        {editing
                                            ? "Perbarui informasi akun karyawan."
                                            : "Isi data untuk membuat akun karyawan baru."}
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    className="employee-modal-close"
                                    disabled={saving}
                                    onClick={() => setModalOpen(false)}
                                    aria-label="Tutup"
                                >
                                    ×
                                </button>
                            </div>

                            {error && (
                                <div className="employee-alert error" role="alert">
                                    {error}
                                </div>
                            )}

                            <form onSubmit={handleSave} noValidate>
                                <label className="employee-field">
                                    <span>Nomor Karyawan</span>
                                    <input
                                        required
                                        maxLength={30}
                                        value={form.employee_number}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                employee_number: event.target.value,
                                            })
                                        }
                                        placeholder="Contoh: EMP-001"
                                    />
                                </label>

                                <label className="employee-field">
                                    <span>Nama Lengkap</span>
                                    <input
                                        required
                                        maxLength={255}
                                        value={form.name}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                name: event.target.value,
                                            })
                                        }
                                        placeholder="Nama lengkap karyawan"
                                    />
                                </label>

                                <label className="employee-field">
                                    <span>Email</span>
                                    <input
                                        required
                                        type="email"
                                        maxLength={255}
                                        value={form.email}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                email: event.target.value,
                                            })
                                        }
                                        placeholder="nama@perusahaan.com"
                                    />
                                </label>

                                <label className="employee-field">
                                    <span>
                                        Password{" "}
                                        {editing && (
                                            <small>
                                                (kosongkan jika tidak diubah)
                                            </small>
                                        )}
                                    </span>
                                    <input
                                        required={!editing}
                                        type="password"
                                        minLength={8}
                                        autoComplete="new-password"
                                        value={form.password}
                                        onChange={(event) =>
                                            setForm({
                                                ...form,
                                                password: event.target.value,
                                            })
                                        }
                                        placeholder={
                                            editing
                                                ? "Biarkan kosong jika tidak diubah"
                                                : "Minimal 8 karakter"
                                        }
                                    />
                                </label>

                                <div className="employee-modal-actions">
                                    <button
                                        type="button"
                                        className="employee-secondary-button"
                                        disabled={saving}
                                        onClick={() => setModalOpen(false)}
                                    >
                                        Batal
                                    </button>
                                    <button
                                        type="submit"
                                        className="employee-primary-button"
                                        disabled={saving}
                                    >
                                        {saving
                                            ? "Menyimpan..."
                                            : editing
                                                ? "Simpan Perubahan"
                                                : "Tambah Karyawan"}
                                    </button>
                                </div>
                            </form>
                        </section>
                    </div>
                )}

                {deactivating && (
                    <div className="employee-modal-backdrop">
                        <section
                            className="employee-confirm-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="deactivate-title"
                        >
                            <div className="employee-confirm-icon">!</div>
                            <h2 id="deactivate-title">Nonaktifkan karyawan?</h2>
                            <p>
                                Akun <strong>{deactivating.name}</strong> akan
                                dinonaktifkan dan tidak dapat digunakan untuk
                                masuk. Data absensinya tetap tersimpan.
                            </p>
                            {error && (
                                <div className="employee-alert error" role="alert">
                                    {error}
                                </div>
                            )}
                            <div className="employee-modal-actions">
                                <button
                                    type="button"
                                    className="employee-secondary-button"
                                    disabled={saving}
                                    onClick={() => setDeactivating(null)}
                                >
                                    Batal
                                </button>
                                <button
                                    type="button"
                                    className="employee-danger-button"
                                    disabled={saving}
                                    onClick={handleDeactivate}
                                >
                                    {saving ? "Memproses..." : "Ya, Nonaktifkan"}
                                </button>
                            </div>
                        </section>
                    </div>
                )}


                {activating && (
                    <div
                        className="employee-modal-backdrop"
                        onMouseDown={(event) => {
                            if (event.target === event.currentTarget && !saving) {
                                setActivating(null);
                                setError("");
                            }
                        }}
                    >
                        <section
                            className="employee-confirm-modal"
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="activate-title"
                        >
                            <div className="employee-confirm-icon">
                                ✓
                            </div>

                            <h2 id="activate-title">
                                Aktifkan karyawan?
                            </h2>

                            <p>
                                Akun <strong>{activating.name}</strong> akan
                                diaktifkan kembali dan dapat digunakan untuk
                                masuk ke AbsensiKu.
                            </p>

                            {error && (
                                <div className="employee-alert error" role="alert">
                                    <span>{error}</span>
                                    <button
                                        type="button"
                                        onClick={() => setError("")}
                                        aria-label="Tutup"
                                    >
                                        ×
                                    </button>
                                </div>
                            )}

                            <div className="employee-modal-actions">
                                <button
                                    type="button"
                                    className="employee-secondary-button"
                                    disabled={saving}
                                    onClick={() => {
                                        setActivating(null);
                                        setError("");
                                    }}
                                >
                                    Batal
                                </button>

                                <button
                                    type="button"
                                    className="employee-activate-button"
                                    disabled={saving}
                                    onClick={handleActivate}
                                >
                                    {saving ? "Memproses..." : "Ya, Aktifkan"}
                                </button>
                            </div>
                        </section>
                    </div>
                )}

            </main>

            {toast && (
                <div className="employee-toast" role="alert">
                    <span>⚠</span>
                    <span>{toast}</span>
                </div>
            )}
        </AuthGuard>
    );
}
