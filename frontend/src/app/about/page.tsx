import { ContentPage } from "@/components/ContentPage";
export const metadata = { title:"About Raritone" };
export default function About(){
  return (
    <ContentPage title="About Raritone" kicker="Our story">
      <p>Raritone is an AI-powered fashion shopping platform where customers can discover and purchase clothing — and virtually try everything on using their own photo before they buy.</p>
      <p>We started with a simple observation: online fashion has a try-on problem. Sizing is inconsistent, photography flatters the hanger more than the person, and returns are wasteful. Raritone fixes that by putting a virtual fitting room inside every product.</p>
      <h2>Try before you buy — for real</h2>
      <p>Every product card and product page has a <strong>Try It On</strong> button. Upload a clear photo, and our 2D virtual try-on engine shows how the garment looks on you in seconds. No 3D avatar, no app download — just your photo, your size, your decision.</p>
      <h2>Built for India, designed like a fashion house</h2>
      <p>We’re a premium, minimal, fashion-first store — not a SaaS dashboard. Generous whitespace, restrained typography, large photography, and smooth micro-interactions. Apple-like simplicity, fashion-house curation. Our visual language is black, white and neutral fashion tones with a discreet clay accent.</p>
      <h2>What we sell</h2>
      <p>Men’s and women’s essentials — t-shirts, shirts, hoodies, jackets, tops and dresses — from Raritone Studio and a small roster of partner labels. Every listing shows real pricing in INR, accurate inventory by size, and honest ratings.</p>
      <h2>What’s next</h2>
      <p>This MVP ships with 2D try-on. Our architecture is ready for 3D avatar and AR try-on when those models are production-ready — without rebuilding the storefront. The <code>tryOnService</code> abstraction makes the model swappable.</p>
      <p className="text-xs text-stoney-600">Raritone Private Limited · Bengaluru · Made in India</p>
    </ContentPage>
  );
}
