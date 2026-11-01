import { Suspense } from "react";
import LoginForm from "@/components/LoginForm";

export default function LoginPage() {
    return (
        <Suspense
            fallback={
                <main className="login-page">
                    <section className="login-card">
                        <div className="brand-mark">A</div>
                        <p className="eyebrow">ABSENSIKU</p>
                        <p className="muted">
                            Memuat halaman login...
                        </p>
                    </section>
                </main>
            }
        >
            <LoginForm />
        </Suspense>
    );
}
