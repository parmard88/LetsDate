"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthNavigation from "@/components/AuthNavigation";
import { apiRequest } from "@/lib/api";
import styles from "./matches.module.css";

type MatchUser = {
  id: string;
  displayName: string;
  age: number | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  relationshipGoal: string | null;
  primaryPhoto: {
    url: string;
    contentType: string;
  } | null;
};

type MatchItem = {
  matchId: string;
  matchedAt: string;
  user: MatchUser;
};

type MatchesResponse = {
  success: boolean;
  count: number;
  matches: MatchItem[];
};

export default function MatchesPage() {
  const router = useRouter();

  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadMatches = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiRequest<MatchesResponse>("/matches");
      setMatches(response.matches);
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        router.push("/login");
        return;
      }

      setError(
        err instanceof Error
          ? err.message
          : "Unable to load your matches. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        await loadMatches();
      } catch (err) {
        console.error("Failed to load matches:", err);
      }
    };

    fetchMatches();
  }, [loadMatches]);

  function formatMatchDate(dateString: string) {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return "Recently matched";
    }

    return date.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }

  return (
    <main className={styles.page}>
      <header className="site-header">
        <div className="nav-container">
          <Link href="/" className="brand" aria-label="LetsDate home">
            <span className="brand-mark">♡</span>
            <span>
              lets<span className="brand-accent">date</span>
            </span>
          </Link>

          <AuthNavigation />
        </div>
      </header>

      <section className={styles.container}>
        <div className={styles.heading}>
          <div className={styles.kicker}>SOMETHING GOOD STARTED HERE</div>
          <h1>
            Your <span>connections.</span>
          </h1>
          <p>
            Every match is a chance to start a conversation and discover
            something meaningful.
          </p>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            <p>{error}</p>
            <button type="button" onClick={() => void loadMatches()}>
              Try again
            </button>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Loading your matches…</div>
        ) : !error && matches.length === 0 ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyHeart}>♡</span>
            <h2>Your story is just beginning</h2>
            <p>
              When you and another person both Like each other, your match will
              appear here.
            </p>
            <Link href="/discovery" className={styles.discoverButton}>
              Explore people <span aria-hidden="true">↗</span>
            </Link>
          </div>
        ) : !error ? (
          <>
            <div className={styles.resultsHeading}>
              <h2>Your matches</h2>
              <span>
                {matches.length}{" "}
                {matches.length === 1 ? "connection" : "connections"}
              </span>
            </div>

            <div className={styles.matchGrid}>
              {matches.map((match) => {
                const person = match.user;

                return (
                  <article className={styles.matchCard} key={match.matchId}>
                    <div className={styles.photoWrap}>
                      {person.primaryPhoto ? (
                        <img
                          src={person.primaryPhoto.url}
                          alt={`${person.displayName}'s profile`}
                          className={styles.photo}
                        />
                      ) : (
                        <div className={styles.photoPlaceholder}>
                          <span>♡</span>
                        </div>
                      )}

                      <span className={styles.heartBadge} aria-label="Matched">
                        ♥
                      </span>
                    </div>

                    <div className={styles.matchInfo}>
                      <h3>
                        {person.displayName}
                        {person.age !== null ? `, ${person.age}` : ""}
                      </h3>

                      {(person.city || person.country) && (
                        <p className={styles.location}>
                          <span aria-hidden="true">⌖</span>
                          {[person.city, person.country]
                            .filter(Boolean)
                            .join(", ")}
                        </p>
                      )}

                      {person.relationshipGoal && (
                        <span className={styles.goal}>
                          {person.relationshipGoal.replaceAll("-", " ")}
                        </span>
                      )}

                      <p className={styles.matchDate}>
                        Matched on {formatMatchDate(match.matchedAt)}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.bottomAction}>
              <Link href="/discovery">
                Discover more people <span aria-hidden="true">↗</span>
              </Link>
            </div>
          </>
        ) : null}
      </section>
    </main>
  );
}
