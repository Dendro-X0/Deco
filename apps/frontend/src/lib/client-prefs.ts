const ONBOARDING_KEY = 'deco_onboarding_completed_v1';
const PERSONA_SETUP_KEY = 'deco_persona_setup_completed_v1';

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

export function hasCompletedPersonaSetup(): boolean {
  try {
    return localStorage.getItem(PERSONA_SETUP_KEY) === '1';
  } catch {
    return false;
  }
}

export function markPersonaSetupCompleted(): void {
  try {
    localStorage.setItem(PERSONA_SETUP_KEY, '1');
  } catch {
    /* ignore */
  }
}

/** Welcome done but persona volumes/profile step never finished (v1.1+). */
export function needsPersonaSetup(): boolean {
  return hasCompletedOnboarding() && !hasCompletedPersonaSetup();
}
