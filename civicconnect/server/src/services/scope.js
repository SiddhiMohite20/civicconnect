// Server-side data scoping. Every complaint query and access check goes through these helpers.
export const isStaffLike = (u) => u.role === 'staff' || u.role === 'admin';

export function scopeFilter(user) {
  if (user.role === 'resident') return { reporter: user._id };
  const f = { organization: user.organization };
  if (user.role === 'staff' && user.jurisdictions?.length) f.jurisdiction = { $in: user.jurisdictions };
  return f;
}

export function canView(user, c) {
  if (user.role === 'resident') return String(c.reporter?._id || c.reporter) === String(user._id);
  if (String(c.organization) !== String(user.organization)) return false;
  if (user.role === 'staff' && user.jurisdictions?.length) return user.jurisdictions.some((j) => String(j) === String(c.jurisdiction));
  return true;
}

export function covers(staffUser, jurisdictionId) {
  return staffUser.role === 'admin' || !staffUser.jurisdictions?.length || staffUser.jurisdictions.some((j) => String(j) === String(jurisdictionId));
}
