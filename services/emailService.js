const { SendEmailCommand } = require("@aws-sdk/client-ses");
const sesClient = require("../config/ses");

const ROLE_LABELS = {
  admin: "Admin",
  project_manager: "Project Manager",
  site_engineer: "Site Engineer",
};

/**
 * Sends a welcome email containing login credentials to a newly invited
 * team member. Throws on failure — the caller (authController.inviteUser)
 * decides how to handle that, since a failed email shouldn't undo an
 * already-created account.
 */
async function sendWelcomeEmail({ to, fullName, companyName, role, tempPassword, projectName }) {
  const loginUrl = process.env.FRONTEND_LOGIN_URL || "http://localhost:3000/login";
  const roleLabel = ROLE_LABELS[role] || role;

  const subject = `You've been added to ${companyName} on BuildTrack`;

  const textBody = `Hi ${fullName},

You've been added to ${companyName}'s BuildTrack workspace as a ${roleLabel}${
    projectName ? ` on the "${projectName}" project` : ""
  }.

Your login details:
Email: ${to}
Temporary password: ${tempPassword}

Log in here: ${loginUrl}

For security, please log in and change your password as soon as possible.

— BuildTrack`;

  const htmlBody = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; margin: 0 auto; color: #1f2937;">
      <h2 style="color: #12122b;">Welcome to ${companyName}</h2>
      <p>Hi ${fullName},</p>
      <p>You've been added to <strong>${companyName}</strong>'s BuildTrack workspace as a
      <strong>${roleLabel}</strong>${
        projectName ? ` on the <strong>${projectName}</strong> project` : ""
      }.</p>
      <table style="background: #f9fafb; border-radius: 8px; padding: 16px; margin: 20px 0; width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Email</td>
          <td style="padding: 6px 0; font-weight: 600;">${to}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #6b7280; font-size: 13px;">Temporary password</td>
          <td style="padding: 6px 0; font-weight: 600; font-family: monospace;">${tempPassword}</td>
        </tr>
      </table>
      <p>
        <a href="${loginUrl}" style="display: inline-block; background: #12122b; color: #fff; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 600;">
          Log in to BuildTrack
        </a>
      </p>
      <p style="font-size: 13px; color: #6b7280;">
        For security, please log in and change your password as soon as possible.
      </p>
    </div>
  `;

  const command = new SendEmailCommand({
    Source: process.env.SES_FROM_EMAIL,
    Destination: { ToAddresses: [to] },
    Message: {
      Subject: { Data: subject, Charset: "UTF-8" },
      Body: {
        Text: { Data: textBody, Charset: "UTF-8" },
        Html: { Data: htmlBody, Charset: "UTF-8" },
      },
    },
  });

  await sesClient.send(command);
}

module.exports = { sendWelcomeEmail };