# Сліпі підписи: архітектура та протокол

## 1. Чому сліпі підписи, а не гомоморфне шифрування

З існуючої архітектури — сліпі підписи значно легше.

**Чому не гомоморфне шифрування:**

- Потребує повної зміни схеми зберігання голосів
- Дуже складна математика (Paillier, BFV)
- Перепис підрахунку голосів з нуля
- Несумісне з поточною таблицею `Ballot` і `VotingResult`

**Чому сліпі підписи — простіше:**

- Існуюча архітектура вже має всі необхідні компоненти:
  - `CryptoUtils` — вже є, додати кілька методів
  - двоетапний протокол `requestToken → confirmVote` — вже є
  - поле `Ballot.blindSignature` — вже додане в схему
- Розділення на систему автентифікації (зі сліпими підписами) і систему голосування (власне бюлетені) відповідає рекомендаціям CM/Rec(2017)5 §19 і §26.

---

## 2. Архітектура розділення

Класично системи автентифікації і власне голосування розділяються:

1. **Підсистема автентифікації** (сліпі підписи) — доводить право голосувати, не розкриваючи зміст бюлетеня:
   - виборець (клієнт) генерує секретне повідомлення `T`
   - осліплює його: `blinded = T · r^e (mod n)`
   - сервер підписує `blinded`, **не знаючи `T`**
   - виборець знімає сліпоту: `sig = T^d (mod n)`

2. **Підсистема голосування** — приймає анонімний бюлетень:
   - виборець надсилає `{ tokenHash, sig, optionIds }`
   - сервер верифікує підпис публічним ключем (`sig^e ≡ T (mod n)`)
   - зберігає `Ballot.blindSignature = sig` — без `userId`

Сервер математично **не може** зв'язати запит на підпис (де була ідентичність) з бюлетенем (де підпис), тому що осліплене повідомлення статистично незалежне від підписаного.

---

## 3. Протокол сліпого підпису (Chaum / RSA)

Параметри: відкритий ключ сервера `(n, e)`, закритий ключ `d`, модуль `n` (RSA-2048+).

### Крок 1 — `requestToken` (клієнт)

Виборець на сторінці голосування:

1. генерує секретне повідомлення `T` — випадкове 256-бітне число (`64` hex-символи);
2. генерує осліплюючий фактор `r` — випадкове, взаємно просте з `n`;
3. обчислює осліплене повідомлення:

```
blinded =

```

4. обчислює токен-хеш (односторонній, з секретом):

```
tokenHash = HMAC-SHA256(T)
```

5. надсилає на сервер (автентифікований запит, JWT):

```
POST /votings/:id/sign
{
  tokenHash,          // H(T)
  blinded,            // T · r^e (mod n) — сервер не може відновити T
  optionIds, otherText, isAbstention
}
```

> `tokenHash` — це не сам токен. Це HMAC від `T`; сервер використовує його лише як унікальний ідентифікатор бюлетеня.

### Крок 2 — `sign` (сервер)

Сервер:

1. перевіряє право голосу (`VoteParticipation`, членство, часові межі);
2. зберігає «відкладений» бюлетень у Postgres (`PendingBallot`), ключ — `tokenHash`;
3. підписує осліплене повідомлення:

```
blindSig = blinded^d (mod n)
```

4. позначає `VoteParticipation.signatureUsed = true` (один підпис на виборця);
5. повертає `blindSig` клієнту.

Сервер **ніколи не бачить `T`** — лише `blinded` і `tokenHash = HMAC(T)`.

### Крок 3 — `unblind` (клієнт)

Клієнт знімає сліпоту:

```
sig = blindSig · r⁻¹ (mod n) = T^d (mod n)
```

Тепер клієнт тримає справжній підпис сервера на `T`.

### Крок 4 — `vote` (анонімний бюлетень)

Виборець надсилає:

```
POST /votings/:id/vote
{
  tokenHash,            // H(T)
  signature,            // sig = T^d (mod n)
  optionIds, otherText, isAbstention
}
```

Сервер:

1. верифікує підпис публічним ключем `(n, e)`:

```
sig^e (mod n) === T (mod n)
```

2. перевіряє унікальність `tokenHash` / `signature` (антиповторне голосування);
3. зберігає `Ballot` з полем `blindSignature = signature` — **без userId**.

Бюлетень анонімний: таблиця `Ballot` не містить зв'язку з виборцем.

---

## 4. Sequence-діаграма (voting)

```
 Виборець (браузер)                 Сервер (NestJS)                 Postgres
        │  генерує T, r                  │                              │
        │  blinded = T·r^e mod n         │                              │
        │  tokenHash = HMAC(T)           │                              │
        │─────────────────────────────────│                              │
        │  POST /votings/:id/sign        │                              │
        │  {tokenHash, blinded, options} │                              │
        │────────────────────────────────▶│                              │
        │                                 │  перевірка права голосу       │
        │                                 │──────────────────────────────▶│
        │                                 │  PendingBallot{tokenHash,     │
        │                                 │    userId, selections}        │
        │                                 │  VoteParticipation.sigUsed=✓  │
        │                                 │──────────────────────────────▶│
        │                                 │  blindSig = blinded^d mod n   │
        │  ◀── blindSig ──────────────────│                              │
        │                                 │                              │
        │  sig = blindSig · r⁻¹ mod n     │                              │
        │  (= T^d mod n)                  │                              │
        │                                 │                              │
        │─────────────────────────────────│                              │
        │  POST /votings/:id/vote         │                              │
        │  {tokenHash, signature, options}│                              │
        │────────────────────────────────▶│                              │
        │                                 │  verify: sig^e ≡ T mod n      │
        │                                 │  Ballot{blindSignature=sig}   │
        │                                 │  (без userId)                │
        │                                 │──────────────────────────────▶│
        │                                 │  видалити PendingBallot       │
        │                                 │──────────────────────────────▶│
        │  ◀── receipts ──────────────────│                              │
```

> Зверніть увагу: сервер ніколи не бачить пару `(T, sig)` разом з ідентичністю. У кроці sign є `blinded` + ідентичність; у кроці vote — `sig` без ідентичності. Зв'язку немає.

### Survey — аналогічно

```
POST /surveys/:id/sign     {tokenHash, blinded, ballots}
POST /surveys/:id/submit   {tokenHash, signature, ballots}
```

Та сама математика; `SurveyBallot.blindSignature` замість `tokenHashed`.

---

## 5. Схема БД

### Що вже змінено в `schema.prisma` (робоча копія)

```prisma
model VoteParticipation {
  userId        String
  votingId      String
  signatureUsed Boolean  @default(false)  // підпис видано — до голосування
  @@unique([userId, votingId])
}

model Ballot {
  id             String  @id @default(uuid())
  votingId       String
  optionId       String?
  isAbstention   Boolean @default(false)
  ballotHash     String  @unique
  blindSignature String  @unique          // криптодоказ без userId
  ...
}
```

### Що додати

```prisma
// Відкладений бюлетень (відкладені selections) — ідентичність окремо від голосу
model PendingBallot {
  id        String   @id @default(uuid())
  tokenHash String   @unique          // HMAC-SHA256(T)
  userId    String
  votingId  String?
  surveyId  String?
  selections Json
  blindSig  String
  expiresAt DateTime
  createdAt DateTime @default(now())
}

// Публічні ключі для верифікації підписів
model VotingSigningKey {
  id        String   @id @default(uuid())
  votingId  String?  @unique
  surveyId  String?  @unique
  publicKey String   // RSA public key (PEM)
  createdAt DateTime @default(now())
}

// SurveyBallot — аналогічно до Ballot:
//   tokenHashed → blindSignature String @unique
```

### Що залишається без змін

- `User`, `Group / UserGroup`, `Option`, `VotingResult`, `Survey`, `SurveyResult`
- Поля `Ballot.ballotHash` (хеш самого бюлетеня для ланцюжка аудиту)

---

## 6. Модель загроз і чесний компроміс

**Що захищає схема:**

- сервер не може зв'язати запит на підпис (ідентифікацію) з бюлетенем (голосом) — математично, через властивість сліпого підпису;
- зламана Redis не розкриває жодних токенів — токенів більше немає, лише лічильники;
- `Ballot` / `SurveyBallot` не містять `userId` — навіть повний дамп таблиць не деанонімізує голос;
- `tokenHash` — односторонній HMAC із секретом; навіть знаючи базу, неможливо відновити `T` (brute-force по 256-бітному простору безглуздий).

**Що схема НЕ захищає (чесно):**

- `VoteParticipation` (і `PendingBallot`) зберігають факт «користувач отримав підпис для voting N» — сервер знає, хто голосував, але не _як_;
- на етапі sign сервер бачить час запиту і мережеві дані (можлива часткова кореляція за таймінгом — тому `Ballot` без `createdAt`);
- якщо приватний ключ RSA витіче — підписи можна підробляти (зберігання ключа — критичне).

**Відповідь комісії (формулювання для роботи):**

> «Сліпі підписи є логічним наступним кроком розвитку системи. В рамках бакалаврської роботи реалізована архітектурна анонімність через розділення таблиць — це свідоме компромісне рішення між складністю реалізації та рівнем захисту. Схема БД підтримує це вдосконалення з мінімальними змінами: поле `tokenHashed` замінено на `blindSignature`, додано таблиці `PendingBallot` і `VotingSigningKey`. Розділення на систему автентифікації зі сліпими підписами і систему голосування відповідає Standard 19 і Standard 26 CM/Rec(2017)5.»

---

## 7. Відповідність стандартам

| Стандарт          | Вимога                                                     | Реалізація                                              |
| ----------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| Rec(2004)11 §26   | «хто голосував» зберігається окремо від «що проголосовано» | `VoteParticipation` ⇄ `Ballot` — без `userId`           |
| CM/Rec(2017)5 §19 | анонімність голосування                                    | сліпі підписи: `blinded` підписується без знання змісту |
| CM/Rec(2017)5 §26 | публічний криптодоказ                                      | `Ballot.blindSignature` + ланцюжок аудиту               |
| EML-сумісність    | підсумки у відкритому форматі                              | `VotingResult` не змінюється, підрахунок без змін       |

## 8. Резюме

```
          USER (клієнт)                         SERVER
              │  T, r — секретні                    │
              │  blinded = T·r^e (mod n)            │
              │───────────────────────────────▶     │ sign: blindSig = blinded^d
              │  {tokenHash, blinded, options}      │  PendingBallot + sigUsed
              │  ◀──────────── blindSig ────────────│
              │  sig = blindSig · r⁻¹ (mod n)       │
              │───────────────────────────────▶     │ verify: sig^e ≡ T (mod n)
              │  {tokenHash, signature, options}    │  Ballot{blindSignature}
              │                                     │  (без userId)
              │         АНОНІМНИЙ БЮЛЕТЕНЬ          │
```
