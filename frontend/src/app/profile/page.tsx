"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, apiRequest } from "@/lib/api";

type Completion = {
  percentage: number;
  completedFields: number;
  totalFields: number;
};

type Profile = {
  displayName: string;
  email: string;
  bio: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  city: string | null;
  country: string | null;
  preferredGender: string | null;
  minPreferredAge: number | null;
  maxPreferredAge: number | null;
  relationshipGoal: string | null;
  profileCompletion?: Completion;
};

type ProfileResponse = {
  success: boolean;
  profile: Profile;
  message?: string;
};

type Photo = {
  id: string;
  url: string;
  contentType: string;
  sizeBytes: number;
  isPrimary: boolean;
  position: number;
  createdAt: string;
};

type PhotosResponse = {
  success: boolean;
  photos: Photo[];
  message?: string;
};

type PhotoResponse = {
  success: boolean;
  photo: Photo;
  message?: string;
};

const emptyProfile: Profile = {
  displayName: "",
  email: "",
  bio: "",
  dateOfBirth: "",
  gender: "",
  city: "",
  country: "",
  preferredGender: "everyone",
  minPreferredAge: 18,
  maxPreferredAge: 50,
  relationshipGoal: "unsure",
};

const emptyCompletion: Completion = {
  percentage: 0,
  completedFields: 0,
  totalFields: 9,
};

export default function ProfilePage() {
  const router = useRouter();

  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [completion, setCompletion] = useState<Completion>(emptyCompletion);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photoAction, setPhotoAction] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadProfile = useCallback(async () => {
    try {
      const [profileData, photoData] = await Promise.all([
        apiRequest<ProfileResponse>("/profile"),
        apiRequest<PhotosResponse>("/profile/photos"),
      ]);

      const loadedProfile = profileData.profile;

      setProfile({
        ...emptyProfile,
        ...loadedProfile,
        dateOfBirth: loadedProfile.dateOfBirth
          ? loadedProfile.dateOfBirth.slice(0, 10)
          : "",
        bio: loadedProfile.bio ?? "",
        gender: loadedProfile.gender ?? "",
        city: loadedProfile.city ?? "",
        country: loadedProfile.country ?? "",
        preferredGender: loadedProfile.preferredGender ?? "everyone",
        minPreferredAge: loadedProfile.minPreferredAge ?? 18,
        maxPreferredAge: loadedProfile.maxPreferredAge ?? 50,
        relationshipGoal: loadedProfile.relationshipGoal ?? "unsure",
      });

      setPhotos(photoData.photos);

      // Completion is returned inside the profile object by the backend.
      setCompletion(loadedProfile.profileCompletion ?? emptyCompletion);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        router.replace("/login");
        return;
      }

      setError(
        err instanceof Error ? err.message : "Unable to load your profile."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    const fetchProfile = async () => {
      await loadProfile();
    };
    void fetchProfile();
  }, [loadProfile]);

  function updateField<K extends keyof Profile>(field: K, value: Profile[K]) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");
    setSaving(true);

    try {
      const result = await apiRequest<ProfileResponse>("/profile", {
        method: "PATCH",
        body: JSON.stringify({
          displayName: profile.displayName.trim(),
          bio: profile.bio?.trim() || null,
          dateOfBirth: profile.dateOfBirth,
          gender: profile.gender || null,
          city: profile.city?.trim() || null,
          country: profile.country?.trim() || null,
          preferredGender: profile.preferredGender,
          minPreferredAge: Number(profile.minPreferredAge),
          maxPreferredAge: Number(profile.maxPreferredAge),
          relationshipGoal: profile.relationshipGoal,
        }),
      });

      // Update the progress bar immediately from the save response.
      if (result.profile.profileCompletion) {
        setCompletion(result.profile.profileCompletion);
      }

      setNotice(result.message || "Your profile has been updated.");

      // Refresh the profile and photos from the backend.
      await loadProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to save your profile."
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadPhoto(file: File) {
    setError("");
    setNotice("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Please choose a JPEG, PNG, or WebP image.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setError("The image must be 5 MB or smaller.");
      return;
    }

    if (photos.length >= 6) {
      setError("You can upload a maximum of 6 profile photos.");
      return;
    }

    const formData = new FormData();
    formData.append("photo", file);

    setUploading(true);

    try {
      const result = await apiRequest<PhotoResponse>("/profile/photos", {
        method: "POST",
        body: formData,
      });

      setNotice(result.message || "Photo uploaded successfully.");
      await loadProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to upload the photo."
      );
    } finally {
      setUploading(false);
    }
  }

  async function setPrimaryPhoto(photoId: string) {
    setError("");
    setNotice("");
    setPhotoAction(photoId);

    try {
      await apiRequest(`/profile/photos/${photoId}/primary`, {
        method: "PATCH",
      });

      setNotice("Your primary photo has been updated.");
      await loadProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update primary photo."
      );
    } finally {
      setPhotoAction(null);
    }
  }

  async function deletePhoto(photoId: string) {
    const confirmed = window.confirm(
      "Are you sure you want to delete this photo?"
    );

    if (!confirmed) return;

    setError("");
    setNotice("");
    setPhotoAction(photoId);

    try {
      const result = await apiRequest<{ success: boolean; message?: string }>(
        `/profile/photos/${photoId}`,
        { method: "DELETE" }
      );

      setNotice(result.message || "Photo deleted successfully.");
      await loadProfile();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to delete the photo."
      );
    } finally {
      setPhotoAction(null);
    }
  }

  if (loading) {
    return (
      <main className="profile-page">
        <div className="profile-loading">Loading your profile...</div>
      </main>
    );
  }

  return (
    <main className="profile-page">
      <div className="profile-container">
        <header className="profile-heading">
          <div>
            <p className="profile-kicker">YOUR LETSDATE ACCOUNT</p>
            <h1>Your profile</h1>
            <p className="profile-subtitle">
              Tell people a little about yourself and what you are looking for.
            </p>
          </div>
          <button
            className="profile-back-button"
            type="button"
            onClick={() => router.push("/")}
          >
            Back to home
          </button>
        </header>

        <section className="completion-card">
          <div className="completion-top">
            <div>
              <h2>Profile completion</h2>
              <p>
                {completion.completedFields} of {completion.totalFields} profile
                sections completed
              </p>
            </div>
            <strong>{completion.percentage}%</strong>
          </div>

          <div
            className="completion-track"
            role="progressbar"
            aria-label="Profile completion"
            aria-valuenow={completion.percentage}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="completion-fill"
              style={{ width: `${completion.percentage}%` }}
            />
          </div>
        </section>

        {error && (
          <div className="profile-alert profile-alert-error">{error}</div>
        )}
        {notice && (
          <div className="profile-alert profile-alert-success">{notice}</div>
        )}

        <section className="profile-card">
          <div className="profile-section-heading">
            <div>
              <span className="profile-section-number">01</span>
              <h2>Your photos</h2>
              <p>Add up to six photos. Your primary photo represents you.</p>
            </div>
            <span className="photo-count">{photos.length}/6 photos</span>
          </div>

          <div className="photo-grid">
            {photos.map((photo) => (
              <article className="photo-item" key={photo.id}>
                <img src={photo.url} alt="Your profile" />

                {photo.isPrimary && (
                  <span className="primary-photo-label">Primary photo</span>
                )}

                <div className="photo-actions">
                  {!photo.isPrimary && (
                    <button
                      type="button"
                      disabled={photoAction !== null}
                      onClick={() => void setPrimaryPhoto(photo.id)}
                    >
                      {photoAction === photo.id
                        ? "Please wait..."
                        : "Make primary"}
                    </button>
                  )}

                  <button
                    type="button"
                    className="photo-delete-button"
                    disabled={photoAction !== null}
                    onClick={() => void deletePhoto(photo.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}

            {photos.length < 6 && (
              <label className="photo-upload-tile">
                <span className="photo-upload-plus">+</span>
                <strong>{uploading ? "Uploading..." : "Add a photo"}</strong>
                <small>JPEG, PNG or WebP · Max 5 MB</small>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  disabled={uploading}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) void uploadPhoto(file);
                    event.target.value = "";
                  }}
                />
              </label>
            )}
          </div>
        </section>

        <form className="profile-card profile-form" onSubmit={saveProfile}>
          <div className="profile-section-heading">
            <div>
              <span className="profile-section-number">02</span>
              <h2>About you</h2>
              <p>Share the details that help people get to know you.</p>
            </div>
          </div>

          <div className="profile-form-grid">
            <label className="profile-field">
              <span>Display name</span>
              <input
                value={profile.displayName}
                onChange={(event) =>
                  updateField("displayName", event.target.value)
                }
                minLength={2}
                maxLength={80}
                required
              />
            </label>

            <label className="profile-field">
              <span>Email address</span>
              <input value={profile.email} disabled />
              <small>Your account email cannot be changed here.</small>
            </label>

            <label className="profile-field profile-field-full">
              <span>About me</span>
              <textarea
                value={profile.bio ?? ""}
                onChange={(event) => updateField("bio", event.target.value)}
                maxLength={500}
                rows={5}
                placeholder="Write a little about yourself..."
              />
              <small>{(profile.bio ?? "").length}/500 characters</small>
            </label>

            <label className="profile-field">
              <span>Date of birth</span>
              <input
                type="date"
                value={profile.dateOfBirth ?? ""}
                onChange={(event) =>
                  updateField("dateOfBirth", event.target.value)
                }
                required
              />
              <small>You must be at least 18 years old.</small>
            </label>

            <label className="profile-field">
              <span>Gender</span>
              <select
                value={profile.gender ?? ""}
                onChange={(event) => updateField("gender", event.target.value)}
              >
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="non-binary">Non-binary</option>
                <option value="other">Other</option>
                <option value="prefer-not-to-say">Prefer not to say</option>
              </select>
            </label>

            <label className="profile-field">
              <span>City</span>
              <input
                value={profile.city ?? ""}
                onChange={(event) => updateField("city", event.target.value)}
                maxLength={100}
                placeholder="Your city"
              />
            </label>

            <label className="profile-field">
              <span>Country</span>
              <input
                value={profile.country ?? ""}
                onChange={(event) => updateField("country", event.target.value)}
                maxLength={100}
                placeholder="Your country"
              />
            </label>
          </div>

          <div className="profile-section-heading profile-preferences-heading">
            <div>
              <span className="profile-section-number">03</span>
              <h2>Dating preferences</h2>
              <p>Tell us who you would like to meet.</p>
            </div>
          </div>

          <div className="profile-form-grid">
            <label className="profile-field">
              <span>Show me</span>
              <select
                value={profile.preferredGender ?? "everyone"}
                onChange={(event) =>
                  updateField("preferredGender", event.target.value)
                }
              >
                <option value="everyone">Everyone</option>
                <option value="male">Men</option>
                <option value="female">Women</option>
                <option value="non-binary">Non-binary people</option>
              </select>
            </label>

            <label className="profile-field">
              <span>Relationship goal</span>
              <select
                value={profile.relationshipGoal ?? "unsure"}
                onChange={(event) =>
                  updateField("relationshipGoal", event.target.value)
                }
              >
                <option value="long-term">Long-term relationship</option>
                <option value="short-term">Short-term relationship</option>
                <option value="friendship">Friendship</option>
                <option value="unsure">Still figuring it out</option>
              </select>
            </label>

            <label className="profile-field">
              <span>Minimum preferred age</span>
              <input
                type="number"
                min={18}
                max={100}
                value={profile.minPreferredAge ?? 18}
                onChange={(event) =>
                  updateField("minPreferredAge", Number(event.target.value))
                }
                required
              />
            </label>

            <label className="profile-field">
              <span>Maximum preferred age</span>
              <input
                type="number"
                min={18}
                max={100}
                value={profile.maxPreferredAge ?? 50}
                onChange={(event) =>
                  updateField("maxPreferredAge", Number(event.target.value))
                }
                required
              />
            </label>
          </div>

          <div className="profile-form-footer">
            <p>Your profile is saved securely to your LetsDate account.</p>
            <button
              className="profile-save-button"
              type="submit"
              disabled={saving}
            >
              {saving ? "Saving..." : "Save profile"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
