
import { clearToken, getToken } from "./auth";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api";

type ApiErrorBody = {
    message?: string;
    code?: string;
    errors?: Record<string, string[]>;
};

export class ApiError extends Error {
    status: number;
    code?: string;

    constructor(
        message: string,
        status: number,
        code?: string,
    ) {
        super(message);
        this.name = "ApiError";
        this.status = status;
        this.code = code;
    }
}

export async function apiFetch<T>(
    endpoint: string,
    options: RequestInit = {},
): Promise<T> {
    const headers = new Headers(options.headers);
    const token = getToken();

    headers.set("Accept", "application/json");

    if (token) {
        headers.set("Authorization", `Bearer ${token}`);
    }

    if (
        options.body &&
        !(options.body instanceof FormData) &&
        !headers.has("Content-Type")
    ) {
        headers.set("Content-Type", "application/json");
    }

    const baseUrl = API_URL.replace(/\/+$/, "");
    const path = endpoint.startsWith("/")
        ? endpoint
        : `/${endpoint}`;

    const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers,
        cache: "no-store",
    });

    const raw = await response.text();
    let body: ApiErrorBody & Record<string, unknown> = {};

    if (raw) {
        try {
            body = JSON.parse(raw);
        } catch {
            throw new ApiError(
                `Server mengirim respons bukan JSON (HTTP ${response.status}).`,
                response.status,
            );
        }
    }

    if (!response.ok) {
        const validationMessage = Object.values(
            body.errors ?? {},
        )
            .flat()
            .join(", ");

        const message =
            body.message ||
            validationMessage ||
            "Terjadi kesalahan pada server.";

        if (
            response.status === 401 &&
            endpoint !== "/login" &&
            typeof window !== "undefined"
        ) {
            clearToken();
            sessionStorage.setItem(
                "absensi_session_expired",
                body.code === "TOKEN_INACTIVE"
                    ? "inactive"
                    : "expired",
            );

            window.location.replace("/login");
        }

        throw new ApiError(
            message,
            response.status,
            body.code,
        );
    }

    return body as T;
}
