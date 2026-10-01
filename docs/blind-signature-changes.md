# Сліпі підписи: що і як змінити

Чекліст у стилі попереднього файлу з багами. Все зафіксовано по реальному коду репозиторію `Sterenchuk/voting-secure`.

**Важливо:** `schema.prisma` вже частково змінено (`Ballot.tokenHashed → blindSignature`, `VoteParticipation.signatureUsed`), але код ще пише `tokenHashed` — застосунок не працюватиме з новою схемою, поки не виконано кроки нижче.

---

## 1. CryptoUtils — додати методи сліпого підпису

Файл: `backend/src/common/utils/crypto-utils.ts`

```ts
import * as crypto from 'crypto';

// ─── RSA blind signatures (Chaum) ─────────────────────────────────────────────

// keypair per voting/survey; private key НІКОЛИ не покидає сервер
static generateVotingKeyPair(keySize = 2048): {
  publicKey: string;   // PEM
  privateKey: string;  // PEM (зберігати в env / vault, НЕ в БД)
} {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: keySize,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

// Бібліотека: повертає { n, e } з PEM-публічного ключа (server-side)
static rsaPublicParams(publicKeyPem: string): { n: bigint; e: bigint } {
  const key = crypto.createPublicKey(publicKeyPem);
  const jwk = key.export({ format: 'jwk' }) as any;
  return { n: BigInt(`0x${Buffer.from(jwk.n!, 'base64url').toString('hex')}`),
           e: BigInt(`0x${Buffer.from(jwk.e!, 'base64url').toString('hex')}`) };
}

// КЛІЄНТ: blinded = T · r^e (mod n)
// tokenHex — 64 hex (256 bit), modulusHex — hex(n), exponentHex — hex(e)
static blindToken(
  tokenHex: string,
  r: bigint,
  modulusHex: string,
  exponentHex: string,
): string {
  const n = BigInt(`0x${modulusHex}`);
  const e = BigInt(`0x${exponentHex}`);
  const T = BigInt(`0x${tokenHex}`);
  const blinded = (T * this.modPow(r, e, n)) % n;
  return blinded.toString(16).padStart(modulusHex.length, '0');
}

// СЕРВЕР: blindSig = blinded^d (mod n) — сирий RSA (без padding)
static signBlinded(blindedHex: string, privateKeyPem: string): string {
  const privateKey = crypto.createPrivateKey(privateKeyPem);
  const size = privateKey.asymmetricKeyDetails.modulusLength / 8;
  const buf = Buffer.from(blindedHex.padStart(size * 2, '0'), 'hex');
  const sig = crypto.privateDecrypt(
    { key: privateKey, padding: crypto.constants.RSA_NO_PADDING },
    buf,
  );
  return sig.toString('hex');
}

// КЛІЄНТ: sig = blindSig · r⁻¹ (mod n) ≡ T^d (mod n)
static unblind(
  blindSigHex: string,
  r: bigint,
  modulusHex: string,
): string {
  const n = BigInt(`0x${modulusHex}`);
  const s = (BigInt(`0x${blindSigHex}`) * this.modInverse(r, n)) % n;
  return s.toString(16).padStart(modulusHex.length, '0');
}

// СЕРВЕР: verify: sig^e ≡ T (mod n)
static verifyBlindSignature(
  tokenHex: string,
  signatureHex: string,
  publicKeyPem: string,
): boolean {
  const { n, e } = this.rsaPublicParams(publicKeyPem);
  const T = BigInt(`0x${tokenHex}`);
  const s = BigInt(`0x${signatureHex}`);
  return this.modPow(s, e, n) === T;
}

// ─── утиліти ──────────────────────────────────────────────────────────────────

static modPow(base: bigint, exp: bigint, mod: bigint): bigint {
  let result = 1n;
  base %= mod;
  while (exp > 0n) {
    if (exp & 1n) result = (result * base) % mod;
    base = (base * base) % mod;
    exp >>= 1n;
  }
  return result;
}

static modInverse(a: bigint, m: bigint): bigint {
  const [g, x] = this.egcd(a % m, m);
  if (g !== 1n) throw new Error('r is not invertible mod n');
  return ((x % m) + m) % m;
}

private static egcd(a: bigint, b: bigint): [bigint, bigint, bigint] {
  if (b === 0n) return [a, 1n, 0n];
  const [g, x1, y1] = this.egcd(b, a % b);
  return [g, y1, x1 - (a / b) * y1];
}
```

**Змінити наявні методи:**

```ts
// 1. Без дефолтних ключів шифрування — кидаємо, якщо ENV немає
private static getEncryptionKeys(): string[] {
  const keysStr = process.env.ENCRYPTION_KEYS;
  if (!keysStr) throw new Error('ENCRYPTION_KEYS environment variable is not set');
  return keysStr.split(',').map((k) => k.trim());
}

// 2. Blind index: нормалізація перед хешем (уникнути колізій)
static getBlindIndex(text: string): string {
  if (!text) return '';
  return crypto
    .createHmac('sha256', this.getBlindIndexKey())
    .update(text.normalize('NFKC').trim().toLowerCase())
    .digest('hex');
}

// 3. hashToken → HMAC-SHA256 (стійкість до rainbow-таблиць)
static hashToken(token: string): string {
  const secret = process.env.TOKEN_HASH_SECRET;
  if (!secret) throw new Error('TOKEN_HASH_SECRET environment variable is not set');
  return crypto.createHmac('sha256', secret).update(token).digest('hex');
}
```

---

## 2. Schema (Prisma) — довершити зміни

Файл: `backend/prisma/schema.prisma`

```prisma
// Вже змінено (робоча копія):
model Ballot {
  ...
  blindSignature String  @unique   // ✅ вже є
  ...
}
model VoteParticipation {
  ...
  signatureUsed Boolean  @default(false)   // ✅ вже є
  ...
}

// ДОДАТИ:

// Відкладений бюлетень — зберігає selections до кроку vote
model PendingBallot {
  id         String   @id @default(uuid())
  tokenHash  String   @unique
  userId     String
  votingId   String?
  surveyId   String?
  selections Json
  blindSig   String
  expiresAt  DateTime
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([expiresAt])
}

// Публічний ключ для верифікації підписів
model VotingSigningKey {
  id        String   @id @default(uuid())
  votingId  String?  @unique
  surveyId  String?  @unique
  publicKey String
  createdAt DateTime @default(now())
}

// SurveyBallot: tokenHashed → blindSignature (аналог Ballot)
model SurveyBallot {
  id             String  @id @default(uuid())
  questionId     String
  optionId       String?
  isAbstention   Boolean @default(false)
  ballotHash     String  @unique
  blindSignature String  @unique          // ← замість tokenHashed
  ...
}
```

**Enum — додати в `AuditAction`:**

```prisma
enum AuditAction {
  ...
  BLIND_SIGNATURE_ISSUED   // ← новий
  ...
}
```

Після змін: `npx prisma migrate dev` (продакшн: `npx prisma migrate deploy`).

---

## 3. Repository — писати `blindSignature`, а не `tokenHashed`

Файл: `backend/src/votings/votings.repository.ts`

```ts
// ❌ БУЛО — схема більше не має поля tokenHashed
async createBallotsTx(tx, votingId, ballots: {...; tokenHashed: string}[]) {
  ...
  data: { votingId, optionId, isAbstention, ballotHash, tokenHashed },
}

// ✅ СТАЄ
async createBallotsTx(
  tx: PrismaTx,
  votingId: string,
  ballots: {
    optionId: string | null;
    isAbstention: boolean;
    ballotHash: string;
    blindSignature: string;
  }[],
) {
  return Promise.all(
    ballots.map(({ optionId, isAbstention, ballotHash, blindSignature }) =>
      tx.ballot.create({
        data: { votingId, optionId, isAbstention, ballotHash, blindSignature },
        select: { ...SELECT_BALLOT, blindSignature: true },
      }),
    ),
  );
}
```

Файл: `backend/src/surveys/surveys.repository.ts` — те саме для `surveyBallot`:

```ts
async createBallotsTx(
  tx: PrismaTx,
  surveyId: string,
  ballots: { questionId: string; optionId: string; ballotHash: string; blindSignature: string }[],
) {
  return Promise.all(
    ballots.map((b) =>
      tx.surveyBallot.create({
        data: { questionId: b.questionId, optionId: b.optionId, ballotHash: b.ballotHash, blindSignature: b.blindSignature },
        select: SELECT_SURVEY_BALLOT,
      }),
    ),
  );
}
```

---

## 4. Redis — прибрати токени

Файл: `backend/src/redis/redis.service.ts`

**Видалити/не використовувати:**
- `tokenKey()` / `reverseKey()`
- `issueToken()` / `verifyToken()` / `consumeToken()`
- `lookupTokenByHash()` / `tokenExists()` / `getStoredHash()`
- `setSelections()` / `getSelections()` / `deleteSelections()`
- `setSurveySelections()` / `getSurveySelections()` / `deleteSurveySelections()`
- `performVote()` → **прибрати** `sadd voting:${votingId}:voters` (витік участі):

```ts
async performVote(votingId, optionIds, userId, isAbstention = false, isPractice = false) {
  if (isPractice) return;
  const pipeline = this.redis.pipeline();
  pipeline.incr(`voting:${votingId}:total_votes`);   // ✅ лічильник без ідентичності
  pipeline.incr('global:vote_count');
  pipeline.hincrby('global:trends', new Date().toISOString().substring(0, 16), 1);
  await pipeline.exec();
}
```

- `hasUserVoted()` — більше не потрібен (канонічна перевірка — у Postgres `VoteParticipation`)
- `hasUserSubmittedSurvey()` / `markSurveySubmitted()` — аналогічно; `getSurveyVoterCount()` → лічильник `survey:${surveyId}:responses`

---

## 5. Services — протокол сліпого підпису

### 5.1 Новий метод: `signBlindedToken` (voting)

Файл: `backend/src/votings/vote.service.ts`

```ts
async signBlindedToken(
  votingId: string,
  user: { id: string; email: string },
  dto: { tokenHash: string; blinded: string; optionIds: string[]; otherText?: string; isAbstention?: boolean; isPractice?: boolean },
) {
  const voting = await this.repo.findVotingById(votingId);
  if (!voting) throw new NotFoundException('Voting not found');

  if (!dto.isPractice) {
    // вже отримав підпис / голосував
    const used = await this.repo.findParticipation(user.id, votingId);
    if (used) throw new ConflictException('Already participated in this voting');
  }

  const key = await this.signingKeys.ensureVotingKey(votingId); // getOrCreate
  const blindSig = CryptoUtils.signBlinded(dto.blinded, key.privateKey);

  // відкладений бюлетень у Postgres (ідентичність тут, голос — пізніше, анонімно)
  await this.repo.createPendingBallot({
    tokenHash: dto.tokenHash,
    userId: user.id,
    votingId,
    selections: { optionIds: dto.optionIds, otherText: dto.otherText, isAbstention: dto.isAbstention, isPractice: dto.isPractice },
    blindSig,
    expiresAt: new Date(Date.now() + 3600 * 1000),
  });

  // фіксуємо видачу підпису
  if (!dto.isPractice) {
    await this.repo.createParticipationTx(this.repo as any, user.id, votingId); // signatureUsed=true
  }

  // audit: BLIND_SIGNATURE_ISSUED
  await this.auditService.appendChain({
    action: ChainAction.BLIND_SIGNATURE_ISSUED,
    payload: { votingId, tokenHash: dto.tokenHash, expiresAt: ... },
    userId: user.id, votingId, groupId: voting.groupId,
  });

  return { blindSig, modulus: key.modulusHex, exponent: key.exponentHex }; // клієнт знімає сліпоту
}
```

### 5.2 Змінити `vote()` — верифікація підпису замість токена

```ts
async vote(
  votingId: string,
  optionIds: string[],
  user: { id: string; email: string; language: string; theme: string },
  tokenHash: string,          // ← замість token
  signature: string,          // ← NEW: T^d (mod n)
  otherText?: string,
  isAbstention?: boolean,
  isPractice?: boolean,
) {
  ...
  // Токен-верифікацію (verifyToken) ВИДАЛИТИ.
  // Замість неї:
  const pending = await this.repo.findPendingBallot(tokenHash);
  if (!pending) throw new ForbiddenException('Invalid or expired ballot token');

  const key = await this.signingKeys.getVotingKey(votingId);
  const T = tokenHash; // НІ: T — сам токен, а tokenHash = HMAC(T)
  // Клієнт має надіслати T (або сервер відновлює T з pending? Ні — сервер не знає T).
  // Тому DTO несе token (T), а tokenHash сервер обчислює сам:
  //   const tokenHash = CryptoUtils.hashToken(T);
  //   if (tokenHash !== pending.tokenHash) throw ...
  //   const valid = CryptoUtils.verifyBlindSignature(T, signature, key.publicKey);
  //   if (!valid) throw new ForbiddenException('Invalid blind signature');
  ...
  // ball
  const ballotsHashed = optionIds.map((optId) => {
    const receipt = CryptoUtils.generateBallotReceipt(votingId, optId, signature);
    receipts.push(receipt);
    return { optionId: optId, isAbstention: false, ballotHash: receipt, blindSignature: signature };
  });
  ...
  await this.repo.createBallotsTx(tx, votingId, ballotsHashed); // ✅ blindSignature
  ...
  await this.repo.deletePendingBallot(tokenHash);
  // consumeToken() / performVote() — прибрати токен-логіку
}
```

> **Верифікація:** сервер отримує `(T, signature)`. Обчислює `tokenHash = HMAC-SHA256(T)`, звіряє з `PendingBallot.tokenHash`, потім `verifyBlindSignature(T, signature, publicKey)`.

### 5.3 Survey — те саме

Файл: `backend/src/surveys/submit.service.ts`
- новий `signBlindedToken(surveyId, user, { tokenHash, blinded, ballots })`
- `submitResponse()` → замість `verifyToken`/`consumeToken`: перевірка `PendingBallot` + `verifyBlindSignature`, запис `blindSignature`

---

## 6. Controllers / DTO — нові ендпоінти

Файл: `backend/src/votings/votings.controller.ts`

```ts
// НОВИЙ: видача сліпого підпису (автентифіковано)
@Post(':id/sign')
signToken(@Param('id') votingId: string, @Body() dto: SignTokenDto, @CurrentUser() user: UserPayloadDto) {
  return this.voteService.signBlindedToken(votingId, { id: user.sub, email: user.email }, dto);
}

// ЗМІНИТИ: POST /votings/:id/vote — dto.token → { token, signature }
```

Новий DTO: `backend/src/votings/dto/sign-token.dto.ts`

```ts
import { IsString, IsUUID, IsArray, IsOptional, MaxLength, ArrayMaxSize, IsBoolean } from 'class-validator';

export class SignTokenDto {
  @IsString()
  tokenHash: string;          // HMAC-SHA256(T)

  @IsString()
  blinded: string;            // T · r^e (mod n)

  @IsArray() @ArrayMaxSize(50) @IsUUID('4', { each: true })
  optionIds: string[];

  @IsOptional() @IsString() @MaxLength(500)
  otherText?: string;

  @IsOptional() @IsBoolean()
  isAbstention?: boolean;

  @IsOptional() @IsBoolean()
  isPractice?: boolean;
}
```

Змінити `CastVoteDto` (`backend/src/votings/dto/cast.vote.dto.ts`):

```ts
export class CastVoteDto {
  @IsNotEmpty() @IsString()
  token: string;              // T (сирий секретний токен — один раз)

  @IsNotEmpty() @IsString()
  signature: string;          // sig = T^d (mod n)

  @IsArray() @IsUUID('4', { each: true })
  optionIds: string[];
  // ... otherText, isAbstention, isPractice — без змін
}
```

Surveys: `backend/src/surveys/surveys.controller.ts` — аналогічні `POST /surveys/:id/sign` і зміна `POST /surveys/:id/submit`.

`GET /votings/:id/signing-key` — публічний ключ `(n, e)` для клієнта (blind на клієнті):

```ts
@Get(':id/signing-key')
async signingKey(@Param('id') id: string) {
  const key = await this.signingKeys.ensureVotingKey(id);
  return { modulus: key.modulusHex, exponent: key.exponentHex, keySize: key.keySize };
}
```

---

## 7. Mail — без сирого токена

Файл: `backend/src/mail/mail.service.ts` + `backend/src/mail/mail.processor.ts`

- `sendVotingToken()` / `sendSurveyToken()` — **видалити `token` з листа**; лист стає нотифікацією «поверніться на сторінку голосування, щоб підтвердити голос» із CTA на фронтенд.
- Зберегти `sendVoteReceipt()` (квитанції після голосування).

---

## 8. Audit

Файл: `backend/src/common/enums/audit.actions.ts` + `backend/src/audit/types/audit.types.ts` + `schema.prisma` enum

```ts
export enum ChainAction {
  ...
  BLIND_SIGNATURE_ISSUED = 'BLIND_SIGNATURE_ISSUED',
  ...
}
```

- `BALLOT_CAST` / `SURVEY_BALLOT_CAST`: payload містить `blindSignature` (або її HMAC) замість `tokenHashed`; `userId` залишається `null` (інваріант анонімності).

---

## 9. Frontend

Новий файл: `frontend/lib/security/blindSign.ts`

```ts
// BigInt-реалізація modPow / modInverse (аналог серверної)
// clientBlind(tokenHex, r, modulusHex, exponentHex) → blinded
// clientUnblind(blindSigHex, r, modulusHex) → signature
// genToken() → { T, r } (випадкові 256 біт), зберігає (T, r) у sessionStorage
```

`frontend/hooks/api/useVotings.ts`:
- `requestToken()` → тепер викликає `POST /votings/:id/sign` з `{ tokenHash, blinded, optionIds, ... }`; зберігає `(T, r)` у sessionStorage; отримує `blindSig` і одразу знімає сліпоту;
- `castVote()` → надсилає `{ token: T, signature: sig, optionIds, ... }`.

`frontend/hooks/api/useSurveys.ts` — аналогічно.

> `(T, r)` — у `sessionStorage`: зникають при закритті вкладки. Якщо сторінку оновили між sign і vote — потрібно знову запросити підпис.

---

## 10. Environment / ключі

`backend/.env` + `docker-compose*.yml`:

```
# обов'язково — інакше CryptoUtils кидає помилку
ENCRYPTION_KEYS=<32-byte hex>[,<старий key hex>]   # ключові ротації через кому
BLIND_INDEX_KEY=<random>
BALLOT_SECRET=<random>
TOKEN_HASH_SECRET=<random 32 bytes hex>
VOTING_RSA_KEY_SIZE=2048
```

`SigningKeysService` (новий, у `backend/src/votings/` або `backend/src/common/`):
- `ensureVotingKey(votingId)` / `ensureSurveyKey(surveyId)` — get-or-create `VotingSigningKey`, генерує RSA пару;
- приватний ключ НЕ в Postgres — у env (`VOTING_PRIVATE_KEY_<id>`) або vault; публічний — у БД;
- `getVotingKey(id)` → `{ publicKey, modulusHex, exponentHex }`.

---

## 11. Порядок виконання

1. **CryptoUtils** — методи сліпого підпису + fix дефолтних ключів + HMAC `hashToken`
2. **schema.prisma** — `PendingBallot`, `VotingSigningKey`, `SurveyBallot.blindSignature`, enum `BLIND_SIGNATURE_ISSUED`; `prisma migrate dev`
3. **Repositories** — `createBallotsTx` (voting + survey), `createPendingBallot/findPendingBallot/deletePendingBallot`
4. **Redis** — видалити токен-методи, замінити `voters` на лічильники
5. **Services** — `signBlindedToken`, зміна `vote()`/`submitResponse()`
6. **Controllers/DTO** — `/sign`, зміна `CastVoteDto`, `/signing-key`
7. **Mail** — прибрати сирий токен
8. **Audit** — новий action, payload без `tokenHashed`
9. **Frontend** — `blindSign.ts`, `useVotings`/`useSurveys`
10. **Тести** — оновити `vote.service.spec.ts`, `submit.service.spec.ts` (прибрати `verifyToken/consumeToken/issueToken`, додати моки `verifyBlindSignature`/`PendingBallot`)
