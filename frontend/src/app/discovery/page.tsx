"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import AuthNavigation from "@/components/AuthNavigation";
import { apiRequest } from "@/lib/api";
import styles from "./discovery.module.css";

type DiscoveryProfile = {
  id: string;
  displayName: string;
  age: number;
  bio: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  relationshipGoal: string | null;
  primaryPhoto: {
    url: string;
    contentType: string;
    sizeBytes: number;
  };
};

type DiscoveryResponse = {
  success: boolean;
  message?: string;
  profiles: DiscoveryProfile[];
  pagination: {
    limit: number;
    offset: number;
    hasMore: boolean;
    nextOffset: number | null;
  };
};

type SwipeResponse = {
  success: boolean;
  action: "like" | "pass";
  matched: boolean;
  matchId: string | null;
  message: string;
};

export default function DiscoveryPage() {
  const router = useRouter();

  const [profiles, setProfiles] = useState<DiscoveryProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [matchMessage, setMatchMessage] = useState("");

  const loadProfiles = useCallback(
    async (offset = 0, append = false) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      setError("");
      setNotice("");

      try {
        const response = await apiRequest<DiscoveryResponse>(
          `/discovery?limit=20&offset=${offset}`
        );

        setProfiles((current) => {
          if (!append) return response.profiles;

          const existingIds = new Set(current.map((profile) => profile.id));
          const newProfiles = response.profiles.filter(
            (profile) => !existingIds.has(profile.id)
          );

          return [...current, ...newProfiles];
        });

        setHasMore(response.pagination.hasMore);
        setNextOffset(response.pagination.nextOffset);

        if (!response.profiles.length && !append && response.message) {
          setNotice(response.message);
        }
      } catch (err) {
        if (err instanceof Error && "status" in err && err.status === 401) {
          router.push("/login");
          return;
        }

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load profiles. Please try again."
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [router]
  );

  useEffect(() => {
    const fetchProfiles = async () => {
      await loadProfiles();
    };
    fetchProfiles();
  }, [loadProfiles]);

  async function handleSwipe(
    profile: DiscoveryProfile,
    action: "like" | "pass"
  ) {
    if (activeAction) return;

    setActiveAction(`${profile.id}-${action}`);
    setError("");
    setMatchMessage("");

    try {
      const response = await apiRequest<SwipeResponse>(
        `/matches/${encodeURIComponent(profile.id)}/${action}`,
        { method: "POST" }
      );

      setProfiles((current) =>
        current.filter((item) => item.id !== profile.id)
      );

      if (response.matched) {
        setMatchMessage(
          `You and ${profile.displayName} liked each other. It's a match!`
        );
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : `Unable to ${action} this profile. Please try again.`
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function handleLoadMore() {
    if (nextOffset === null || loadingMore) return;
    await loadProfiles(nextOffset, true);
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
          <div className={styles.kicker}>A LITTLE HELLO CAN GO A LONG WAY</div>
          <h1>
            Discover someone <span>interesting.</span>
          </h1>
          <p>
            Take your time, explore thoughtfully, and see who you might connect
            with.
          </p>
        </div>

        {error && (
          <div className={styles.error} role="alert">
            {error}
          </div>
        )}

        {notice && !loading && (
          <div className={styles.emptyState}>
            <span className={styles.emptyHeart}>♡</span>
            <h2>Let’s get your profile ready</h2>
            <p>{notice}</p>
            <Link href="/profile" className="button button-large">
              Complete my profile
            </Link>
          </div>
        )}

        {matchMessage && (
          <div className={styles.matchNotice} role="status">
            <div>
              <span className={styles.matchHeart}>♥</span>
              <strong>It’s a match!</strong>
              <p>{matchMessage}</p>
            </div>
            <div className={styles.matchActions}>
              <Link href="/matches" className={styles.matchLink}>
                View matches
              </Link>
              <button
                type="button"
                onClick={() => setMatchMessage("")}
                aria-label="Dismiss match notification"
              >
                ×
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className={styles.loading}>Finding people for you…</div>
        ) : profiles.length > 0 ? (
          <>
            <div className={styles.profileGrid}>
              {profiles.map((profile) => {
                const actionInProgress = activeAction?.startsWith(
                  `${profile.id}-`
                );

                return (
                  <article className={styles.profileCard} key={profile.id}>
                    <div className={styles.photoWrap}>
                      <img
                        src={profile.primaryPhoto.url}
                        alt={`${profile.displayName}'s profile`}
                        className={styles.photo}
                      />
                      <div className={styles.photoOverlay}>
                        <span className={styles.photoName}>
                          {profile.displayName}, {profile.age}
                        </span>
                        {profile.city && (
                          <span className={styles.photoLocation}>
                            {profile.city}
                            {profile.country ? `, ${profile.country}` : ""}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className={styles.profileInfo}>
                      {profile.relationshipGoal && (
                        <span className={styles.goal}>
                          {profile.relationshipGoal.replaceAll("-", " ")}
                        </span>
                      )}

                      <h2>
                        {profile.displayName}, {profile.age}
                      </h2>

                      {profile.bio ? (
                        <p className={styles.bio}>{profile.bio}</p>
                      ) : (
                        <p className={styles.bioMuted}>
                          This person is just getting started.
                        </p>
                      )}

                      <div className={styles.cardActions}>
                        <button
                          type="button"
                          className={styles.passButton}
                          onClick={() => void handleSwipe(profile, "pass")}
                          disabled={Boolean(activeAction)}
                        >
                          {actionInProgress && activeAction?.endsWith("-pass")
                            ? "Passing…"
                            : "× Pass"}
                        </button>

                        <button
                          type="button"
                          className={styles.likeButton}
                          onClick={() => void handleSwipe(profile, "like")}
                          disabled={Boolean(activeAction)}
                        >
                          {actionInProgress && activeAction?.endsWith("-like")
                            ? "Liking…"
                            : "♡ Like"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            {hasMore && (
              <div className={styles.loadMore}>
                <button
                  type="button"
                  onClick={() => void handleLoadMore()}
                  disabled={loadingMore}
                  className={styles.loadMoreButton}
                >
                  {loadingMore ? "Loading…" : "Show more people"}
                </button>
              </div>
            )}
          </>
        ) : !notice ? (
          <div className={styles.emptyState}>
            <span className={styles.emptyHeart}>♡</span>
            <h2>You’re all caught up</h2>
            <p>
              There are no more profiles to show right now. Check back again
              soon.
            </p>
            <Link href="/profile" className={styles.secondaryLink}>
              Review my profile
            </Link>
          </div>
        ) : null}
      </section>
    </main>
  );
}
