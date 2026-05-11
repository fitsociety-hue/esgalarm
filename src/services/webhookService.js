import axios from 'axios';

/**
 * Sends a message to a Google Chat Webhook
 * @param {string} webhookUrl - The Google Chat Webhook URL
 * @param {object} payload - The message payload
 */
export const sendGoogleChatMessage = async (webhookUrl, message, title = '새로운 알림') => {
  try {
    const payload = {
      cardsV2: [
        {
          cardId: 'alarmCard',
          card: {
            header: {
              title: title,
              subtitle: 'ESG 실천활동 자동 알람 시스템',
              imageUrl: 'https://cdn-icons-png.flaticon.com/512/3554/3554238.png',
              imageType: 'CIRCLE'
            },
            sections: [
              {
                widgets: [
                  {
                    textParagraph: {
                      text: message
                    }
                  }
                ]
              }
            ]
          }
        }
      ]
    };

    // Google Chat Webhooks require POST requests. Due to CORS issues in browsers,
    // Google Chat webhooks usually do not work directly from a browser because they don't return CORS headers.
    // However, if we just issue a no-cors request, it will be sent but we won't get a readable response.
    await fetch(webhookUrl, {
      method: 'POST',
      mode: 'no-cors',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });
    
    return { success: true };
  } catch (error) {
    console.error('Failed to send Google Chat message:', error);
    return { success: false, error: error.message };
  }
};
