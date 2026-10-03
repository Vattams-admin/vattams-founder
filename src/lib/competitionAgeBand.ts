import {
  calculateAge,
} from './ageEligibility'

import type {
  CompetitionAgeBand,
} from './competitionQuestionSelector'

export function getCompetitionAgeBand(
  dateOfBirth: string,
  asOf = new Date(),
): CompetitionAgeBand | null {
  const age = calculateAge(dateOfBirth, asOf)

  if (age == null) {
    return null
  }

  if (age <= 8) {
    return 'up_to_8'
  }

  if (age <= 12) {
    return 'age_9_12'
  }

  if (age <= 15) {
    return 'age_13_15'
  }

  return 'age_16_plus'
}

export function getCompetitionAgeBandFromAge(
  age: number,
): CompetitionAgeBand | null {
  if (!Number.isInteger(age) || age < 0) {
    return null
  }

  if (age <= 8) {
    return 'up_to_8'
  }

  if (age <= 12) {
    return 'age_9_12'
  }

  if (age <= 15) {
    return 'age_13_15'
  }

  return 'age_16_plus'
}
