
"use client";

import {
    ReactNode,
    useCallback,
    useEffect,
    useState,
} from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import {
    clearToken,
    getToken,
    User,
} from "@/lib/auth";

type Props = {
    children: ReactNode;
    onUserLoaded?: (user: User) => void;
};

type MeResponse = {
    user: User;
};

const IDLE_TIMEOUT = 60_000;
const HEARTBEAT_INTERVAL = 30_000;

export default function AdminGuard({
    children,
    onUserLoaded,
}: Props) {
    const router = useRouter();
    const [authorized, setAuthorized] = useState(false);

    const handleExpired = useCallback(() => {
        clearToken();

        sessionStorage.setItem(
            "absensi_session_expired",
            "inactive",
        );

        router.replace("/login");
    }, [router]);

    useEffect(() => {
        let mounted = true;
        let lastActivity = Date.now();
        let idleTimer: ReturnType<typeof setTimeout>;
        let heartbeatTimer: ReturnType<typeof setInterval>;
        let checking = false;

        function resetIdleTimer() {
            lastActivity = Date.now();

            clearTimeout(idleTimer);

            idleTimer = setTimeout(() => {
                handleExpired();
            }, IDLE_TIMEOUT);
        }

        async function verifySession() {
            if (checking || !getToken()) {
                if (!getToken()) {
                    router.replace("/login");
                }
                return;
            }

            checking = true;

            try {
                const result =
                    await apiFetch<MeResponse>("/me");

                if (!result.user) {
                    throw new Error("Data pengguna tidak tersedia.");
                }

                if (result.user.role !== "admin") {
                    clearToken();
                    router.replace("/login?reason=forbidden");
                    return;
                }

                if (mounted) {
                    onUserLoaded?.(result.user);
                    setAuthorized(true);
                }
            } catch {
                // apiFetch menangani redirect untuk respons 401.
                if (mounted && !getToken()) {
                    setAuthorized(false);
                }
            } finally {
                checking = false;
            }
        }

        const activityEvents = [
            "mousemove",
            "mousedown",
            "keydown",
            "scroll",
            "touchstart",
            "click",
        ] as const;

        activityEvents.forEach((event) => {
            window.addEventListener(event, resetIdleTimer, {
                passive: true,
            });
        });

        resetIdleTimer();
        void verifySession();

        heartbeatTimer = setInterval(() => {
            const idleDuration = Date.now() - lastActivity;

            if (idleDuration >= IDLE_TIMEOUT) {
                handleExpired();
                return;
            }

            // Request berkala hanya ketika pengguna masih aktif.
            if (idleDuration < HEARTBEAT_INTERVAL) {
                void verifySession();
            }
        }, HEARTBEAT_INTERVAL);

        return () => {
            mounted = false;
            clearTimeout(idleTimer);
            clearInterval(heartbeatTimer);

            activityEvents.forEach((event) => {
                window.removeEventListener(
                    event,
                    resetIdleTimer,
                );
            });
        };
    }, [router, onUserLoaded, handleExpired]);

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
