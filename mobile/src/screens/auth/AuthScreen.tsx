import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';

import { apiRequest } from '../../lib/api';
import { COLORS, TYPOGRAPHY, HEART_MARK } from '../../theme';

type Mode = 'login' | 'register';

export function AuthScreen({ onAuthSuccess }: { onAuthSuccess: () => void }) {
  const [mode, setMode] = useState<Mode>('login');
  const [loading, setLoading] = useState(false);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register fields
  const [regName, setRegName] = useState('');
  const [regEmail, _setRegEmail] = useState('');
  const [regPassword, _setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleLogin = async () => {
    setError('');
    setLoading(true);

    try {
      await apiRequest<{ success: boolean }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: loginEmail.trim().toLowerCase(),
          password: loginPassword,
        }),
      });

      // Verify session is valid — RootNavigator will check /api/auth/me on next render
      setLoading(false);
      onAuthSuccess();
    } catch (err) {
      setLoading(false);
      if (err instanceof Error) {
        setError(err.message || 'Login failed. Please try again.');
      }
    }
  };

  const handleRegister = async () => {
    setError('');
    setLoading(true);

    try {
      const password = regPassword;
      const confirmPassword = regConfirmPassword;

      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        setLoading(false);
        return;
      }

      if (password.length < 12) {
        setError('Password must be at least 12 characters.');
        setLoading(false);
        return;
      }

      await apiRequest<{ success: boolean }>('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          displayName: regName.trim(),
          email: regEmail.trim().toLowerCase(),
          password,
        }),
      });

      // Verify session
      onAuthSuccess();
    } catch (err) {
      setLoading(false);
      if (err instanceof Error) {
        setError(err.message || 'Registration failed. Please try again.');
      }
    }
  };

  const renderAuthForm = () => {
    const isLogin = mode === 'login';
    return (
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.formContainer}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.brandContainerSmall}>
            <Text style={styles.brandMark}>{HEART_MARK}</Text>
            <Text style={styles.brandText}>
              lets<span style={{ color: COLORS.primary }}>date</span>
            </Text>
          </View>

          <View style={styles.heading}>
            <Text style={styles.kicker}>
              {isLogin ? 'WELCOME BACK' : 'YOUR STORY STARTS HERE'}
            </Text>
            <Text style={styles.title}>
              {isLogin ? 'Lovely to see you again.' : 'Meet your next chapter.'}
            </Text>
            <Text style={styles.subtitle}>
              {isLogin
                ? 'Sign in and continue discovering meaningful connections.'
                : 'Create your account and make room for meaningful connections.'}
            </Text>
          </View>

          {success ? (
            <View style={styles.successPanel}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.successTitle}>
                You&apos;re one step closer!
              </Text>
              <Text style={styles.successText}>{success}</Text>
              <TouchableOpacity
                style={styles.successButton}
                onPress={() => {
                  setSuccess('');
                  setMode('login');
                }}
              >
                <Text style={styles.successButtonText}>Go to login</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              {isLogin && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Email address</Text>
                  <TextInput
                    style={styles.input}
                    value={loginEmail}
                    onChangeText={setLoginEmail}
                    placeholder="you@example.com"
                    autoComplete="email"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              )}

              {isLogin && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Password</Text>
                  <TextInput
                    style={styles.input}
                    value={loginPassword}
                    onChangeText={setLoginPassword}
                    placeholder="Enter your password"
                    secureTextEntry
                    autoComplete="current-password"
                  />
                </View>
              )}

              {!isLogin && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Your name</Text>
                  <TextInput
                    style={styles.input}
                    value={regName}
                    onChangeText={setRegName}
                    placeholder="How should we call you?"
                    autoCapitalize="words"
                    autoComplete="name"
                  />
                </View>
              )}

              {!isLogin && (
                <View style={styles.field}>
                  <Text style={styles.fieldLabel}>Confirm password</Text>
                  <TextInput
                    style={styles.input}
                    value={regConfirmPassword}
                    onChangeText={setRegConfirmPassword}
                    placeholder="Enter your password again"
                    secureTextEntry
                    autoComplete="new-password"
                  />
                </View>
              )}

              {error && (
                <View style={styles.errorBanner}>
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              )}

              <TouchableOpacity
                style={styles.submitButton}
                onPress={isLogin ? handleLogin : handleRegister}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#ffffff" />
                ) : (
                  <Text style={styles.submitButtonText}>
                    {isLogin ? 'Log in to LetsDate' : 'Create my account'}
                  </Text>
                )}
              </TouchableOpacity>

              <View style={styles.switchContainer}>
                <Text style={styles.switchText}>
                  {isLogin
                    ? "Don't have an account?"
                    : 'Already have an account?'}{' '}
                </Text>
                <TouchableOpacity
                  style={styles.switchLink}
                  onPress={() => setMode(isLogin ? 'register' : 'login')}
                >
                  <Text style={styles.switchLinkText}>
                    {isLogin ? 'Create an account' : 'Log in'}
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity
            style={styles.backButton}
            onPress={() => setMode('login')}
          >
            <Text style={styles.backText}>← Back to LetsDate home</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  };

  return <>{renderAuthForm()}</>;
}

const styles = {
  formContainer: {
    flex: 1,
    backgroundColor: COLORS.background,
    padding: 24,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  brandContainerSmall: {
    alignItems: 'center',
    marginBottom: 24,
  },
  brandMark: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: COLORS.primary,
    color: '#ffffff',
    fontSize: 21,
    textAlign: 'center',
    lineHeight: 34,
  },
  brandText: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: 25,
    fontWeight: '800',
    color: COLORS.foreground,
    marginTop: 8,
  },
  heading: {
    alignItems: 'center',
    marginBottom: 24,
  },
  kicker: {
    fontFamily: TYPOGRAPHY.fontFamily,
    fontSize: TYPOGRAPHY.kicker.fontSize,
    fontWeight: TYPOGRAPHY.kicker.fontWeight,
    letterSpacing: TYPOGRAPHY.kicker.letterSpacing,
    color: TYPOGRAPHY.kicker.color,
    textTransform: TYPOGRAPHY.kicker.textTransform,
    marginBottom: 12,
  },
  title: {
    fontFamily: TYPOGRAPHY.fontFamilySerif,
    fontSize: TYPOGRAPHY.h1.fontSize,
    fontWeight: TYPOGRAPHY.h1.fontWeight,
    letterSpacing: TYPOGRAPHY.h1.letterSpacing,
    color: TYPOGRAPHY.h1.color,
    textAlign: 'center',
    lineHeight: 1.1,
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 1.8,
    color: COLORS.muted,
    textAlign: 'center',
    marginTop: 8,
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#514844',
    marginBottom: 6,
  },
  input: {
    width: '100%',
    minHeight: 47,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#e9ded8',
    borderRadius: 6,
    backgroundColor: '#fffdfc',
    color: COLORS.foreground,
    fontSize: 12,
  },
  errorBanner: {
    padding: 12,
    borderWidth: 1,
    borderColor: COLORS.errorBorder,
    borderRadius: 6,
    backgroundColor: COLORS.errorBg,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 11,
    color: COLORS.errorText,
    lineHeight: 1.6,
  },
  submitButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
  switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
  },
  switchText: {
    fontSize: 11,
    color: COLORS.muted,
  },
  switchLink: {
    marginLeft: 4,
  },
  switchLinkText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b34759',
  },
  backButton: {
    marginTop: 24,
    alignItems: 'center',
  },
  backText: {
    fontSize: 9,
    color: '#968781',
    fontWeight: '700',
  },
  successPanel: {
    padding: 24,
    borderRadius: 9,
    backgroundColor: '#fff5f1',
    alignItems: 'center',
    marginBottom: 16,
  },
  successIcon: {
    width: 43,
    height: 43,
    borderRadius: 21,
    backgroundColor: '#e7f3e9',
    color: '#287b43',
    fontSize: 22,
    textAlign: 'center',
    lineHeight: 43,
    marginBottom: 12,
  },
  successTitle: {
    fontFamily: TYPOGRAPHY.fontFamilySerif,
    fontSize: 23,
    fontWeight: '500',
    color: COLORS.foreground,
    marginBottom: 6,
    textAlign: 'center',
  },
  successText: {
    fontSize: 12,
    lineHeight: 1.7,
    color: COLORS.muted,
    textAlign: 'center',
    marginBottom: 12,
  },
  successButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 6,
    paddingVertical: 10,
    alignItems: 'center',
    width: '100%',
  },
  successButtonText: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 12,
  },
} as const;
