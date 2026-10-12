import Link from "next/link";
import { ContentPage } from "@/components/ContentPage";

export const metadata = { title: "Size Guide" };

function Table({ head, rows }: { head: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto not-prose my-4">
      <table className="w-full text-sm border border-stoney-200 bg-white">
        <thead>
          <tr className="bg-stoney-50">
            {head.map((h) => <th key={h} className="text-left font-medium px-3 py-2 border-b border-stoney-200">{h}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-stoney-100 last:border-0">
              {r.map((c, j) => <td key={j} className="px-3 py-2 text-stoney-600">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function SizeGuidePage() {
  return (
    <ContentPage title="Size Guide" kicker="Support">
      <p>Measurements are body measurements in inches. When between sizes, we recommend sizing up for oversized fits and down for slim fits. Still unsure? <Link href="/try-on">Try it on virtually</Link> before you decide.</p>
      <h2>Men&apos;s tops (chest)</h2>
      <Table head={["Size", "Chest (in)", "India"]} rows={[["S", "36", "36"], ["M", "38", "38"], ["L", "40", "40"], ["XL", "42", "42"], ["XXL", "44", "44"]]} />
      <h2>Women&apos;s tops (bust)</h2>
      <Table head={["Size", "Bust (in)", "India"]} rows={[["XS", "32", "26"], ["S", "34", "28"], ["M", "36", "30"], ["L", "38", "32"], ["XL", "40", "34"]]} />
      <h2>How to measure</h2>
      <p><strong>Chest / bust:</strong> tape around the fullest part, keeping it level across your back. <strong>Waist:</strong> around your natural waistline. <strong>Hips:</strong> around the fullest part of your hips, feet together.</p>
      <h2>Fit notes</h2>
      <p>Each product lists its fit (regular, oversized, relaxed, boxy, slim, cropped, wrap). Oversized styles are cut 1–2&quot; roomier than the table — check the product page for the model&apos;s size reference.</p>
    </ContentPage>
  );
}
