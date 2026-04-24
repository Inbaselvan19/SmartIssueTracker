const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: process.env.SMTP_PORT == 465,
    auth: {
        user: process.env.SMTP_USER || 'your-email@gmail.com',
        pass: process.env.SMTP_PASS || 'your-app-password'
    }
});

// ── HTML Email Builder ────────────────────────────────────────
function buildEmailHTML(preheader, body) {
    return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>SmartConnect Municipal Portal</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,#1d4ed8 0%,#4f46e5 100%);padding:32px 40px;">
          <table width="100%"><tr>
            <td><h1 style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">🏛️ SmartConnect Municipal Portal</h1>
            <p style="margin:6px 0 0;color:#bfdbfe;font-size:13px;">${preheader}</p></td>
          </tr></table>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:36px 40px;color:#334155;font-size:15px;line-height:1.7;">${body}</td></tr>
        <!-- Footer -->
        <tr><td style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:20px 40px;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">This is an automated notification from SmartConnect Municipal Portal.</p>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:12px;">Please do not reply to this email. For assistance, contact your nearest municipal office.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function ticketBox(fields) {
    const rows = fields.map(([label, value]) =>
        `<tr><td style="padding:6px 0;color:#64748b;font-size:13px;width:140px;">${label}</td>
         <td style="padding:6px 0;color:#1e293b;font-size:13px;font-weight:600;">${value}</td></tr>`
    ).join('');
    return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-left:4px solid #3b82f6;border-radius:8px;padding:16px 20px;margin:20px 0;">
        <tbody>${rows}</tbody>
    </table>`;
}

const deptNames = { water:'Water Supply', roads:'Roads & Infrastructure', electricity:'Electricity', waste:'Waste Management', parks:'Parks & Recreation', health:'Public Health', drainage:'Drainage & Sewage', transport:'Transport', fire:'Fire Services', building:'Building & Construction' };
const priorityEmoji = { low:'🟢 Low', medium:'🟡 Medium', high:'🟠 High', urgent:'🔴 Urgent' };
const statusEmoji = { pending:'⏳ Pending', progress:'🔧 In Progress', completed:'✅ Completed', closed:'🔒 Closed' };

// ── Email: Ticket Submitted ───────────────────────────────────
async function sendTicketSubmittedEmail(email, citizen, ticket) {
    const dateStr = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' });
    const body = `
        <p>Dear <strong>${citizen.name}</strong>,</p>
        <p>Your civic issue report has been <strong>successfully registered</strong> with the SmartConnect Municipal Portal. Our municipal team will review and address your concern at the earliest.</p>
        ${ticketBox([
            ['🎫 Ticket ID', ticket.id],
            ['📂 Department', deptNames[ticket.department] || ticket.department],
            ['⚡ Priority', priorityEmoji[ticket.priority] || ticket.priority],
            ['📍 Location', ticket.location],
            ['📝 Issue Summary', ticket.description],
            ['📅 Reported On', dateStr],
            ['📊 Current Status', '⏳ Pending Review']
        ])}
        <p>You will receive a notification when a municipal official is assigned to your issue and when any status update is made.</p>
        <p>Please keep your Ticket ID <strong>(${ticket.id})</strong> for future reference.</p>
        <br><p style="color:#475569;">Regards,<br><strong>SmartConnect Operations Team</strong><br><span style="color:#94a3b8;font-size:13px;">Municipal Issue Resolution Division</span></p>`;
    await sendHTMLEmail(email, `✅ Issue Report Registered — Ticket #${ticket.id}`, '✅ Your issue has been registered', body);
    await sendSMS(citizen.mobile, `SmartConnect: Your issue (ID: ${ticket.id}) for ${deptNames[ticket.department] || ticket.department} has been registered. Priority: ${ticket.priority}. Track at your portal.`);
}

// ── Email: Status Updated ─────────────────────────────────────
async function sendStatusUpdateEmail(email, citizen, ticket, newStatus) {
    const statusLabel = statusEmoji[newStatus] || newStatus;
    const actionNote = newStatus === 'completed'
        ? 'Your issue has been <strong>resolved</strong> by our municipal team. Please log in to SmartConnect to confirm the resolution and provide your valuable feedback.'
        : newStatus === 'closed'
        ? 'Your ticket has been reviewed and officially closed by the Super Admin.'
        : 'A municipal official has been assigned to your issue and is actively working on it.';
    const body = `
        <p>Dear <strong>${citizen.name}</strong>,</p>
        <p>We would like to inform you that the status of your registered civic issue has been <strong>updated</strong> by our municipal team.</p>
        ${ticketBox([
            ['🎫 Ticket ID', ticket.id],
            ['📂 Department', deptNames[ticket.department] || ticket.department],
            ['📍 Location', ticket.location],
            ['📝 Issue', ticket.description],
            ['🔄 Updated Status', statusLabel],
            ['📅 Update Date', new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })]
        ])}
        <p>${actionNote}</p>
        <br><p style="color:#475569;">Regards,<br><strong>SmartConnect Operations Team</strong><br><span style="color:#94a3b8;font-size:13px;">Municipal Issue Resolution Division</span></p>`;
    await sendHTMLEmail(email, `${statusEmoji[newStatus] || '📋'} Ticket #${ticket.id} Status Updated — ${newStatus.toUpperCase()}`, `Status update for your ticket #${ticket.id}`, body);
    await sendSMS(citizen.mobile, `SmartConnect: Ticket #${ticket.id} status updated to ${newStatus.toUpperCase()}. ${newStatus === 'completed' ? 'Please confirm resolution on your portal.' : 'Track your issue at the portal.'}`);
}

// ── Email: Admin Action ───────────────────────────────────────
async function sendAdminActionEmail(email, citizen, ticket, newStatus, adminNote) {
    const body = `
        <p>Dear <strong>${citizen.name}</strong>,</p>
        <p>The Super Administrator has taken action on your registered civic issue.</p>
        ${ticketBox([
            ['🎫 Ticket ID', ticket.id],
            ['📂 Department', deptNames[ticket.department] || ticket.department],
            ['📍 Location', ticket.location],
            ['🔄 New Status', statusEmoji[newStatus] || newStatus],
            ['📋 Admin Note', adminNote || 'No additional notes'],
            ['📅 Action Date', new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric' })]
        ])}
        <p>${newStatus === 'closed' ? 'Your ticket has been officially reviewed and closed. Thank you for reporting this issue.' : 'Your ticket has been reassigned and will be addressed by the appropriate department.'}</p>
        <br><p style="color:#475569;">Regards,<br><strong>Super Administration — SmartConnect</strong><br><span style="color:#94a3b8;font-size:13px;">Municipal Issue Resolution Division</span></p>`;
    await sendHTMLEmail(email, `🔔 Admin Review on Ticket #${ticket.id}`, `Admin action taken on ticket #${ticket.id}`, body);
}

// ── Core HTML Email sender ────────────────────────────────────
async function sendHTMLEmail(to, subject, preheader, bodyHtml) {
    if (!to) return;
    try {
        const html = buildEmailHTML(preheader, bodyHtml);
        const plain = bodyHtml.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        const info = await transporter.sendMail({
            from: '"SmartConnect Municipal Portal" <noreply@smartconnect.municipal>',
            to, subject, html, text: plain
        });
        console.log('📧 Email sent:', info.messageId);
    } catch (err) {
        console.error('📧 Email error:', err.message);
    }
}

// ── SMS via Twilio (optional — only if env vars present) ──────
async function sendSMS(mobile, message) {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !mobile) return;
    try {
        const twilio = require('twilio'); // optional dependency
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        const formattedNumber = mobile.startsWith('+') ? mobile : `+91${mobile.replace(/\D/g, '').slice(-10)}`;
        await client.messages.create({ body: message, from: process.env.TWILIO_FROM_NUMBER, to: formattedNumber });
        console.log(`📱 SMS sent to ${formattedNumber}`);
    } catch (err) {
        console.error('📱 SMS error:', err.message);
    }
}

// ── Email: Send OTP ───────────────────────────────────────────
async function sendOTPEmail(email, otp) {
    const body = `
        <p>Hello,</p>
        <p>Thank you for registering with the SmartConnect Municipal Portal.</p>
        <p>Your One-Time Password (OTP) for account verification is:</p>
        <h2 style="font-size:28px;color:#1d4ed8;letter-spacing:4px;background:#e2e8f0;display:inline-block;padding:12px 24px;border-radius:8px;margin:16px 0;">${otp}</h2>
        <p>This code is valid for 10 minutes. Please do not share it with anyone.</p>
        <br><p style="color:#475569;">Regards,<br><strong>SmartConnect Operations Team</strong></p>`;
    await sendHTMLEmail(email, '🔐 Your SmartConnect Verification Code', 'Your OTP for verification', body);
}

// ── Backward-compatible wrapper ───────────────────────────────
async function sendNotification(email, subject, text) {
    await sendHTMLEmail(email, subject, subject, `<p>${text}</p>`);
}

module.exports = { sendNotification, sendTicketSubmittedEmail, sendStatusUpdateEmail, sendAdminActionEmail, sendSMS, sendOTPEmail };
