// src/lib/specialOfferEligibility.ts
//
// Enforces the two numeric limits on a special offer (e.g. Phonics:
// first 30 students, 3 months each) server-side via Firestore
// transactions — never by counting rows client-side. Mirrors the
// Tx/standalone split in groupBatches.ts so AdminPayments.tsx can
// compose the slot-claim into the same atomic commit as the payment
// approval + enrolment activation + batch assignment.
//
// Collections (admin-write-only except the one narrow self-service
// field noted below — see firestore.rules):
//   special_offer_counters/{offerKey}                 { offer_key, claimed_count }
//   special_offer_eligibility/{offerKey}_{studentId}  { offer_key, student_id, months_granted,
//                                                        months_used, free_competition_entry,
//                                                        free_competition_entry_used, active }
//
// Design notes:
//   - The cap is claimed ONCE, the first time a student is approved
//     for this offer (see AdminPayments.tsx: claim on first approval,
//     consume-a-month on every renewal approval after that).
//   - The approval transaction validates the submitted payment amount
//     against the authoritative eligibility decision. A discounted amount
//     is rejected when the first-N cap is exhausted or the student's
//     discounted months are exhausted; the regular amount is required
//     instead. This prevents a stale/client-tampered checkout price from
//     bypassing the offer limits.
//   - `months_used` increments on every renewal approval; once it
//     reaches `months_granted`, `active` flips false and Payment.tsx's
//     checkout price reverts to the offer's regular price for that
//     student from then on.


import { doc, getDoc, increment, runTransaction, serverTimestamp, updateDoc, type Transaction } from 'firebase/firestore'
import { firestore } from '@/lib/firebase'
import type { SpecialOfferConfig } from '@/lib/pricingModel'
import type { SpecialOfferKey } from '@/lib/coursePricing'

function counterRef(offerKey: SpecialOfferKey) {
  return doc(firestore, 'special_offer_counters', offerKey)
}
function eligibilityRef(offerKey: SpecialOfferKey, studentId: string) {
  return doc(firestore, 'special_offer_eligibility', `${offerKey}_${studentId}`)
}

export interface OfferEligibility {
  offerKey: SpecialOfferKey
  claimedAt: string
  monthsGranted: number | null
  monthsUsed: number
  freeCompetitionEntry: boolean
  freeCompetitionEntryUsed: boolean
  /** Whether the discounted offer price still applies to this student right now. */
  active: boolean
}

function fromDoc(offerKey: SpecialOfferKey, d: Record<string, unknown>): OfferEligibility {
  return {
    offerKey,
    claimedAt: (d.claimed_at as string) ?? new Date(0).toISOString(),
    monthsGranted: (d.months_granted as number | null) ?? null,
    monthsUsed: (d.months_used as number) ?? 0,
    freeCompetitionEntry: !!d.free_competition_entry,
    freeCompetitionEntryUsed: !!d.free_competition_entry_used,
    active: !!d.active,
  }
}

/**
 * Best-effort, NON-authoritative read for checkout-page price display
 * before any eligibility record exists for this student. The real
 * decision happens in claimOfferSlotTx at admin-approval time — this
 * is only so Payment.tsx doesn't have to show a wrong price to a
 * first-time visitor.
 */
export async function peekOfferAvailability(offerKey: SpecialOfferKey, maxStudents: number | null): Promise<boolean> {
  if (maxStudents == null) return true
  const snap = await getDoc(counterRef(offerKey))
  const claimed = snap.exists() ? ((snap.data().claimed_count as number) ?? 0) : 0
  return claimed < maxStudents
}

export async function getOfferEligibility(offerKey: SpecialOfferKey, studentId: string): Promise<OfferEligibility | null> {
  const snap = await getDoc(eligibilityRef(offerKey, studentId))
  if (!snap.exists()) return null
  return fromDoc(offerKey, snap.data())
}

/**
 * Authoritative, race-safe first-N claim — call exactly once, at
 * admin-approval time, for a student's FIRST payment on this offer.
 * Idempotent: if an eligibility doc already exists for this
 * student+offer, it's returned unchanged rather than double-claimed
 * (guards a double-click / retry from consuming two slots).
 */
export async function claimOfferSlotTx(
  tx: Transaction,
  offerKey: SpecialOfferKey,
  studentId: string,
  offer: SpecialOfferConfig,
  paymentAmount?: number
): Promise<OfferEligibility> {
  const eRef = eligibilityRef(offerKey, studentId)
  const existingSnap = await tx.get(eRef)
  if (existingSnap.exists()) {
    const existing = fromDoc(offerKey, existingSnap.data())
    if (paymentAmount != null) {
      const expectedAmount = existing.active ? offer.offerPrice : offer.regularPrice
      if (paymentAmount !== expectedAmount) {
        throw new Error(
          existing.active
            ? `This special-offer payment must be ₹${offer.offerPrice.toLocaleString('en-IN')}.`
            : `This special offer is no longer available. The payment must be ₹${offer.regularPrice.toLocaleString('en-IN')}.`
        )
      }
    }
    return existing
  }

  const cRef = counterRef(offerKey)
  const counterSnap = await tx.get(cRef)
  const claimedCount = counterSnap.exists() ? ((counterSnap.data().claimed_count as number) ?? 0) : 0
  const withinCap = offer.offerMaxStudents == null || claimedCount < offer.offerMaxStudents

  if (paymentAmount != null) {
    const expectedAmount = withinCap ? offer.offerPrice : offer.regularPrice
    if (paymentAmount !== expectedAmount) {
      throw new Error(
        withinCap
          ? `This special-offer payment must be ₹${offer.offerPrice.toLocaleString('en-IN')}.`
          : `This special offer is no longer available. The payment must be ₹${offer.regularPrice.toLocaleString('en-IN')}.`
      )
    }
  }

  const claimedAt = new Date().toISOString()
  const eligibility: OfferEligibility = {
    offerKey,
    claimedAt,
    monthsGranted: withinCap ? offer.offerDurationMonths : null,
    monthsUsed: withinCap ? 1 : 0, // this approval is month 1
    freeCompetitionEntry: withinCap && offer.includesFreeCompetitionEntry,
    freeCompetitionEntryUsed: false,
    active: withinCap,
  }

  if (withinCap) {
    tx.set(cRef, { offer_key: offerKey, claimed_count: increment(1) }, { merge: true })
  }
  tx.set(eRef, {
    offer_key: offerKey,
    student_id: studentId,
    claimed_at: claimedAt,
    months_granted: eligibility.monthsGranted,
    months_used: eligibility.monthsUsed,
    free_competition_entry: eligibility.freeCompetitionEntry,
    free_competition_entry_used: false,
    active: eligibility.active,
    created_at: serverTimestamp(),
  })

  return eligibility
}

export async function claimOfferSlot(offerKey: SpecialOfferKey, studentId: string, offer: SpecialOfferConfig): Promise<OfferEligibility> {
  return runTransaction(firestore, (tx) => claimOfferSlotTx(tx, offerKey, studentId, offer))
}

/**
 * Call on every renewal approval (2nd month onward) to advance the
 * offer clock. Returns whether the discount still applies to this
 * payment's period. Once `months_used` reaches `months_granted`, this
 * flips `active` to false so future checkouts show the regular price.
 */
export async function consumeOfferMonthTx(
  tx: Transaction,
  offerKey: SpecialOfferKey,
  studentId: string,
  offer: SpecialOfferConfig,
  paymentAmount?: number
): Promise<boolean> {
  const eRef = eligibilityRef(offerKey, studentId)
  const snap = await tx.get(eRef)
  if (!snap.exists()) {
    if (paymentAmount != null && paymentAmount !== offer.regularPrice) {
      throw new Error(
        `This special offer is not active for this student. The payment must be ₹${offer.regularPrice.toLocaleString('en-IN')}.`
      )
    }
    return false
  }
  const d = snap.data()
  if (!d.active) {
    if (paymentAmount != null && paymentAmount !== offer.regularPrice) {
      throw new Error(
        `This special offer has ended for this student. The payment must be ₹${offer.regularPrice.toLocaleString('en-IN')}.`
      )
    }
    return false
  }

  const monthsGranted = d.months_granted as number | null
  const monthsUsed = (d.months_used as number) ?? 0

  if (monthsGranted != null && monthsUsed >= monthsGranted) {
    if (paymentAmount != null && paymentAmount !== offer.regularPrice) {
      throw new Error(
        `This special offer has ended for this student. The payment must be ₹${offer.regularPrice.toLocaleString('en-IN')}.`
      )
    }
    tx.update(eRef, { active: false })
    return false
  }

  if (paymentAmount != null) {
    const expectedAmount = offer.offerPrice
    if (paymentAmount !== expectedAmount) {
      throw new Error(
        `This discounted renewal must be ₹${offer.offerPrice.toLocaleString('en-IN')}.`
      )
    }
  }

  const stillActiveAfter = monthsGranted == null || monthsUsed + 1 < monthsGranted
  tx.update(eRef, { months_used: monthsUsed + 1, active: stillActiveAfter })
  return true
}

export async function consumeOfferMonth(
  offerKey: SpecialOfferKey,
  studentId: string,
  offer: SpecialOfferConfig,
  paymentAmount?: number
): Promise<boolean> {
  return runTransaction(firestore, (tx) => consumeOfferMonthTx(tx, offerKey, studentId, offer, paymentAmount))
}

/** Marks the one-time free VATTAMS competition entry as used. Self-service (student-owned, one-directional false->true — see firestore.rules). */
export async function markFreeCompetitionEntryUsed(offerKey: SpecialOfferKey, studentId: string): Promise<void> {
  await updateDoc(eligibilityRef(offerKey, studentId), { free_competition_entry_used: true })
}
