import { ContentPage } from "@/components/ContentPage";
export const metadata={ title:"Returns & Refunds" };
export default function Returns(){
  return (
    <ContentPage title="Returns & Refunds" kicker="Support">
      <h2>7-day returns</h2>
      <p>Unworn, unwashed items with original tags can be returned within 7 days of delivery. Initiate a return from <strong>My Account → My Orders → Request return</strong>. Once approved, a pickup is scheduled and the refund is issued to your original payment method.</p>
      <h2>Non-returnable</h2>
      <p>Items marked as final sale, worn or altered items, and items without tags.</p>
      <h2>Refunds</h2>
      <p>Refunds are processed within 5–7 business days after the returned item is received and inspected. You’ll receive an email when the refund is issued.</p>
      <h2>Cancellations</h2>
      <p>Orders can be cancelled before they ship from My Orders. If the order was already paid, the amount is refunded in full. Shipped orders must follow the return flow.</p>
      <h2>Damaged or wrong item</h2>
      <p>Contact <a href="mailto:hello@raritone.com">hello@raritone.com</a> within 48 hours of delivery with photos. We’ll arrange a replacement or full refund.</p>
    </ContentPage>
  );
}
