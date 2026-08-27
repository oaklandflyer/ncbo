/**
 * The hometown regions members have already entered.
 *
 * One helper, called by both forms that ask the question — onboarding and
 * profile edit — because two copies of this read is two places for the list to
 * drift, and a suggestion list that differs between the form that creates a
 * value and the form that corrects it recreates the duplicates it exists to
 * prevent.
 *
 * `get_home_regions()` is SECURITY DEFINER: onboarding runs before approval,
 * and `profiles_read` requires `is_approved()`, so a plain select would hand a
 * pending member an empty list. See migration 0039.
 *
 * A failed read costs the suggestions and nothing else. The field is a plain
 * text input with a datalist attached, so an empty list leaves exactly the box
 * that shipped before this — degraded, never broken.
 */
export async function getHomeRegions(supabase) {
  const { data, error } = await supabase.rpc('get_home_regions');

  if (error) {
    console.error('[ncbo] home region suggestions failed', {
      code: error.code, message: error.message,
    });
    return [];
  }

  return (data || [])
    .map((row) => row.home_region)
    .filter(Boolean);
}
