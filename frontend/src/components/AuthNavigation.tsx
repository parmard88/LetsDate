"use client";

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

    checkSession();

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
        <a href="/login" className="login-link">
          Log in
        </a>

        <a href="/register" className="button button-small">
          Join LetsDate <span aria-hidden="true">↗</span>
        </a>

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
      <span className="login-link">Welcome, {user.displayName}</span>

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
