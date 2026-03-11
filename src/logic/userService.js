import { supabase } from '../config/supabase';

const FREE_LIMIT = 3;

/**
 * Gets or creates a user profile in the database.
 */
export async function getOrCreateProfile(user) {
  const { data: existingProfile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (existingProfile) {
    return { profile: existingProfile, error: null };
  }

  // Profile doesn't exist yet — create it
  const { data: newProfile, error: createError } = await supabase
    .from('user_profiles')
    .insert({
      id: user.id,
      email: user.email,
      plan: 'free',
      analysis_count: 0,
      last_reset: getCurrentMonth(),
    })
    .select()
    .single();

  return { profile: newProfile, error: createError };
}

/**
 * Checks if the phone number is already bound to ANOTHER user (anti-sharing).
 * Returns true if the phone is free or already belongs to this user.
 */
export async function validatePhoneBinding(userId, phone) {
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('phone', phone)
    .neq('id', userId)
    .maybeSingle();

  if (error) return { allowed: false, error };
  // If data is not null, phone belongs to another user
  if (data) return { allowed: false, error: null };
  return { allowed: true, error: null };
}

/**
 * Links a verified phone to the user's profile.
 */
export async function linkPhoneToProfile(userId, phone) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ phone })
    .eq('id', userId)
    .select()
    .single();

  return { profile: data, error };
}

/**
 * Resets analysis_count if the month has changed.
 */
export async function checkAndResetMonthly(profile) {
  const currentMonth = getCurrentMonth();
  if (profile.last_reset !== currentMonth) {
    const { data, error } = await supabase
      .from('user_profiles')
      .update({ analysis_count: 0, last_reset: currentMonth })
      .eq('id', profile.id)
      .select()
      .single();
    return { profile: data, error };
  }
  return { profile, error: null };
}

/**
 * Checks whether the user can perform an analysis.
 */
export function canAnalyze(profile) {
  if (profile.plan === 'premium') return true;
  return profile.analysis_count < FREE_LIMIT;
}

/**
 * Increments the analysis counter for a user.
 */
export async function incrementUsage(userId, currentCount) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ analysis_count: currentCount + 1 })
    .eq('id', userId)
    .select()
    .single();
  return { profile: data, error };
}

/**
 * Upgrades a user to premium (demo — in production, use a payment webhook).
 */
export async function setPlan(userId, plan) {
  const { data, error } = await supabase
    .from('user_profiles')
    .update({ plan })
    .eq('id', userId)
    .select()
    .single();
  return { profile: data, error };
}

export function getCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export const FREE_ANALYSIS_LIMIT = FREE_LIMIT;
