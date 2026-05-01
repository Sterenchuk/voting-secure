export const mailTranslations = {
  en: {
    verification: {
      subject: 'Verify your email',
      title: 'Email Verification',
      text: 'Please click the link below to verify your email:',
      button: 'Verify Email',
    },
    passwordReset: {
      subject: 'Reset your password',
      title: 'Password Reset',
      text: 'Please click the link below to reset your password:',
      button: 'Reset Password',
    },
    votingToken: {
      subject: 'Confirm your vote — {title}',
      title: 'Confirm Your Vote',
      text1: 'You have requested to cast a vote in <strong>{title}</strong>.',
      text2:
        'To complete your submission, please click the button below. This will securely record your vote and add it to the public audit chain.',
      button: 'Confirm My Vote',
      securityNote:
        '<strong>Security Note:</strong> This link expires in 1 hour and can only be used once. If you did not request this, you can safely ignore this email.',
      trouble:
        "If the button doesn't work, copy and paste this URL into your browser:",
    },
    surveyToken: {
      subject: 'Your survey token for: {title}',
      title: 'Survey Token',
      text: 'You have requested a token to participate in: <strong>{title}</strong>.',
      tokenLabel: 'Your token:',
      footer: 'Keep this for your records.',
    },
    voteReceipt: {
      subject: 'Your vote receipt — {title}',
      title: 'Vote Confirmed',
      text: 'You successfully voted in: <strong>{title}</strong>',
      subtitle: 'Your Ballot Receipts',
      description:
        'These are your cryptographic proofs. Each hash proves a specific ballot was cast and recorded in the public audit chain. Keep this email.',
      ballotLabel: 'Ballot {index}:',
      verifyTitle: 'Verify Your Vote',
      verifyText:
        'You can verify your vote was counted by checking your receipt against the public audit chain:',
      verifyButton: 'Verify My Vote',
      footer:
        'This receipt was generated at the moment of voting. The hashes are HMAC-SHA256 signatures tied to your specific ballot and cannot be forged.',
    },
    confirmPage: {
      successTitle: 'Vote Confirmed',
      successText:
        'Your choices have been securely recorded and added to the public audit chain.',
      receiptLabel: 'Digital Ballot Receipts',
      footerText:
        'A copy has been sent to your email.<br/>You can safely close this window now.',
      errorTitle: 'Verification Failed',
      errorFooter:
        'Please return to the voting page and try requesting a new token.',
    },
  },
  uk: {
    verification: {
      subject: 'Підтвердьте вашу електронну пошту',
      title: 'Підтвердження Пошти',
      text: 'Будь ласка, натисніть на посилання нижче, щоб підтвердити вашу пошту:',
      button: 'Підтвердити Пошту',
    },
    passwordReset: {
      subject: 'Скидання пароля',
      title: 'Скидання Пароля',
      text: 'Будь ласка, натисніть на посилання нижче, щоб скинути ваш пароль:',
      button: 'Скинути Пароль',
    },
    votingToken: {
      subject: 'Підтвердьте ваше голосування — {title}',
      title: 'Підтвердіть Свій Голос',
      text1: 'Ви надіслали запит на голосування в <strong>{title}</strong>.',
      text2:
        'Щоб завершити подачу, будь ласка, натисніть кнопку нижче. Це безпечно запише ваш голос і додасть його до публічного ланцюга аудиту.',
      button: 'Підтвердити Мій Голос',
      securityNote:
        '<strong>Примітка щодо безпеки:</strong> Це посилання дійсне протягом 1 години і може бути використане лише один раз. Якщо ви не надсилали цей запит, ви можете ігнорувати цей лист.',
      trouble:
        'Якщо кнопка не працює, скопіюйте та вставте цю URL-адресу у свій браузер:',
    },
    surveyToken: {
      subject: 'Ваш токен для опитування: {title}',
      title: 'Токен Опитування',
      text: 'Ви надіслали запит на отримання токена для участі в: <strong>{title}</strong>.',
      tokenLabel: 'Ваш токен:',
      footer: 'Збережіть це для своїх записів.',
    },
    voteReceipt: {
      subject: 'Ваша квитанція про голосування — {title}',
      title: 'Голосування Підтверджено',
      text: 'Ви успішно проголосували в: <strong>{title}</strong>',
      subtitle: 'Ваші Квитанції',
      description:
        'Це ваші криптографічні докази. Кожен хеш підтверджує, що конкретний бюлетень був поданий і записаний у публічному ланцюгу аудиту. Збережіть цей лист.',
      ballotLabel: 'Бюлетень {index}:',
      verifyTitle: 'Перевірити Свій Голос',
      verifyText:
        'Ви можете перевірити, чи був ваш голос врахований, звіривши свою квитанцію з публічним ланцюгом аудиту:',
      verifyButton: 'Перевірити Мій Голос',
      footer:
        'Ця квитанція була створена в момент голосування. Хеші — це підписи HMAC-SHA256, прив’язані до вашого конкретного бюлетеня, і їх неможливо підробити.',
    },
    confirmPage: {
      successTitle: 'Голос Підтверджено',
      successText:
        'Ваш вибір був надійно записаний і доданий до публічного ланцюга аудиту.',
      receiptLabel: 'Цифрові квитанції бюлетенів',
      footerText:
        'Копія була надіслана на вашу електронну пошту.<br/>Тепер ви можете безпечно закрити це вікно.',
      errorTitle: 'Помилка Верифікації',
      errorFooter:
        'Будь ласка, поверніться на сторінку голосування та спробуйте отримати новий токен.',
    },
  },
};

export type MailLanguage = keyof typeof mailTranslations;
