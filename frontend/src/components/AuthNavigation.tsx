"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type AuthUser = {
  id: string;
  displayName: string;
  email: string;
  emailVerified: boolean;
  createdAt: string;
};

type CurrentUserResponse = {
  success: boolean;
  user: AuthUser;
};

type LogoutResponse = {
  success: boolean;
  message: string;
};

export default function AuthNavigation() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function checkSession() {
      try {
        const response = await apiRequest<CurrentUserResponse>("/auth/me");

        if (active) {
          setUser(response.user);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void checkSession();

    return () => {
      active = false;
    };
  }, []);

  async function handleLogout() {
    setError("");
    setLoggingOut(true);

    try {
      await apiRequest<LogoutResponse>("/auth/logout", {
        method: "POST",
      });

      setUser(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to log out. Please try again."
      );
    } finally {
      setLoggingOut(false);
    }
  }

  if (loading) {
    return <div className="nav-actions" aria-label="Loading account" />;
  }

  if (!user) {
    return (
      <div className="nav-actions">
        <Link href="/login" className="login-link">
          Log in
        </Link>

        <Link href="/register" className="button button-small">
          Join LetsDate <span aria-hidden="true">↗</span>
        </Link>

        {error && (
          <span className="auth-nav-error" role="alert">
            {error}
          </span>
        )}
      </div>
    );
  }

  return (
    <div className="nav-actions">
      <Link href="/discovery" className="login-link">
        Discover
      </Link>

      <Link href="/matches" className="login-link">
        Matches
      </Link>

      <Link href="/profile" className="login-link">
        My Profile
      </Link>

      <button
        type="button"
        className="button button-small"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? "Logging out..." : "Log out"}
      </button>

      {error && (
        <span className="auth-nav-error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
}
