export function ContentPage({ title, kicker, children }: { title:string; kicker?:string; children: React.ReactNode }){
  return (
    <div className="max-w-[1280px] mx-auto px-4 lg:px-6 py-10">
      {kicker && <div className="text-[11px] tracking-[0.22em] uppercase text-blood font-bold">{kicker}</div>}
      <h1 className="font-display uppercase text-4xl lg:text-5xl leading-[0.9] mt-3 max-w-[16ch]">{title}</h1>
      <div className="bg-bone text-ink mt-8 p-6 lg:p-10 max-w-[860px]">
        <div className="prose prose-stone max-w-none text-sm leading-relaxed
          prose-headings:font-display prose-headings:uppercase prose-h2:text-xl prose-h2:mt-8 prose-h3:text-base prose-p:text-ink/70 prose-a:underline prose-a:underline-offset-4 prose-strong:text-ink">
          {children}
        </div>
      </div>
    </div>
  );
}
