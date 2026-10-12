import { ContentPage } from "@/components/ContentPage";
export const metadata={ title:"Privacy Policy" };
export default function Privacy(){
  return (
    <ContentPage title="Privacy Policy" kicker="Legal">
      <p><em>Last updated: March 2026</em></p>
      <h2>1. Photos you upload for try-on</h2>
      <p>Try-on photos are stored privately and are <strong>never public</strong>. They are served only through signed, expiring URLs that require your session to access. Access is restricted to your account (and, when you explicitly share a look, to the recipient of that share link). Photos are auto-deleted after our retention window (default 30 days, configurable via <code>UPLOAD_RETENTION_DAYS</code>).</p>
      <h2>2. What we collect</h2>
      <p>Account details (name, email, phone), order and delivery information, measurements you choose to save, wishlist and try-on history, and analytics events (product viewed, try-on started/completed, add to cart, purchase). We do not store raw payment card details — payments are handled by Razorpay.</p>
      <h2>3. How we use it</h2>
      <p>To fulfill orders, enable virtual try-on, improve sizing guidance, and measure whether try-on helps conversion. Analytics are aggregated; individual try-on images are never used for training without explicit consent.</p>
      <h2>4. Sharing</h2>
      <p>We share data only with service providers needed to operate the store (payment processor, hosting, AI inference if you’ve connected a remote try-on model). Each integration is documented and governed by our data processing terms.</p>
      <h2>5. Security</h2>
      <p>HTTPS, secure OTP and session handling, API authentication, rate limiting, input validation, private object storage with signed URLs, and database access controls. Frontend code never contains model or payment secrets — those live in server-side environment variables.</p>
      <h2>6. Your rights</h2>
      <p>You can access, correct or delete your data from My Account → Settings, or by emailing <a href="mailto:privacy@raritone.com">privacy@raritone.com</a>. Deleting your account removes your photos, measurements and try-on history per the retention policy.</p>
      <h2>7. Contact</h2>
      <p>Raritone Private Limited · Bengaluru · <a href="mailto:privacy@raritone.com">privacy@raritone.com</a></p>
    </ContentPage>
  );
}
