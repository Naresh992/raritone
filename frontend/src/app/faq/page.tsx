import { ContentPage } from "@/components/ContentPage";
export const metadata={ title:"FAQ" };
const FAQS=[
  ["How does virtual try-on work?","Upload a clear full-body or upper-body photo with good lighting. Choose a product and tap Try It On. Our 2D engine composites the garment onto your photo in a few seconds. You can compare before/after with a slider, zoom, download, save or share your look."],
  ["Is my photo private?","Yes. Photos are stored privately on the server and served only through signed, expiring URLs tied to your account. They are never public, never shared, and auto-deleted per our retention policy (default 30 days). Read the Privacy Policy for details."],
  ["What photo works best?","A straight-on, well-lit photo where your torso is clearly visible. Avoid heavy shadows, cropped shoulders or busy backgrounds. You can also use the camera right inside the try-on flow."],
  ["Can I save try-ons?","Yes — tap Save Look on the result screen. Saved try-ons appear in My Account → My Try-Ons, where you can download, share or delete them."],
  ["How do I know my size?","Each product page has a size guide and shows available sizes. You can also save your measurements (height, weight, chest, waist, hip, shoulder, preferred size) in My Avatar & Measurements to get better guidance."],
  ["What payments do you accept?","UPI, cards, net banking and wallets via Razorpay. No card details are ever stored by Raritone — payment is completed inside Razorpay’s secure checkout."],
  ["How long does delivery take?","Standard: 3–5 days. Express: 1–2 days. Free standard shipping over ₹1,999. You’ll see the estimated delivery date at checkout and in your order confirmation."],
  ["What is the return policy?","Unworn items can be returned within 7 days of delivery. See Returns & Refunds for the full process."],
];
export default function FAQ(){
  return (
    <ContentPage title="FAQ" kicker="Help">
      <div className="divide-y divide-stoney-200 not-prose">
        {FAQS.map(([q,a])=>(
          <details key={q} className="py-4 group">
            <summary className="font-medium cursor-pointer list-none flex justify-between gap-4">{q}<span className="text-stoney-400 group-open:rotate-45 transition">+</span></summary>
            <p className="text-sm text-stoney-600 leading-relaxed mt-2">{a}</p>
          </details>
        ))}
      </div>
    </ContentPage>
  );
}
