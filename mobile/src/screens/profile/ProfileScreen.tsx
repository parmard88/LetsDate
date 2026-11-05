"use client";

import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  FlatList,
  Image as RNImage,
  StyleSheet,
} from "react-native";

import { useNavigation } from "@react-navigation/native";
import { apiRequest } from "@/lib/api";
import { COLORS, TYPOGRAPHY, SPACING, MAX_PHOTOS, SHADOWS } from "@/theme";
import { useRoute } from "@react-navigation/native";

type Photo = {
  id: string;
  url: string;
  isPrimary: boolean;
  position: number;
};

type ProfileForm = {
  displayName: string;
  bio: string | null;
  dateOfBirth: string | null; // YYYY-MM-DD
  gender: string | null;
  city: string | null;
  country: string | null;
  preferredGender: string | null;
  minPreferredAge: number | null;
  maxPreferredAge: number | null;
  relationshipGoal: string | null;
};

// Standalone function to load profile and photos
async function loadProfileData(
  apiRequest: any,
  navigation: any,
  setProfile: any,
  setPhotos: any,
  setCompletion: any,
  setLoading: any,
  setError: any
) {
  try {
    const profileData = await apiRequest("/api/profile");
    const photoData = await apiRequest("/api/profile/photos");

    if (profileData.success && profileData.profile) {
      setProfile(profileData.profile);
    }

    if (photoData.success) {
      setPhotos(photoData.photos);
    }

    // Recalculate completion from saved profile
    const p = profileData.profile || {};
    const fields = [
      p.displayName?.trim(),
      p.bio?.trim(),
      p.dateOfBirth,
      p.gender?.trim(),
      p.city?.trim(),
      p.country?.trim(),
      p.preferredGender,
      p.minPreferredAge !== null && p.maxPreferredAge !== null,
      p.relationshipGoal?.trim(),
    ];
    const completed = fields.filter((f) => Boolean(f)).length;
    const percentage = Math.round((completed / 9) * 100);
    setCompletion({ percentage, completedFields: completed, totalFields: 9 });
  } catch (err) {
    if (err instanceof Error && "status" in err && err.status === 401) {
      navigation.replace("Auth");
    }
    setError("Unable to load your profile. Please try again.");
  } finally {
    setLoading(false);
  }
}

export function ProfileScreen({ navigation }: { navigation: any }) {
  const [profile, setProfile] = useState<ProfileForm>({
    displayName: "",
    bio: null,
    dateOfBirth: null,
    gender: "",
    city: "",
    country: "",
    preferredGender: "everyeveryone",
    minPreferredAge: 18,
    maxPreferredAge: 50,
    relationshipGoal: "unsure",
  });

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [completion, setCompletion] = useState<{
    percentage: number;
    completedFields: number;
    totalFields: number;
  }>({
    percentage: 0,
    completedFields: 0,
    totalFields: 9,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [photoAction, setPhotoAction] = useState<string | null>(null);

  const route = useRoute();

  // Load profile + photos on mount
  useEffect(() => {
    void loadProfileData(
      apiRequest,
      navigation,
      setProfile,
      setPhotos,
      setCompletion,
      setLoading,
      setError
    );
  }, [navigation, apiRequest, setError]);

  const updateField = useCallback(
    (field: keyof ProfileForm, value: ProfileForm[keyof ProfileForm]) => {
      setProfile((current) => ({ ...current, [field]: value }));
    },
    []
  );

  const handleSaveProfile = async () => {
    setError("");
    setSaving(true);

    try {
      const result = await apiRequest<{ success: boolean; profile: ProfileForm }>(
        "/api/profile",
        {
          method: "PATCH",
          body: JSON.stringify({
            displayName: profile.displayName.trim(),
            bio: profile.bio?.trim() || null,
            dateOfBirth: profile.dateOfBirth,
            gender: profile.gender || null,
            city: profile.city?.trim() || null,
            country: profile.country?.trim() || null,
            preferredGender: profile.preferredGender,
            minPreferredAge: profile.minPreferredAge,
            maxPreferredAge: profile.maxPreferredAge,
            relationshipGoal: profile.relationshipGoal,
          }),
        }
      );

      if (result.success && result.profile) {
        setProfile(result.profile);

        // Recalculate completion
        const p = result.profile;
        const fields = [
          p.displayName?.trim(),
          p.bio?.trim(),
          p.dateOfBirth,
          p.gender?.trim(),
          p.city?.trim(),
          p.country?.trim(),
          p.preferredGender,
          p.minPreferredAge !== null && p.maxPreferredAge !== null,
          p.relationshipGoal?.trim(),
        ];
        const completed = fields.filter((f) => Boolean(f)).length;
        const percentage = Math.round((completed / 9) * 100);
        setCompletion({ percentage, completedFields: completed, totalFields: 9 });

        setNotice("Your profile has been updated.");
      }
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        navigation.replace("Auth");
      }
      setError("Unable to save your profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleSetPrimaryPhoto = async (photoId: string) => {
    setError("");
    setPhotoAction(photoId);

    try {
      await apiRequest<{ success: boolean; photoId: string }>(
        `/api/profile/photos/${photoId}/primary`,
        { method: "PATCH" }
      );

      setNotice("Your primary photo has been updated.");
      await loadProfileData(
        apiRequest,
        navigation,
        setProfile,
        setPhotos,
        setCompletion,
        setLoading,
        setError
      );
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        navigation.replace("Auth");
      }
      setError("Unable to update primary photo. Please try again.");
    } finally {
      setPhotoAction(null);
    }
  };

  const handleDeletePhoto = async (photoId: string) => {
    // Skipping confirm for now

    setError("");
    setPhotoAction(photoId);

    try {
      await apiRequest<{ success: boolean }>(
        `/api/profile/photos/${photoId}`,
        { method: "DELETE" }
      );

      setNotice("Photo deleted successfully.");
      await loadProfileData(
        apiRequest,
        navigation,
        setProfile,
        setPhotos,
        setCompletion,
        setLoading,
        setError
      );
    } catch (err) {
      if (err instanceof Error && "status" in err && err.status === 401) {
        navigation.replace("Auth");
      }
      setError("Unable to delete the photo. Please try again.");
    } finally {
      setPhotoAction(null);
    }
  };

  const handleAddPhoto = () => {
    setError("Photo upload requires ImagePicker. Please install it to use camera/library.");
  };

  if (loading) {
    return (
      <View style={styles.profileContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.profileContainer}
    >
      <View style={styles.header}>
        <Text style={styles.headerText}>Your profile</Text>
        <Text style={styles.headerSubtitle}>
          Tell people a little about yourself and what you are looking for.
        </Text>
      </View>

      <View style={styles.profileContent}>
        {/* Profile Completion Card */}
        <View style={styles.completionCard}>
          <View style={styles.completionTop}>
            <Text style={styles.completionHeading}>Profile completion</Text>
            <Text style={styles.completionSubtitle}>
              {completion.completedFields} of {completion.totalFields} profile sections completed
            </Text>
          </View>

          <View style={styles.completionProgress}>
            <Text style={styles.completionPercentage}>{completion.percentage}%</Text>
            <View style={styles.completionBar}>
              <View style={styles.completionFill} />
            </View>
          </View>
        </View>

        {/* Photo Gallery */}
        <View style={styles.photoSection}>
          <Text style={styles.photoSectionHeading}>Your photos</Text>
          <Text style={styles.photoCount}>
            {photos.length}/{MAX_PHOTOS} photos
          </Text>

          <FlatList
            data={photos}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <View style={styles.photoItem}>
                <RNImage
                  style={styles.photo}
                  source={{ uri: item.url }}
                  resizeMode="cover"
                />
                {item.isPrimary && (
                  <Text style={styles.primaryLabel}>Primary</Text>
                )}
                <View style={styles.photoActions}>
                  <TouchableOpacity
                    onPress={() => void handleSetPrimaryPhoto(item.id)}
                    disabled={photoAction !== null}
                    style={styles.makePrimaryBtn}
                  >
                    {photoAction === item.id ? "Please wait..." : "Make primary"}
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => void handleDeletePhoto(item.id)}
                    style={styles.deleteBtn}
                  >
                    Delete
                  </TouchableOpacity>
                </View>
              </View>
            )}
            numColumns={3}
            contentContainerStyle={styles.photoGrid}
          />

          {photos.length < MAX_PHOTOS && (
            <TouchableOpacity onPress={handleAddPhoto} style={styles.uploadTile}>
              <Text style={styles.uploadText}>Add a photo</Text>
              <Text style={styles.uploadSmall}>JPEG, PNG or WebP · Max 5 MB</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* About You */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>About you</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Display name</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile.displayName}
              onChangeText={(v) => updateField("displayName", v)}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Email address</Text>
            <TextInput
              style={styles.fieldInputDisabled}
              value=""
              editable={false}
            >
              <Text style={styles.fieldInputDisabledNote}>
                Your account email cannot be changed here.
              </Text>
            </TextInput>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>About me</Text>
            <TextInput
              style={styles.fieldTextarea}
              value={profile.bio || ""}
              onChangeText={(v) => updateField("bio", v)}
              multiline={true}
            >
              <Text style={styles.textareaCounter}>
                {(profile.bio?.length ?? 0)}/500 characters
              </Text>
            </TextInput>
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Date of birth</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile.dateOfBirth || ""}
              onChangeText={(v) => updateField("dateOfBirth", v)}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Gender</Text>
            <SelectSimple
              options={[
                { label: "Male", value: "male" },
                { label: "Female", value: "female" },
                { label: "Non-binary", value: "non-binary" },
                { label: "Other", value: "other" },
              ]}
              value={profile.gender || ""}
              onValueChange={(v) => updateField("gender", v)}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile.city || ""}
              onChangeText={(v) => updateField("city", v)}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Country</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile.country || ""}
              onChangeText={(v) => updateField("country", v)}
            />
          </View>
        </View>

        {/* Dating Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionHeading}>Dating preferences</Text>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Show me</Text>
            <SelectSimple
              options={[
                { label: "Everyone", value: "everyone" },
                { label: "Men", value: "male" },
                { label: "Women", value: "female" },
                { label: "Non-binary people", value: "non-binary" },
              ]}
              value={profile.preferredGender || "everyeveryone"}
              onValueChange={(v) => updateField("preferredGender", v)}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Relationship goal</Text>
            <SelectSimple
              options={[
                { label: "Long-term relationship", value: "long-term" },
                { label: "Short-term relationship", value: "short-term" },
                { label: "Friendship", value: "friendship" },
                { label: "Still figuring it out", value: "unsure" },
              ]}
              value={profile.relationshipGoal || "unsure"}
              onValueChange={(v) => updateField("relationshipGoal", v)}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Minimum preferred age</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile.minPreferredAge?.toString() || "18"}
              onChangeText={(v) => updateField("minPreferredAge", Number(v))}
            />
          </View>

          <View style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>Maximum preferred age</Text>
            <TextInput
              style={styles.fieldInput}
              value={profile.maxPreferredAge?.toString() || "50"}
              onChangeText={(v) => updateField("maxPreferredAge", Number(v))}
            />
          </View>
        </View>

        {/* Save Button */}
        <View style={styles.saveButtonContainer}>
          <TouchableOpacity onPress={handleSaveProfile} disabled={saving}>
            {saving ? (
              <Text style={styles.saveButtonText}>Saving...</Text>
            ) : (
              <Text style={styles.saveButtonText}>Save profile</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

// Simple Select component
type SelectSimpleProps = {
  options: { label: string; value: string }[];
  value: string;
  onValueChange: (value: string) => void;
};

function SelectSimple({ options, value, onValueChange }: SelectSimpleProps) {
  return (
    <View style={styles.fieldInput}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          onPress={() => onValueChange(opt.value)}
          style={{
            padding: 6,
            backgroundColor: "#fffdfc",
            borderWidth: 1,
            borderColor: "#e9ded8",
            borderRadius: 4,
          }}
        >
          <Text style={{ color: opt.value === value ? COLORS.primary : COLORS.foreground, padding: 4 }}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  profileContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: SPACING.lg,
  },
  header: {
    marginBottom: SPACING.xl,
  },
  headerText: {
    fontFamily: TYPOGRAPHY.fontFamilySerif,
    fontSize: 32,
    fontWeight: "500",
    color: COLORS.foreground,
    marginBottom: 4,
  },
  headerSubtitle: {
    color: COLORS.muted,
    fontSize: 12,
  },
  profileContent: {
    flexGrow: 1,
  },
  completionCard: {
    padding: SPACING.lg,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: SPACING.lg,
    ...SHADOWS.card,
    marginBottom: SPACING.lg,
  },
  completionTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  completionHeading: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.kicker.fontSize,
    fontWeight: TYPOGRAPHY.kicker.fontWeight,
    letterSpacing: TYPOGRAPHY.kicker.letterSpacing,
    color: COLORS.primary,
    marginBottom: SPACING.sm,
  },
  completionSubtitle: {
    color: COLORS.muted,
    fontSize: 10,
    textTransform: "uppercase",
  },
  completionProgress: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.sm,
  },
  completionPercentage: {
    fontFamily: TYPOGRAPHY.fontFamilySerif,
    fontSize: 24,
    fontWeight: "500",
    color: COLORS.primary,
  },
  completionBar: {
    width: 150,
    height: 8,
    backgroundColor: COLORS.cream,
    borderRadius: 999,
    overflow: "hidden",
  },
  completionFill: {
    height: "100%",
    backgroundColor: COLORS.primary,
  },
  photoSection: {
    marginBottom: SPACING.lg,
  },
  photoSectionHeading: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.h2.fontSize,
    fontWeight: TYPOGRAPHY.h2.fontWeight,
    color: COLORS.foreground,
    marginBottom: SPACING.md,
  },
  photoCount: {
    color: COLORS.muted,
    fontSize: 10,
    marginBottom: SPACING.md,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  photoItem: {
    width: "33.33%",
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: SPACING.md,
    overflow: "hidden",
    backgroundColor: COLORS.photoPlaceholderBg,
  },
  photo: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  primaryLabel: {
    position: "absolute",
    top: 6,
    left: 6,
    padding: 4,
    backgroundColor: COLORS.primary,
    color: "#ffffff",
    fontSize: 8,
    fontWeight: "700",
    borderRadius: 3,
  },
  photoActions: {
    position: "absolute",
    bottom: 0,
    right: 0,
    borderTopLeftRadius: 4,
    borderBottomLeftRadius: 4,
    backgroundColor: "white",
    padding: 6,
    minWidth: 50,
    justifyContent: "center",
  },
  makePrimaryBtn: {
    padding: 6,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 4,
  },
  deleteBtn: {
    padding: 4,
    backgroundColor: COLORS.errorBg,
    borderRadius: 4,
    marginLeft: 4,
  },
  uploadTile: {
    width: "33.33%",
    aspectRatio: 4 / 5,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: SPACING.md,
    backgroundColor: COLORS.photoPlaceholderBg,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  uploadText: {
    color: COLORS.muted,
    fontSize: 10,
  },
  uploadSmall: {
    marginTop: 4,
    color: COLORS.muted,
    fontSize: 9,
  },
  section: {
    marginBottom: SPACING.lg,
  },
  fieldRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#514844",
    flex: 1,
  },
  fieldInput: {
    flex: 1,
    minHeight: 47,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e9ded8",
    borderRadius: 6,
    backgroundColor: "#fffdfc",
    color: COLORS.foreground,
    fontSize: 12,
  },
  fieldInputDisabled: {
    flex: 1,
    minHeight: 47,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "#e9ded8",
    borderRadius: 6,
    backgroundColor: "#f7f2ef",
    color: "#827873",
    fontSize: 12,
  },
  fieldInputDisabledNote: {
    marginLeft: 4,
    fontSize: 9,
    color: "#968780",
  },
  fieldTextarea: {
    flex: 1,
    minHeight: 80,
    padding: 12,
    borderWidth: 1,
    borderColor: "#e8dcd7",
    borderRadius: 7,
    backgroundColor: "#fffdfc",
    color: COLORS.foreground,
    fontSize: 13,
    lineHeight: 1.7,
  },
  textareaCounter: {
    marginTop: 4,
    marginRight: 8,
    fontSize: 10,
    color: "#968780",
  },
  sectionHeading: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.h2.fontSize,
    fontWeight: TYPOGRAPHY.h2.fontWeight,
    color: COLORS.foreground,
    marginBottom: SPACING.md,
    marginTop: 24,
  },
  saveButtonContainer: {
    marginTop: SPACING.lg,
    alignItems: "center",
  },
  saveButtonText: {
    fontFamily: TYPOGRAPHY.fontFamilySerif,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primary,
  },
});