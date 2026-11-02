"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import styles from "./AuthForm.module.css";

type AuthFormProps = {
  mode: "login" | "register";
};

type AuthResponse = {
  success?: boolean;
  message?: string;
  user?: {
    id: string;
    displayName: string;
    email: string;
    emailVerified: boolean;
    createdAt: string;
  };
};

export default function AuthForm({ mode }: AuthFormProps) {
  const isRegister = mode === "register";
  const router = useRouter();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setSuccess("");

    const normalizedEmail = email.trim().toLowerCase();

    if (isRegister) {
      if (displayName.trim().length < 2 || displayName.trim().length > 80) {
        setError("Your name must be between 2 and 80 characters.");
        return;
      }

      if (password.length < 12 || password.length > 128) {
        setError("Your password must be between 12 and 128 characters.");
        return;
      }

      if (password !== confirmPassword) {
        setError("Your passwords do not match.");
        return;
      }
    }

    if (!normalizedEmail) {
      setError("Please enter your email address.");
      return;
    }

    if (!isRegister && !password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        await apiRequest<AuthResponse>("/auth/register", {
          method: "POST",
          body: JSON.stringify({
            displayName: displayName.trim(),
            email: normalizedEmail,
            password,
          }),
        });

        setSuccess("Your account has been created. You can now log in.");
        setPassword("");
        setConfirmPassword("");
      } else {
        await apiRequest<AuthResponse>("/auth/login", {
          method: "POST",
          body: JSON.stringify({
            email: normalizedEmail,
            password,
          }),
        });

        router.push("/");
        router.refresh();
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundShape} />

      <section className={styles.card}>
        <Link href="/" className={styles.brand}>
          <span className={styles.brandMark}>♡</span>
          <span>
            lets<span className={styles.brandAccent}>date</span>
          </span>
        </Link>

        <div className={styles.heading}>
          <span className={styles.kicker}>
            {isRegister ? "YOUR STORY STARTS HERE" : "WELCOME BACK"}
          </span>

          <h1>
            {isRegister ? (
              <>
                Meet your
                <br />
                <span>next chapter.</span>
              </>
            ) : (
              <>
                Lovely to
                <br />
                <span>see you again.</span>
              </>
            )}
          </h1>

          <p>
            {isRegister
              ? "Create your account and make room for meaningful connections."
              : "Sign in and continue discovering meaningful connections."}
          </p>
        </div>

        {success ? (
          <div className={styles.successPanel} role="status">
            <span className={styles.successIcon}>✓</span>
            <h2>You&apos;re one step closer!</h2>
            <p>{success}</p>
            <Link href="/login" className={styles.submitButton}>
              Go to login <span>↗</span>
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            {isRegister && (
              <div className={styles.field}>
                <label htmlFor="displayName">Your name</label>
                <input
                  id="displayName"
                  type="text"
                  autoComplete="name"
                  placeholder="How should we call you?"
                  minLength={2}
                  maxLength={80}
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  required
                />
              </div>
            )}

            <div className={styles.field}>
              <label htmlFor="email">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                maxLength={254}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            <div className={styles.field}>
              <label htmlFor="password">Password</label>
              <input
                id="password"
                type="password"
                autoComplete={isRegister ? "new-password" : "current-password"}
                placeholder={
                  isRegister ? "At least 12 characters" : "Enter your password"
                }
                minLength={isRegister ? 12 : undefined}
                maxLength={128}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </div>

            {isRegister && (
              <div className={styles.field}>
                <label htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Enter your password again"
                  maxLength={128}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  required
                />
              </div>
            )}

            {error && (
              <div className={styles.errorMessage} role="alert">
                {error}
              </div>
            )}

            <button
              type="submit"
              className={styles.submitButton}
              disabled={loading}
            >
              {loading
                ? "Please wait..."
                : isRegister
                ? "Create my account"
                : "Log in to LetsDate"}
              {!loading && <span>↗</span>}
            </button>

            <p className={styles.switchText}>
              {isRegister ? "Already have an account?" : "New to LetsDate?"}{" "}
              <Link href={isRegister ? "/login" : "/register"}>
                {isRegister ? "Log in" : "Create an account"}
              </Link>
            </p>
          </form>
        )}

        <div className={styles.cardFooter}>
          <Link href="/">← Back to LetsDate home</Link>
          <span>Made for meaningful connections ♡</span>
        </div>
      </section>
    </main>
  );
}
