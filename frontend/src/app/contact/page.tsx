"use client";
import { useState } from "react";
import { ContentPage } from "@/components/ContentPage";
import { Button, Input, Label, Textarea } from "@/components/ui";
import { Api } from "@/lib/api";
import { useToast } from "@/lib/store";

export default function Contact(){
  const [form,setForm]=useState({name:"",email:"",subject:"",message:""}); const [sent,setSent]=useState(false); const toast=useToast();
  async function submit(e:React.FormEvent){
    e.preventDefault();
    try{ await Api.contact(form); setSent(true); }catch(err:any){ toast.push(err.message,"error"); }
  }
  return (
    <ContentPage title="Contact" kicker="Get in touch">
      <p>Questions about sizing, orders, try-on or returns? We’re here to help.</p>
      <div className="grid lg:grid-cols-2 gap-8 mt-6 not-prose">
        <div className="border border-stoney-200 p-4 lg:p-6 space-y-3 text-sm">
          <div><span className="font-medium">Email</span><br/><a href="mailto:hello@raritone.com" className="underline underline-offset-4">hello@raritone.com</a></div>
          <div><span className="font-medium">Hours</span><br/>Mon–Sat, 10am–7pm IST</div>
          <div className="text-xs text-stoney-600">We aim to reply within one business day.</div>
        </div>
        {sent ? (
          <div className="border border-green-200 bg-green-50 p-6 text-sm">Thank you — your message has been sent. We’ll be in touch shortly.</div>
        ) : (
          <form onSubmit={submit} className="border border-stoney-200 p-4 lg:p-6 space-y-4">
            <div><Label>Name</Label><Input value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required/></div>
            <div><Label>Email</Label><Input value={form.email} onChange={e=>setForm({...form,email:e.target.value})} required/></div>
            <div><Label>Subject</Label><Input value={form.subject} onChange={e=>setForm({...form,subject:e.target.value})}/></div>
            <div><Label>Message</Label><Textarea value={form.message} onChange={e=>setForm({...form,message:e.target.value})} required/></div>
            <Button type="submit" className="w-full">Send message</Button>
          </form>
        )}
      </div>
    </ContentPage>
  );
}
