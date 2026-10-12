import { ContentPage } from "@/components/ContentPage";
export const metadata={ title:"Terms & Conditions" };
export default function Terms(){
  return (
    <ContentPage title="Terms & Conditions" kicker="Legal">
      <p><em>Last updated: March 2026</em></p>
      <h2>1. Acceptance</h2>
      <p>By accessing or purchasing from Raritone you agree to these Terms. If you do not agree, please do not use the service.</p>
      <h2>2. Accounts</h2>
      <p>You are responsible for the accuracy of your account information and for keeping your credentials secure. OTP-based and email authentication are provided; you must not share access or attempt to access another user’s account or private try-on images.</p>
      <h2>3. Orders & pricing</h2>
      <p>Prices are in INR and inclusive of taxes unless stated otherwise. Inventory and pricing may change until payment is confirmed. We reserve the right to cancel orders affected by pricing or inventory errors and to refund any amount charged.</p>
      <h2>4. Virtual try-on</h2>
      <p>Try-on results are AI-generated previews for guidance only and do not guarantee exact fit, colour or drape. We recommend using the size guide and your saved measurements alongside the preview.</p>
      <h2>5. Intellectual property</h2>
      <p>All Raritone content, branding and product photography are owned by Raritone or its licensors. You may not copy, scrape or redistribute the catalogue or try-on outputs except for personal, non-commercial sharing of your own looks.</p>
      <h2>6. Limitation of liability</h2>
      <p>To the extent permitted by law, Raritone’s liability is limited to the amount you paid for the relevant order.</p>
      <h2>7. Governing law</h2>
      <p>These Terms are governed by the laws of India. Disputes are subject to the jurisdiction of courts in Bengaluru, Karnataka.</p>
    </ContentPage>
  );
}
