import { SESv2Client, SendEmailCommand } from "@aws-sdk/client-sesv2";

const client = new SESv2Client({});

export class EmailSendError extends Error {}

function fromAddress(): string {
  const value = process.env.SES_FROM_ADDRESS;
  if (!value) throw new Error("SES_FROM_ADDRESS is not set");
  return value;
}

export async function sendOtpEmail(toEmail: string, code: string, expiryMinutes: number): Promise<void> {
  try {
    await client.send(
      new SendEmailCommand({
        FromEmailAddress: fromAddress(),
        Destination: { ToAddresses: [toEmail] },
        Content: {
          Simple: {
            Subject: { Data: "Your verification code" },
            Body: {
              Text: {
                Data: `Your verification code is ${code}. It expires in ${expiryMinutes} minutes.`,
              },
            },
          },
        },
      })
    );
  } catch (err) {
    console.error("SES send failed", err);
    throw new EmailSendError("Couldn't send the verification email — try again shortly, or contact an admin.");
  }
}
