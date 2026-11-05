import AsyncStorage from "@react-native-async-storage/async-storage";

const SESSION_TOKEN_KEY = "letsdate_session";

export const sessionService = {
  /** Get the stored session token */
  async getToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(SESSION_TOKEN_KEY);
    } catch {
      return null;
    }
  },

  /** Store the session token */
  async setToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(SESSION_TOKEN_KEY, token);
    } catch {
      // Silent fail — storage not available
    }
  },

  /** Clear the stored session token (logout) */
  async clearToken(): Promise<void> {
    try {
      await AsyncStorage.removeItem(SESSION_TOKEN_KEY);
    } catch {
      // Silent fail
    }
  },

  /** Build the Cookie header value for API requests */
  async getCookieHeader(): Promise<string> {
    const token = await this.getToken();
    if (!token) return "";
    return `letsdate_session=${token}`;
  }
};
