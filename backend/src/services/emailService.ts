
import nodemailer from "nodemailer";

type VerificationEmailInput = {
  email: string;
  displayName: string;
  token: string;
};

export async function sendVerificationEmail({
  email,
  displayName,
  token,
}: VerificationEmailInput): Promise<void> {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT);
  const secureValue = process.env.SMTP_SECURE;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM;
  const backendUrl = process.env.BACKEND_URL;

  if (
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    !user ||
    !pass ||
    !from ||
    !backendUrl
  ) {
    throw new Error("SMTP configuration is incomplete.");
  }

  if (secureValue !== "true" && secureValue !== "false") {
    throw new Error("SMTP_SECURE must be true or false.");
  }

  const verificationUrl = new URL(
    "/api/auth/verify-email",
    backendUrl,
  );

  verificationUrl.searchParams.set("token", token);

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: secureValue === "true",
    auth: {
      user,
      pass,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
  });

  await transporter.sendMail({
    from,
    to: email,
    subject: "Verify your LetsDate email address",
    text: [
      `Hello ${displayName},`,
      "",
      "Thanks for registering with LetsDate.",
      "Please open the following link to verify your email address:",
      "",
      verificationUrl.toString(),
      "",
      "This link expires in 30 minutes and can only be used once.",
      "If you did not create this account, you can ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 560px; margin: 0 auto; line-height: 1.6;">
        <h2>Welcome to LetsDate</h2>
        <p>Hello ${escapeHtml(displayName)},</p>
        <p>Thanks for registering. Verify your email address to continue.</p>
        <p>
          <a
            href="${escapeHtml(verificationUrl.toString())}"
            style="display: inline-block; padding: 12px 20px; background: #c02668; color: white; text-decoration: none; border-radius: 6px;"
          >
            Verify email address
          </a>
        </p>
        <p>This link expires in 30 minutes and can only be used once.</p>
        <p>If you did not create this account, you can ignore this email.</p>
      </div>
    `,
  });

  await transporter.close();
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };

    return entities[character] ?? character;
  });
}
