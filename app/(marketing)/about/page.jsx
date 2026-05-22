'use client';

import { ShieldCheck, HeartPulse, Building2, Users } from 'lucide-react';
import Link from 'next/link';

export default function AboutPage() {
  const values = [
    {
      icon: HeartPulse,
      title: "Healthcare First",
      desc: "Diagnostics form the bedrock of 70% of medical decisions in India. Our mission is to make diagnostic processes 10x more reliable and accessible."
    },
    {
      icon: Building2,
      title: "Tailored for Tier 2 & 3",
      desc: "Unlike generic SaaS built for metro cities, Pehlix is optimized for regional labs, phlebotomists on mobile networks, and payments on WhatsApp."
    },
    {
      icon: Users,
      title: "Empowering Doctors & Staff",
      desc: "Automating commissions and lab operations reduces manual friction, allowing lab owners to focus on doctors and patient care."
    }
  ];

  return (
    <div className="bg-[#F5F7F7] min-h-screen py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 sm:mb-20">
          <h1 className="text-[#0F3D3E] text-xs font-bold uppercase tracking-widest">Our Mission</h1>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1E1E1E] tracking-tight">
            Building digital infrastructure for Indian diagnostic labs
          </h2>
          <p className="text-base sm:text-lg text-[#1E1E1E]/70 font-normal leading-relaxed">
            Pehlix is an operating system designed from the ground up to solve payment leakages, billing delays, and patient tracking for regional pathology labs in India.
          </p>
        </div>

        {/* Narrative Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20 lg:mb-28">
          <div className="space-y-6">
            <h3 className="text-2xl font-bold text-[#1E1E1E]">Why we built Pehlix</h3>
            <p className="text-[#1E1E1E]/80 text-sm sm:text-base leading-relaxed font-normal">
              Most pathology laboratories in Tier 2 and Tier 3 cities across India struggle with daily operational inefficiencies. Patient registrations take too long, doctor referral payments are managed on paper logs, and diagnostic reports are shared manually via WhatsApp web.
            </p>
            <p className="text-[#1E1E1E]/80 text-sm sm:text-base leading-relaxed font-normal">
              Pehlix introduces automated billing gates, instant UPI WhatsApp paywalls, smart critical-value calling triggers, and real-time ledger accounting. Our tools empower small to mid-sized labs to function with the tech-stack of a corporate chain.
            </p>
            <div className="pt-2">
              <Link 
                href="/login?signup=true"
                className="inline-flex items-center gap-2 bg-[#0F3D3E] hover:bg-[#0F3D3E]/90 text-white font-bold text-sm px-6 py-3 rounded-xl transition-all shadow-md"
              >
                Join Pehlix today <ShieldCheck className="h-4.5 w-4.5 text-[#5FB3A5]" />
              </Link>
            </div>
          </div>
          
          <div className="bg-[#0F3D3E] text-white p-8 sm:p-12 rounded-3xl relative overflow-hidden shadow-xl border border-white/5">
            <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#5FB3A5]/10 rounded-full blur-3xl pointer-events-none" />
            <h4 className="text-xl font-bold mb-4 text-[#5FB3A5]">Pehlix by the numbers</h4>
            
            <div className="space-y-6 pt-4">
              <div className="flex items-center gap-4">
                <span className="text-3xl font-extrabold text-white">99%</span>
                <span className="text-sm text-white/70">Payment collection rate using our WhatsApp paywall</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-extrabold text-white">&lt;60s</span>
                <span className="text-sm text-white/70 font-semibold text-[#5FB3A5]">Patient registration time including auto-fill parameters</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-3xl font-extrabold text-white">100%</span>
                <span className="text-sm text-white/70">Paperless doctor commission statement compilation</span>
              </div>
            </div>
          </div>
        </div>

        {/* Values grid */}
        <div>
          <div className="text-center mb-12 sm:mb-16">
            <h3 className="text-2xl font-bold text-[#1E1E1E]">Our Core Values</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((val, idx) => (
              <div key={idx} className="bg-white border border-[#0F3D3E]/5 rounded-2xl p-8 hover:shadow-md transition-shadow duration-300">
                <div className="p-3 bg-[#0F3D3E]/5 text-[#0F3D3E] rounded-xl w-fit mb-4">
                  <val.icon className="h-6 w-6" />
                </div>
                <h4 className="font-bold text-base sm:text-lg text-[#1E1E1E] mb-2">{val.title}</h4>
                <p className="text-[#1E1E1E]/70 text-xs sm:text-sm leading-relaxed font-normal">{val.desc}</p>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
