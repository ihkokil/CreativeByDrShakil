
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.warn('Telegram bot token or chat ID is missing. Skipping Telegram notification.');
    return;
  }

  // Support multiple chat IDs (comma-separated)
  const chatIds = TELEGRAM_CHAT_ID.split(',').map(id => id.trim()).filter(Boolean);

  const message = `
🔔 *New Payment Submission*

👤 *Student:* ${studentName}
📚 *Course:* ${courseTitle}
💰 *Amount:* ৳${amount}
📱 *Phone:* ${phoneNumber}
🆔 *TXID:* \`${transactionId}\`

Please verify this payment.
`;

  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;

  const keyboard = {
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

  for (const chatId of chatIds) {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          parse_mode: 'Markdown',
          reply_markup: keyboard,
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
  if (!TELEGRAM_BOT_TOKEN) return;

  const status = decision === 'approve' ? '✅ Approved' : '❌ Rejected';
  const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/editMessageText`;

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
