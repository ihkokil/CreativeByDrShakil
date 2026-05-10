import { signVerificationToken } from './token-utils';
import { getAppUrl } from './email';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN?.replace(/"/g, '');
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID?.replace(/"/g, '');

function escapeTelegramHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function getTelegramChatIds() {
  if (!TELEGRAM_CHAT_ID) return [];
  return TELEGRAM_CHAT_ID.split(',').map(id => id.trim()).filter(Boolean);
}

function getTelegramApiUrl(method: string) {
  if (!TELEGRAM_BOT_TOKEN) return null;
  return `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
}

function buildApproveRejectKeyboard(orderId: string) {
  const appUrl = getAppUrl();
  const approveToken = signVerificationToken({ orderId, action: 'approve' });
  const rejectToken = signVerificationToken({ orderId, action: 'reject' });

  return {
    inline_keyboard: [
      [
        {
          text: '✅ Approve',
          url: `${appUrl}/api/payments/verify?token=${approveToken}`,
        },
        {
          text: '❌ Reject',
          url: `${appUrl}/api/payments/verify?token=${rejectToken}`,
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
    '<b>🛒 New Course Purchase</b>',
    '',
    `👤 <b>Student:</b> ${escapeTelegramHtml(studentName)}`,
    `📧 <b>Email:</b> ${escapeTelegramHtml(studentEmail)}`,
    `📚 <b>Course:</b> ${escapeTelegramHtml(courseTitle)}`,
    `💰 <b>Amount:</b> ৳${escapeTelegramHtml(String(amount))}`,
    `🆔 <b>Order:</b> <code>${escapeTelegramHtml(orderId)}</code>`,
  ];

  if (phoneNumber) lines.push(`📱 <b>Phone:</b> ${escapeTelegramHtml(phoneNumber)}`);
  if (purchasedAt) lines.push(`🕒 <b>Purchased:</b> ${escapeTelegramHtml(purchasedAt)}`);
  if (adminOrderUrl) lines.push(`🔎 <b>Admin:</b> ${escapeTelegramHtml(adminOrderUrl)}`);

  lines.push('', '<i>Use the buttons below to approve or reject this purchase.</i>');

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
          parse_mode: 'HTML',
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
  additionalChatIds = [],
}: {
  orderId: string;
  studentName: string;
  courseTitle: string;
  amount: number;
  transactionId: string;
  phoneNumber: string;
  additionalChatIds?: string[];
}) {
  const envChatIds = getTelegramChatIds();
  const allChatIds = Array.from(new Set([...envChatIds, ...additionalChatIds]));

  if (!allChatIds.length) {
    console.warn('No Telegram chat IDs found. Skipping notification.');
    return;
  }

  const message = `
🔔 <b>New Payment Submission</b>

👤 <b>Student:</b> ${escapeTelegramHtml(studentName)}
📚 <b>Course:</b> ${escapeTelegramHtml(courseTitle)}
💰 <b>Amount:</b> ৳${escapeTelegramHtml(String(amount))}
📱 <b>Phone:</b> ${escapeTelegramHtml(phoneNumber)}
🆔 <b>TXID:</b> <code>${escapeTelegramHtml(transactionId)}</code>

Please verify this payment.
`;

  await sendTelegramMessage({ chatIds: allChatIds, text: message, replyMarkup: buildApproveRejectKeyboard(orderId) });
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
  additionalChatIds = [],
}: {
  orderId: string;
  studentName: string;
  studentEmail: string;
  courseTitle: string;
  amount: number | string;
  phoneNumber?: string;
  purchasedAt?: string;
  adminOrderUrl?: string;
  additionalChatIds?: string[];
}) {
  const envChatIds = getTelegramChatIds();
  const allChatIds = Array.from(new Set([...envChatIds, ...additionalChatIds]));

  if (!allChatIds.length) {
    console.warn('No Telegram chat IDs found. Skipping notification.');
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

  await sendTelegramMessage({ chatIds: allChatIds, text: message, replyMarkup: buildApproveRejectKeyboard(orderId) });
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
        text: `Decision: ${escapeTelegramHtml(status)} by ${escapeTelegramHtml(adminName)}`,
        parse_mode: 'HTML',
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
