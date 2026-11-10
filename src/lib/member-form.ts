export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9])(?=.*[!@#$%^&*])[A-Za-z0-9!@#$%^&*]{8,}$/;

export function isEmailValid(value: string): boolean {
  return value.trim().length <= 254 && EMAIL_REGEX.test(value.trim());
}

export function isNicknameValid(value: string): boolean {
  const length = [...value.trim()].length;
  return length >= 2 && length <= 12;
}

export function isSignupPasswordValid(value: string): boolean {
  return PASSWORD_REGEX.test(value) && new TextEncoder().encode(value).length <= 72;
}

// Existing members may have passwords created under a different signup policy.
export function canPreviewLogin(email: string, password: string): boolean {
  return isEmailValid(email) && password.length > 0;
}
