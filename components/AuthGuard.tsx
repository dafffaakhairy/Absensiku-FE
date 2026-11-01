"use client";

import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { clearToken, getToken, User } from "@/lib/auth";

type Props = {
    children: ReactNode;
    allowedRole: "admin" | "employee";
};

type MeResponse = {
    user: User;
};

const IDLE_TIMEOUT = 60 * 1000;

export default function AuthGuard({
    children,
    allowedRole,
}: Props) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    useEffect(() => {
        let mounted = true;
        let idleTimer: ReturnType<typeof setTimeout> | undefined;
        let sessionEnded = false;

        function logoutBecauseIdle() {
            if (sessionEnded) return;

            sessionEnded = true;

            if (idleTimer) {
                clearTimeout(idleTimer);
            }

            clearToken();

            sessionStorage.setItem(
                "absensi_session_expired",
                "inactive",
            );

            window.location.replace("/login");
        }

        function resetIdleTimer() {
            if (sessionEnded) return;

            if (idleTimer) {
                clearTimeout(idleTimer);
            }

            idleTimer = setTimeout(
                logoutBecauseIdle,
                IDLE_TIMEOUT,
            );
        }

        const activityEvents = [
            "mousemove",
            "mousedown",
            "keydown",
            "touchstart",
            "scroll",
            "click",
            "pointerdown",
        ] as const;

        function handleActivity() {
            resetIdleTimer();
        }

        async function verifySession() {
            if (!getToken()) {
                router.replace("/login");
                return;
            }

            try {
                const result =
                    await apiFetch<MeResponse>("/me");

                if (!result.user) {
                    throw new Error(
                        "Data pengguna tidak tersedia.",
                    );
                }

                if (result.user.role !== allowedRole) {
                    clearToken();
                    router.replace("/login?reason=forbidden");
                    return;
                }

                if (!mounted) return;

                setAuthorized(true);

                // Mulai hitung waktu AFK setelah sesi valid.
                resetIdleTimer();

                activityEvents.forEach((event) => {
                    window.addEventListener(
                        event,
                        handleActivity,
                        { passive: true },
                    );
                });
            } catch {
                if (mounted && !getToken()) {
                    setAuthorized(false);
                }
            }
        }

        void verifySession();

        return () => {
            mounted = false;

            if (idleTimer) {
                clearTimeout(idleTimer);
            }

            activityEvents.forEach((event) => {
                window.removeEventListener(
                    event,
                    handleActivity,
                );
            });
        };
    }, [allowedRole, router]);

    if (!authorized) {
        return (
            <main className="guard-loading">
                <div className="loading-dot" />
                <p>Memeriksa sesi...</p>
            </main>
        );
    }

    return <>{children}</>;
}
