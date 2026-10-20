// Canonical eligibility status constants (mirror backend engine.py — spec section 6).
// Kept in one place so every component renders the same 4-tier result consistently.
export const LIKELY_ELIGIBLE = 'LIKELY_ELIGIBLE';
export const POTENTIALLY_ELIGIBLE_INFO_REQUIRED = 'POTENTIALLY_ELIGIBLE_INFO_REQUIRED';
export const NOT_ELIGIBLE_CONDITIONS_NOT_MET = 'NOT_ELIGIBLE_CONDITIONS_NOT_MET';
export const CANNOT_CONFIRM_VERIFY_OFFICIAL = 'CANNOT_CONFIRM_VERIFY_OFFICIAL';

// Legacy -> canonical, so any older API payload still renders.
const ALIASES = {
  'MAY BE ELIGIBLE': LIKELY_ELIGIBLE,
  'MORE INFORMATION REQUIRED': POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
  'DOES NOT MATCH STATED CRITERIA': NOT_ELIGIBLE_CONDITIONS_NOT_MET,
  Eligible: LIKELY_ELIGIBLE,
  'Possibly Eligible': POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
  'More Information Required': POTENTIALLY_ELIGIBLE_INFO_REQUIRED,
  'Not Eligible': NOT_ELIGIBLE_CONDITIONS_NOT_MET,
};

export const normalizeStatus = (status) => ALIASES[status] || status;

export const STATUS_META = {
  [LIKELY_ELIGIBLE]: {
    label: 'Likely Eligible',
    badge: 'bg-green-100 text-green-800 border-green-200',
    text: 'text-green-600',
  },
  [POTENTIALLY_ELIGIBLE_INFO_REQUIRED]: {
    label: 'More Information Needed',
    badge: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    text: 'text-yellow-600',
  },
  [NOT_ELIGIBLE_CONDITIONS_NOT_MET]: {
    label: 'Conditions Not Met',
    badge: 'bg-red-100 text-red-800 border-red-200',
    text: 'text-red-600',
  },
  [CANNOT_CONFIRM_VERIFY_OFFICIAL]: {
    label: 'Verify with Official Source',
    badge: 'bg-slate-100 text-slate-800 border-slate-200',
    text: 'text-slate-600',
  },
};

export const statusMeta = (status) =>
  STATUS_META[normalizeStatus(status)] ||
  { label: status || 'Unknown', badge: 'bg-gray-100 text-gray-700 border-gray-200', text: 'text-gray-600' };

// Section-17 disclaimer (verbatim guardrail).
export const OFFICIAL_DISCLAIMER =
  'GovtGuide AI provides informational assistance only. It does not guarantee eligibility, ' +
  'approval, or benefit amounts. Always verify the latest official criteria, deadlines, and ' +
  'application process on the relevant government website before applying. Never share your ' +
  'Aadhaar number, bank details, OTPs, or passwords with GovtGuide AI.';
