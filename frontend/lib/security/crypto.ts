/**
 * Standard cryptographic utilities for the frontend.
 * Used for generating ballot hashes to ensure vote anonymity and integrity.
 */

/**
 * Generates a SHA-256 hash from a string.
 */
export async function sha256(message: string): Promise<string> {
  const msgUint8 = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generates a ballot hash for a voting option.
 * Rec(2004)11 §26 – hash = SHA-256(votingId + optionId + clientNonce)
 */
export async function generateBallotHash(
  entityId: string, // votingId or surveyId
  optionId: string,
  nonce: string = crypto.randomUUID(),
): Promise<string> {
  return sha256(`${entityId}:${optionId}:${nonce}`);
}

/**
 * Generates a survey ballot hash for a question option.
 */
export async function generateSurveyBallotHash(
  surveyId: string,
  questionId: string,
  optionId: string,
  nonce: string = crypto.randomUUID(),
): Promise<string> {
  return sha256(`${surveyId}:${questionId}:${optionId}:${nonce}`);
}
