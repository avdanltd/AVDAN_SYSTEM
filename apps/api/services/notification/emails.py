import logging
import resend
from core.config import settings

logger = logging.getLogger(__name__)

# Configure resend client globally
if settings.resend_api_key:
    resend.api_key = settings.resend_api_key

# ── Brand Styling Constants ──
# Royal Blue: HSL 220, 85%, 50% -> #115DF2
COLOR_PRIMARY = "#115DF2"
# Orange/Amber Highlight: HSL 35, 95%, 55% -> #F59E0B
COLOR_HIGHLIGHT = "#F59E0B"
# Dark Navy: HSL 225, 60%, 10% -> #0A1226
COLOR_TEXT = "#0A1226"
COLOR_BG = "#F3F4F6"
COLOR_WHITE = "#FFFFFF"
LOGO_URL = "https://api.avdanstore.com/static/logo.png"

def _wrap_in_template(content_html: str, preview_text: str = "AVDAN Notification") -> str:
    """Wraps body content inside the standard AVDAN HTML brand email template wrapper."""
    return f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AVDAN</title>
  <style>
    body {{
      margin: 0;
      padding: 0;
      background-color: {COLOR_BG};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      color: {COLOR_TEXT};
      -webkit-font-smoothing: antialiased;
    }}
    .wrapper {{
      width: 100%;
      background-color: {COLOR_BG};
      padding: 40px 0;
    }}
    .container {{
      max-width: 600px;
      margin: 0 auto;
      background-color: {COLOR_WHITE};
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    }}
    .header {{
      background-color: {COLOR_PRIMARY};
      padding: 30px;
      text-align: center;
      border-bottom: 4px solid {COLOR_HIGHLIGHT};
    }}
    .header img {{
      height: 48px;
      margin-bottom: 10px;
    }}
    .header h1 {{
      margin: 0;
      color: {COLOR_WHITE};
      font-size: 24px;
      font-weight: 700;
      letter-spacing: -0.025em;
    }}
    .content {{
      padding: 40px 30px;
      line-height: 1.6;
    }}
    .footer {{
      background-color: {COLOR_TEXT};
      color: #9CA3AF;
      padding: 20px 30px;
      text-align: center;
      font-size: 12px;
    }}
    .footer a {{
      color: {COLOR_HIGHLIGHT};
      text-decoration: none;
    }}
    .button {{
      display: inline-block;
      background-color: {COLOR_PRIMARY};
      color: {COLOR_WHITE} !important;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 600;
      margin: 20px 0;
      text-align: center;
    }}
    .highlight-box {{
      background-color: #EFF6FF;
      border-left: 4px solid {COLOR_PRIMARY};
      padding: 15px;
      margin: 20px 0;
      border-radius: 0 6px 6px 0;
    }}
  </style>
</head>
<body>
  <span style="display:none !important; visibility:hidden; opacity:0; color:transparent; height:0; width:0;">{preview_text}</span>
  <div class="wrapper">
    <div class="container">
      <div class="header">
        <img src="{LOGO_URL}" alt="AVDAN Logo" onerror="this.style.display='none'">
        <h1>AVDAN</h1>
      </div>
      <div class="content">
        {content_html}
      </div>
      <div class="footer">
        <p>&copy; 2026 AVDAN. All rights reserved.</p>
        <p>You received this email because you registered on avdanstore.com</p>
      </div>
    </div>
  </div>
</body>
</html>
"""

def build_otp_email(name: str, otp: str) -> str:
    """Builds the OTP verification email HTML content."""
    content = f"""
    <h2 style="margin-top: 0; font-size: 20px; font-weight: 600;">Hello {name},</h2>
    <p>Thank you for signing up on AVDAN. To complete your account registration, please verify your email address using the 6-digit verification code below:</p>
    
    <div style="text-align: center; margin: 30px 0;">
      <span style="display: inline-block; background-color: #F3F4F6; border: 2px dashed {COLOR_PRIMARY}; color: {COLOR_PRIMARY}; font-size: 32px; font-weight: 700; letter-spacing: 6px; padding: 12px 28px; border-radius: 8px;">
        {otp}
      </span>
    </div>
    
    <p style="color: #4B5563; font-size: 14px;">This code is valid for 10 minutes. If you did not request this code, please ignore this email or contact support if you have concerns.</p>
    """
    return _wrap_in_template(content, preview_text=f"Your AVDAN verification code is {otp}")

def build_order_status_email(name: str, order_id: str, title: str, status_message: str) -> str:
    """Builds an HTML email for order status notifications."""
    content = f"""
    <h2 style="margin-top: 0; font-size: 20px; font-weight: 600;">Hi {name},</h2>
    <p>We are updating you on your order status:</p>
    
    <div class="highlight-box">
      <strong style="color: {COLOR_PRIMARY}; display: block; font-size: 16px; margin-bottom: 5px;">{title}</strong>
      <span>{status_message}</span>
    </div>
    
    <div style="margin-top: 20px;">
      <p style="margin: 5px 0; font-size: 14px; color: #4B5563;"><strong>Order ID:</strong> {order_id}</p>
    </div>
    
    <div style="text-align: center;">
      <a href="https://avdanstore.com/orders/{order_id}" class="button">Track Your Order</a>
    </div>
    """
    return _wrap_in_template(content, preview_text=f"Order Update: {title}")

def send_email_via_resend(to_email: str, subject: str, html_content: str) -> bool:
    """Invokes the Resend API client to deliver an email."""
    if not settings.resend_api_key:
        logger.warning("Resend API key is not configured. Email to %s suppressed.", to_email)
        return False
    try:
        r = resend.Emails.send({
            "from": settings.email_from,
            "to": to_email,
            "subject": subject,
            "html": html_content
        })
        logger.info("Resend successfully sent email to %s: response id %s", to_email, r.get("id"))
        return True
    except Exception as e:
        logger.error("Failed to send email to %s via Resend: %s", to_email, e)
        return False
