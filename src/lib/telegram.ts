
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

function getTelegramChatIds() {
  if (!TELEGRAM_CHAT_ID) return [];
  return TELEGRAM_CHAT_ID.split(',').map(id => id.trim()).filter(Boolean);
}

function getTelegramApiUrl(method: string) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  return `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
}

function buildApproveRejectKeyboard(orderId: string) {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Approve',
          callback_data: `payment_verify:${orderId}:approve`,
        },
        {
          text: '❌ Reject',
          callback_data: `payment_verify:${orderId}:reject`,
        },
      ],
    ],
  };
}

function buildPurchaseMessage({
  studentName,
  studentEmail,
  courseTitle,
  amount,
  orderId,
  phoneNumber,
  purchasedAt,
  adminOrderUrl,
}: {
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  amount: number | string;
  orderId: string;
  phoneNumber?: string;
  purchasedAt?: string;
  adminOrderUrl?: string;
}) {
  const lines = [
    '🛒 *New Course Purchase*',
    '',
    `👤 *Student:* ${studentName}`,
    `📧 *Email:* ${studentEmail}`,
    `📚 *Course:* ${courseTitle}`,
    `💰 *Amount:* ৳${amount}`,
    `🆔 *Order:* \`${orderId}\``,
  ];

  if (phoneNumber) lines.push(`📱 *Phone:* ${phoneNumber}`);
  if (purchasedAt) lines.push(`🕒 *Purchased:* ${purchasedAt}`);
  if (adminOrderUrl) lines.push(`🔎 *Admin:* ${adminOrderUrl}`);

  lines.push('', '_Use the buttons below to approve or reject this purchase._');

  return lines.join('\n');
}

async function sendTelegramMessage({
  chatIds,
  text,
  replyMarkup,
}: {
  chatIds: string[];
  text: string;
  replyMarkup?: Record<string, unknown>;
}) {
  const url = getTelegramApiUrl('sendMessage');
  if (!url) {
    console.warn('Telegram bot token is missing. Skipping Telegram notification.');
    return;
  }

  for (const chatId of chatIds) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          parse_mode: 'Markdown',
          reply_markup: replyMarkup,
          disable_web_page_preview: true,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error(`Error sending Telegram notification to ${chatId}:`, errorData);
      }
    } catch (error: any) {
      console.error(`Error sending Telegram notification to ${chatId}:`, error.message);
    }
  }
}

/**
 * Sends a notification to one or more Telegram chats with inline buttons for approval or rejection.
 */
export async function sendTelegramVerification({
  orderId,
  studentName,
  courseTitle,
  amount,
  transactionId,
  phoneNumber,
}: {
  orderId: string;
  studentName: string;
  courseTitle: string;
  amount: number;
  transactionId: string;
  phoneNumber: string;
}) {
  const chatIds = getTelegramChatIds();
  if (!chatIds.length) {
    console.warn('Telegram bot token or chat ID is missing. Skipping Telegram notification.');
    return;
  }

  const message = `
🔔 *New Payment Submission*

👤 *Student:* ${studentName}
📚 *Course:* ${courseTitle}
💰 *Amount:* ৳${amount}
📱 *Phone:* ${phoneNumber}
🆔 *TXID:* \`${transactionId}\`

Please verify this payment.
`;

  await sendTelegramMessage({ chatIds, text: message, replyMarkup: buildApproveRejectKeyboard(orderId) });
}

/**
 * Sends a polished purchase notification to Telegram with approve/reject buttons.
 */
export async function sendTelegramPurchaseNotification({
  orderId,
  studentName,
  studentEmail,
  courseTitle,
  amount,
  phoneNumber,
  purchasedAt,
  adminOrderUrl,
}: {
  orderId: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  amount: number | string;
  phoneNumber?: string;
  purchasedAt?: string;
  adminOrderUrl?: string;
}) {
  const chatIds = getTelegramChatIds();
  if (!chatIds.length) {
    console.warn('Telegram bot token or chat ID is missing. Skipping Telegram notification.');
    return;
  }

  const message = buildPurchaseMessage({
    studentName,
    studentEmail,
    courseTitle,
    amount,
    orderId,
    phoneNumber,
    purchasedAt,
    adminOrderUrl,
  });

  await sendTelegramMessage({ chatIds, text: message, replyMarkup: buildApproveRejectKeyboard(orderId) });
}

/**
 * Updates an existing Telegram message to reflect the decision.
 */
export async function updateTelegramVerificationMessage({
  chatId,
  messageId,
  decision,
  adminName,
}: {
  chatId: string | number;
  messageId: string | number;
  decision: 'approve' | 'reject';
  adminName: string;
}) {
  const url = getTelegramApiUrl('editMessageText');
  if (!url) return;

  const status = decision === 'approve' ? '✅ Approved' : '❌ Rejected';

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text: `Decision: ${status} by ${adminName}`,
      }),
    });
    if (!response.ok) {
      const errorData = await response.json();
      console.error('Error updating Telegram notification:', errorData);
    }
  } catch (error: any) {
    console.error('Error updating Telegram notification:', error.message);
  }
}
