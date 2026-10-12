import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Shipping & Delivery" };

export default function ShippingPage() {
  return (
    <ContentPage title="Shipping & Delivery" kicker="Support">
      <h2>Where we ship</h2>
      <p>We ship across India — every state and union territory, including remote pincodes. At checkout we verify your pincode before payment.</p>
      <h2>Delivery timelines</h2>
      <p><strong>Metro cities:</strong> 2–4 business days. <strong>Rest of India:</strong> 4–7 business days. Your confirmation page and <Link href="/track-order">order tracking</Link> show a live estimated delivery date per order.</p>
      <h2>Shipping charges</h2>
      <p>Orders over <strong>₹1,999</strong> ship free. Below that, a flat <strong>₹99</strong> delivery fee applies. The exact fee is shown before you pay — no surprises.</p>
      <h2>Tracking</h2>
      <p>Signed-in customers can follow every order under <Link href="/account/orders">My Orders</Link>. Checking out as a guest? Use <Link href="/track-order">Track Order</Link> with the order ID and access token from your confirmation link.</p>
      <h2>Delays & failed delivery</h2>
      <p>Weather, festive rush and address issues can add 1–2 days. If delivery fails twice, the package returns to us and you get an automatic refund to the source payment method.</p>
      <h2>Need help?</h2>
      <p>Write to us via the <Link href="/contact">contact page</Link> with your order ID and we&apos;ll sort it out.</p>
    </ContentPage>
  );
}
