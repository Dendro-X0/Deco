const ONBOARDING_KEY = 'deco_onboarding_completed_v1';

export function hasCompletedOnboarding(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1';
  } catch {
    return false;
  }
}

export function markOnboardingCompleted(): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1');
  } catch {
    /* ignore */
  }
}
