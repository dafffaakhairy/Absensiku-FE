
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import AuthGuard from "@/components/AuthGuard";
import { apiFetch } from "@/lib/api";

type WorkSchedule = {
    id: number;
    name: string;
    start_time: string;
    end_time: string;
    late_tolerance_minutes: number;
    office_latitude: number | string | null;
    office_longitude: number | string | null;
    geofence_radius_meters: number;
    work_days: number[];
    is_active: boolean;
};

type ScheduleResponse = {
    data: WorkSchedule[];
};

type FormData = {
    name: string;
    start_time: string;
    end_time: string;
    late_tolerance_minutes: number;
    office_latitude: string;
    office_longitude: string;
    geofence_radius_meters: number;
    work_days: number[];
    is_active: boolean;
};

const DAYS = [
    { value: 1, label: "Senin" },
    { value: 2, label: "Selasa" },
    { value: 3, label: "Rabu" },
    { value: 4, label: "Kamis" },
    { value: 5, label: "Jumat" },
    { value: 6, label: "Sabtu" },
    { value: 7, label: "Minggu" },
];

const EMPTY_FORM: FormData = {
    name: "",
    start_time: "08:00",
    end_time: "17:00",
    late_tolerance_minutes: 15,
    office_latitude: "",
    office_longitude: "",
    geofence_radius_meters: 100,
    work_days: [1, 2, 3, 4, 5],
    is_active: true,
};

export default function WorkSchedulesPage() {
    const [schedules, setSchedules] = useState<WorkSchedule[]>([]);
    const [selected, setSelected] = useState<WorkSchedule | null>(null);
    const [form, setForm] = useState<FormData>(EMPTY_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");

    const loadSchedules = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const result =
                await apiFetch<ScheduleResponse>(
                    "/admin/work-schedules",
                );

            setSchedules(result.data ?? []);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal memuat jadwal kerja.",
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSchedules();
    }, [loadSchedules]);

    function openEdit(schedule: WorkSchedule) {
        setSelected(schedule);
        setNotice("");
        setError("");

        setForm({
            name: schedule.name ?? "",
            start_time: schedule.start_time?.slice(0, 5) ?? "08:00",
            end_time: schedule.end_time?.slice(0, 5) ?? "17:00",
            late_tolerance_minutes:
                schedule.late_tolerance_minutes ?? 15,
            office_latitude:
                schedule.office_latitude == null
                    ? ""
                    : String(schedule.office_latitude),
            office_longitude:
                schedule.office_longitude == null
                    ? ""
                    : String(schedule.office_longitude),
            geofence_radius_meters:
                schedule.geofence_radius_meters ?? 100,
            work_days: schedule.work_days ?? [],
            is_active: Boolean(schedule.is_active),
        });
    }

    function closeEdit() {
        setSelected(null);
        setForm(EMPTY_FORM);
        setError("");
    }

    function toggleDay(day: number) {
        setForm((current) => ({
            ...current,
            work_days: current.work_days.includes(day)
                ? current.work_days.filter((value) => value !== day)
                : [...current.work_days, day].sort((a, b) => a - b),
        }));
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();

        if (!selected) return;

        if (form.work_days.length === 0) {
            setError("Pilih minimal satu hari kerja.");
            return;
        }

        setSaving(true);
        setError("");
        setNotice("");

        try {
            await apiFetch<{ message: string; data: WorkSchedule }>(
                `/admin/work-schedules/${selected.id}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        ...form,
                        office_latitude:
                            form.office_latitude === ""
                                ? null
                                : Number(form.office_latitude),
                        office_longitude:
                            form.office_longitude === ""
                                ? null
                                : Number(form.office_longitude),
                        late_tolerance_minutes: Number(
                            form.late_tolerance_minutes,
                        ),
                        geofence_radius_meters: Number(
                            form.geofence_radius_meters,
                        ),
                    }),
                },
            );

            setNotice("Jadwal kerja berhasil diperbarui.");
            setSelected(null);
            await loadSchedules();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Gagal menyimpan jadwal kerja.",
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <AuthGuard allowedRole="admin">
            <main className="dashboard-page">
                <aside className="sidebar">
                    <Link
                        href="/admin/dashboard"
                        className="sidebar-brand"
                    >
                        <span className="brand-mark small">A</span>
                        <span>AbsensiKu</span>
                    </Link>

                    <p className="nav-caption">MENU UTAMA</p>

                    <Link href="/admin/dashboard" className="nav-item">
                        <span>▦</span>
                        Dashboard
                    </Link>

                    <Link
                        href="/admin/work-schedules"
                        className="nav-item active"
                    >
                        <span>⚙</span>
                        Jadwal Kerja
                    </Link>
                </aside>

                <section className="dashboard-content">
                    <header className="topbar">
                        <div>
                            <p className="eyebrow">PENGELOLAAN</p>
                            <h1>Jadwal Kerja</h1>
                        </div>

                        <button
                            type="button"
                            onClick={() => void loadSchedules()}
                            disabled={loading}
                        >
                            {loading ? "Memuat..." : "↻ Refresh"}
                        </button>
                    </header>

                    {notice && (
                        <div role="status" className="success-notice">
                            {notice}
                        </div>
                    )}

                    {error && (
                        <div role="alert" className="error-notice">
                            {error}
                        </div>
                    )}

                    <section className="content-card">
                        <div className="section-heading">
                            <div>
                                <h2>Daftar jadwal</h2>
                                <p>
                                    Atur jam masuk, jam pulang, hari kerja,
                                    dan lokasi absensi.
                                </p>
                            </div>
                        </div>

                        {loading ? (
                            <p>Memuat jadwal kerja...</p>
                        ) : schedules.length === 0 ? (
                            <p>Belum ada jadwal kerja.</p>
                        ) : (
                            <div className="schedule-list">
                                {schedules.map((schedule) => (
                                    <article
                                        key={schedule.id}
                                        className="next-step"
                                    >
                                        <span className="step-number">
                                            ◷
                                        </span>

                                        <div className="schedule-info">
                                            <strong>{schedule.name}</strong>
                                            <p>
                                                {schedule.start_time.slice(0, 5)}
                                                {" – "}
                                                {schedule.end_time.slice(0, 5)}
                                            </p>
                                            <p>
                                                Toleransi terlambat:{" "}
                                                {schedule.late_tolerance_minutes}{" "}
                                                menit
                                            </p>
                                            <p>
                                                Radius absensi:{" "}
                                                {schedule.geofence_radius_meters}{" "}
                                                meter
                                            </p>
                                            <span>
                                                {schedule.is_active
                                                    ? "Aktif"
                                                    : "Nonaktif"}
                                            </span>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() =>
                                                openEdit(schedule)
                                            }
                                        >
                                            Edit
                                        </button>
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    {selected && (
                        <section className="content-card">
                            <div className="section-heading">
                                <div>
                                    <h2>Edit jadwal kerja</h2>
                                    <p>
                                        Perubahan akan disimpan ke server.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={closeEdit}
                                    disabled={saving}
                                >
                                    Batal
                                </button>
                            </div>

                            <form onSubmit={handleSave}>
                                <div className="schedule-form-grid">
                                    <label>
                                        Nama jadwal
                                        <input
                                            required
                                            value={form.name}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    name: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Jam masuk
                                        <input
                                            required
                                            type="time"
                                            value={form.start_time}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    start_time: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Jam pulang
                                        <input
                                            required
                                            type="time"
                                            value={form.end_time}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    end_time: e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Toleransi terlambat (menit)
                                        <input
                                            required
                                            type="number"
                                            min={0}
                                            value={form.late_tolerance_minutes}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    late_tolerance_minutes:
                                                        Number(e.target.value),
                                                })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Latitude kantor
                                        <input
                                            type="number"
                                            step="any"
                                            value={form.office_latitude}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    office_latitude:
                                                        e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Longitude kantor
                                        <input
                                            type="number"
                                            step="any"
                                            value={form.office_longitude}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    office_longitude:
                                                        e.target.value,
                                                })
                                            }
                                        />
                                    </label>

                                    <label>
                                        Radius absensi (meter)
                                        <input
                                            required
                                            type="number"
                                            min={1}
                                            value={form.geofence_radius_meters}
                                            onChange={(e) =>
                                                setForm({
                                                    ...form,
                                                    geofence_radius_meters:
                                                        Number(e.target.value),
                                                })
                                            }
                                        />
                                    </label>
                                </div>

                                <fieldset className="work-days-field">
                                    <legend>Hari kerja</legend>

                                    <div className="work-days-options">
                                        {DAYS.map((day) => (
                                            <label key={day.value}>
                                                <input
                                                    type="checkbox"
                                                    checked={form.work_days.includes(
                                                        day.value,
                                                    )}
                                                    onChange={() =>
                                                        toggleDay(day.value)
                                                    }
                                                />
                                                {day.label}
                                            </label>
                                        ))}
                                    </div>
                                </fieldset>

                                <label className="schedule-active-toggle">
                                    <input
                                        type="checkbox"
                                        checked={form.is_active}
                                        onChange={(e) =>
                                            setForm({
                                                ...form,
                                                is_active: e.target.checked,
                                            })
                                        }
                                    />
                                    Jadwal aktif
                                </label>

                                <button
                                    type="submit"
                                    disabled={saving}
                                >
                                    {saving
                                        ? "Menyimpan..."
                                        : "Simpan perubahan"}
                                </button>
                            </form>
                        </section>
                    )}
                </section>
            </main>
        </AuthGuard>
    );
}
