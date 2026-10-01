export function calculateAge(dateOfBirth: string, asOf = new Date()): number | null {
  const dob = new Date(`${dateOfBirth}T00:00:00`)
  if (Number.isNaN(dob.getTime())) return null

  let age = asOf.getFullYear() - dob.getFullYear()
  const monthDiff = asOf.getMonth() - dob.getMonth()

  if (
    monthDiff < 0 ||
    (monthDiff === 0 && asOf.getDate() < dob.getDate())
  ) {
    age -= 1
  }

  return age >= 0 ? age : null
}

export function isAgeEligible(
  dateOfBirth: string,
  minAge: number | null | undefined,
  maxAge: number | null | undefined,
  asOf = new Date(),
): boolean {
  if (minAge == null && maxAge == null) return true

  const age = calculateAge(dateOfBirth, asOf)
  if (age == null) return false

  if (minAge != null && age < minAge) return false
  if (maxAge != null && age > maxAge) return false

  return true
}
