import { CONTACT_EMAILS } from '@avdan/types'
import type { LegalSection } from './components/legal-page'

export const LEGAL_UPDATED = '22 November 2026'
const mail = (
  <a href={`mailto:${CONTACT_EMAILS.customer}`}>{CONTACT_EMAILS.customer}</a>
)

export const PRIVACY_INTRO = (
  <p>
    AVDAN Ltd (&ldquo;AVDAN&rdquo;, &ldquo;we&rdquo;) runs the AVDAN marketplace and delivery service at avdanstore.com and in the AVDAN
    customer, vendor and rider apps. This policy explains what personal information we collect, why, who we share it with, how long we
    keep it, and the choices you have. We handle your information in line with the Nigeria Data Protection Act 2023.
  </p>
)

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    heading: 'What we collect',
    body: (
      <>
        <p>Depending on how you use AVDAN:</p>
        <ul>
          <li><strong>Everyone:</strong> your name, email address, phone number, password (stored only as a one-way hash), and a device push-notification token.</li>
          <li><strong>Customers:</strong> delivery addresses and, if you allow it, your device location to suggest an address and price delivery; your orders, payments status and reviews.</li>
          <li><strong>Vendors:</strong> your business name, description, logo, pickup address and map location, product photos, and the bank account details you add to receive payouts.</li>
          <li><strong>Riders:</strong> your delivery-proof photos, your payout bank account, and your location, including in the background while you are online and on a delivery, so dispatch and customers can see where an order is.</li>
        </ul>
        <p>
          We do <strong>not</strong> see or store your card number: card payments are handled by our payment provider, Paystack.
        </p>
      </>
    ),
  },
  {
    heading: 'Why we use it',
    body: (
      <ul>
        <li>To create your account and sign you in, and to keep it secure.</li>
        <li>To take, route, deliver and pay for orders, and to pay vendors and riders.</li>
        <li>To tell you what is happening with an order (in-app, push and email).</li>
        <li>To show vendors near you and calculate delivery fees by distance.</li>
        <li>To prevent fraud and abuse, resolve disputes and moderate reviews.</li>
        <li>To meet our legal, tax and accounting duties.</li>
      </ul>
    ),
  },
  {
    heading: 'What vendors and riders can see',
    body: (
      <p>
        To protect customers, a vendor sees only the customer&apos;s name and order number, never their address, phone number or email. A rider
        receives the delivery address and contact details only when they need them to deliver.
      </p>
    ),
  },
  {
    heading: 'Who we share it with',
    body: (
      <>
        <p>We do not sell your personal information. We share it only with service providers that help us run AVDAN, under their own privacy terms:</p>
        <ul>
          <li><strong>Paystack</strong>: card and bank payments, and payouts to vendors and riders.</li>
          <li><strong>Cloud and hosting providers</strong>: our servers and file storage for product and proof photos.</li>
          <li><strong>Email and push providers</strong>: to send you order emails and notifications.</li>
          <li><strong>Mapping providers</strong>: to show maps and routes.</li>
        </ul>
        <p>We may also disclose information when the law requires it or to protect people from fraud or harm.</p>
      </>
    ),
  },
  {
    heading: 'How long we keep it',
    body: (
      <p>
        We keep your account details while your account is open. Order, payment and payout records are kept for as long as Nigerian tax,
        accounting and dispute rules require, even after you delete your account; after deletion they no longer carry your name, email or
        phone number. Photos you upload for products are kept while the product is listed.
      </p>
    ),
  },
  {
    heading: 'Your choices and rights',
    body: (
      <>
        <ul>
          <li>You can see and correct your details in your profile.</li>
          <li>You can switch off location and notification permissions in your phone settings at any time.</li>
          <li>You can <a href="/delete-account">delete your account</a> from the app or the website. We then remove your name, email, phone, payout bank details and notifications and you can no longer sign in.</li>
          <li>You can ask us for a copy of your data, or object to how we use it, by writing to {mail}.</li>
          <li>You may complain to the Nigeria Data Protection Commission if you believe we have mishandled your information.</li>
        </ul>
      </>
    ),
  },
  {
    heading: 'Security',
    body: (
      <p>
        We protect your information with encryption in transit, hashed passwords and restricted access. No system is perfectly secure, so please
        use a strong password and keep it private.
      </p>
    ),
  },
  {
    heading: 'Children',
    body: <p>AVDAN is not for children under 18 and we do not knowingly collect their information.</p>,
  },
  {
    heading: 'Changes and contact',
    body: (
      <p>
        If we change this policy we will update the date above and, for important changes, tell you in the app or by email. Questions? Write to {mail}.
      </p>
    ),
  },
]

export const TERMS_INTRO = (
  <p>
    These terms govern your use of the AVDAN marketplace and delivery service. By creating an account or placing an order you agree to
    them. If you do not agree, please do not use AVDAN.
  </p>
)

export const TERMS_SECTIONS: LegalSection[] = [
  {
    heading: 'Who we are',
    body: (
      <p>
        AVDAN Ltd operates a marketplace that connects customers with independent vendors, riders and hubs. Vendors are independent sellers;
        AVDAN holds the customer&apos;s payment in escrow and releases it to the vendor once the order is delivered and the delivery code is confirmed.
      </p>
    ),
  },
  {
    heading: 'Accounts',
    body: (
      <ul>
        <li>You must be 18 or older and give accurate information.</li>
        <li>Keep your password private. You are responsible for activity on your account.</li>
        <li>Vendor and rider accounts are approved by AVDAN and may be suspended if these terms or our standards are not met.</li>
      </ul>
    ),
  },
  {
    heading: 'Orders and payment',
    body: (
      <ul>
        <li>Prices are in Naira. The price you pay includes delivery, shown before you pay.</li>
        <li>Payment is processed by Paystack. Your order goes to the vendor once payment is confirmed.</li>
        <li>If a vendor rejects or cannot fulfil an order, you are refunded to your original payment method.</li>
        <li>Give the delivery code to the rider only when you have received your order.</li>
      </ul>
    ),
  },
  {
    heading: 'Cancellations, refunds and disputes',
    body: (
      <p>
        You can cancel an order that has not been paid. If something is wrong with a paid order (not delivered, damaged, not as described) raise a
        dispute and our team will review it. Refund decisions are made by AVDAN based on the evidence available.
      </p>
    ),
  },
  {
    heading: 'Vendors',
    body: (
      <ul>
        <li>List only products you are entitled to sell, with accurate descriptions and genuine photos. AVDAN may review, edit the category of, reject or remove listings.</li>
        <li>Prices shown to customers are set by AVDAN once approved; you are paid the price you asked for, less any agreed fees.</li>
        <li>Do not contact customers outside AVDAN or try to take orders off the platform.</li>
      </ul>
    ),
  },
  {
    heading: 'Riders',
    body: (
      <p>
        Riders deliver orders safely and on time, follow the pickup, hub and delivery steps, use the delivery code correctly, and keep their
        location sharing on while delivering.
      </p>
    ),
  },
  {
    heading: 'Reviews and content',
    body: (
      <p>
        Reviews must be honest and about a real order. Abusive, false, spam or unlawful content is not allowed. Anyone can report a review, and
        we hide content that breaks these rules. We aim to look at reports within 24 hours.
      </p>
    ),
  },
  {
    heading: 'Prohibited use',
    body: (
      <ul>
        <li>Fraud, fake orders or reviews, or attempts to bypass payment or the delivery code.</li>
        <li>Selling illegal, counterfeit or unsafe goods.</li>
        <li>Harassing others, or interfering with or attacking the service.</li>
      </ul>
    ),
  },
  {
    heading: 'Our responsibility',
    body: (
      <p>
        We work to keep AVDAN available and accurate, but we cannot promise it will always be uninterrupted. To the extent the law allows, AVDAN is
        not liable for indirect losses, and our liability for any order is limited to the amount you paid for it. Nothing here limits rights you have
        under Nigerian consumer-protection law.
      </p>
    ),
  },
  {
    heading: 'Ending your account',
    body: (
      <p>
        You can <a href="/delete-account">delete your account</a> at any time. We may suspend or close accounts that break these terms.
      </p>
    ),
  },
  {
    heading: 'Changes, law and contact',
    body: (
      <p>
        We may update these terms and will update the date above; continuing to use AVDAN means you accept the changes. These terms are governed
        by the laws of the Federal Republic of Nigeria. Questions? Write to {mail}.
      </p>
    ),
  },
]

export const DELETE_INTRO = (
  <p>
    You can delete your AVDAN account yourself, from the app or from this website. This page explains how, what is removed, and what we keep.
  </p>
)

export const DELETE_SECTIONS: LegalSection[] = [
  {
    heading: 'How to delete your account',
    body: (
      <>
        <p><strong>In the app (customer, vendor or rider):</strong> open <em>Profile</em>, choose <em>Delete account</em>, enter your password and confirm.</p>
        <p><strong>On the website (customers):</strong> sign in, open <a href="/profile">Profile</a>, scroll to <em>Delete account</em>, enter your password and confirm.</p>
        <p>
          Can&apos;t sign in? Email {mail} from the address on your account, with the subject &ldquo;Delete my account&rdquo;. We will verify it is you and
          delete the account.
        </p>
      </>
    ),
  },
  {
    heading: 'What is removed',
    body: (
      <ul>
        <li>Your name, email address and phone number.</li>
        <li>Your notifications and device push token.</li>
        <li>For vendors and riders: your payout bank account details. A vendor&apos;s store is taken off the marketplace.</li>
        <li>Your ability to sign in. This cannot be undone.</li>
      </ul>
    ),
  },
  {
    heading: 'What we keep, and why',
    body: (
      <p>
        Order, payment and payout records are kept as the law requires for tax, accounting and dispute purposes. After deletion they no longer
        carry your name, email or phone number, and reviews you wrote show as written by &ldquo;Deleted user&rdquo;.
      </p>
    ),
  },
  {
    heading: 'When we cannot delete yet',
    body: (
      <p>
        To protect you and others we can&apos;t delete an account while an order is still in progress, or while a vendor&apos;s or rider&apos;s wallet
        still holds money or a withdrawal is pending. Finish the orders and withdraw your earnings first, then delete. Staff accounts are removed
        by an AVDAN admin.
      </p>
    ),
  },
]
