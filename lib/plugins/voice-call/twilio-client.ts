import twilio from 'twilio';

interface TwilioConfig {
  accountSid?: string;
  authToken?: string;
  apiKeySid?: string;
  apiKeySecret?: string;
  twimlAppSid?: string;
}

export function createTwilioClient(config?: TwilioConfig) {
  const accountSid = config?.accountSid || process.env.TWILIO_ACCOUNT_SID;
  const authToken = config?.authToken || process.env.TWILIO_AUTH_TOKEN;
  
  if (!accountSid || !authToken) {
    return null;
  }

  try {
    return twilio(accountSid, authToken);
  } catch (err: any) {
    console.warn('[Twilio] Failed to create Twilio client:', err.message);
    return null;
  }
}
