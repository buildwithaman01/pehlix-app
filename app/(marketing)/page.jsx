'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';
import { 
  CreditCard, 
  Zap, 
  Percent, 
  AlertTriangle, 
  FileText, 
  MessageSquare, 
  Star, 
  Play, 
  CheckCircle, 
  ArrowRight, 
  ShieldCheck, 
  Smartphone,
  ChevronRight
} from 'lucide-react';

export default function MarketingPage() {
  const [showDemoModal, setShowDemoModal] = useState(false);
  const [liveStreamIndex, setLiveStreamIndex] = useState(0);

  // Live simulation events for the hero dashboard widget
  const liveEvents = [
    { type: 'payment', text: '₹1,200 Payment received via WhatsApp Paywall', time: 'Just now', tag: 'Success', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { type: 'registration', text: 'Patient R-9831 Auto-Filled in 4.2 seconds', time: '1m ago', tag: 'Speed', color: 'bg-[#5FB3A5]/10 text-[#5FB3A5] border-[#5FB3A5]/20' },
    { type: 'commission', text: '₹240 Commission auto-calculated for Dr. Verma', time: '3m ago', tag: 'Finance', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { type: 'alert', text: 'Critical MCV: 42 acknowledged by Dr. Saxena (SMS)', time: '7m ago', tag: 'Escalation', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { type: 'report', text: 'NABL Report PDF generated with verified QR code', time: '12m ago', tag: 'PDF', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { type: 'summary', text: '9:00 PM Owner WhatsApp digest compiled successfully', time: '20m ago', tag: 'System', color: 'bg-neutral-500/10 text-neutral-300 border-neutral-500/20' }
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setLiveStreamIndex((prev) => (prev + 1) % liveEvents.length);
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  const features = [
    {
      icon: CreditCard,
      title: "Smart WhatsApp Paywall",
      desc: "Automatically block report access until payment is completed. Patients pay securely on WhatsApp via UPI/Cards. Zero manual verification needed.",
      accent: "text-emerald-500 bg-emerald-500/10"
    },
    {
      icon: Zap,
      title: "Sub-60-Second Registration",
      desc: "Returning patient records auto-fill instantly by phone number. Keep reception queues short and eliminate duplicate entries forever.",
      accent: "text-[#5FB3A5] bg-[#5FB3A5]/10"
    },
    {
      icon: Percent,
      title: "Auto Doctor Commissions",
      desc: "Configurable flat or percentage-based payouts. Track referrals, automate statement generation, and settle commissions transparently.",
      accent: "text-blue-500 bg-blue-500/10"
    },
    {
      icon: AlertTriangle,
      title: "Critical Value Alerts",
      desc: "Instant multi-channel notifications (WhatsApp, SMS, and Exotel voice calls) for abnormal results. Automated escalation if doctor does not acknowledge.",
      accent: "text-amber-500 bg-amber-500/10"
    },
    {
      icon: FileText,
      title: "PDF Report Generation",
      desc: "Gorgeous, clean NABL-compliant PDFs featuring e-signatures, critical flags, and secure verification QR codes. Works seamlessly on all mobile screens.",
      accent: "text-purple-500 bg-purple-500/10"
    },
    {
      icon: MessageSquare,
      title: "Daily Owner Summary",
      desc: "Get an executive summary on your phone every night at 9:00 PM IST. Monitor revenue, patient counts, pending collections, and stock flags.",
      accent: "text-sky-500 bg-sky-500/10"
    }
  ];

  const testimonials = [
    {
      stars: 5,
      quote: "Pehlix transformed our daily billing. Since implementing the WhatsApp Paywall, our pending collection dropped to zero. Patients love the ease of paying on UPI.",
      author: "Dr. Alok Verma",
      role: "Director, Apex Diagnostics",
      location: "Patna, Bihar"
    },
    {
      stars: 5,
      quote: "Registering patients takes seconds now. The auto-fill and auto doctor commission features save my accountant 3 hours every single day.",
      author: "Mrs. Meenakshi Shah",
      role: "Owner, Metro Pathology Labs",
      location: "Indore, MP"
    },
    {
      stars: 5,
      quote: "We were skeptical about critical value call escalations, but it literally saved a patient last week. The auto-call triggered when the doctor missed the WhatsApp message.",
      author: "Dr. Suresh Reddy",
      role: "Founder, Pulse Care Center",
      location: "Vijayawada, AP"
    }
  ];

  return (
    <div className="bg-[#F5F7F7] min-h-screen">
      {/* HERO SECTION - Deep Emerald Background, White Text */}
      <section className="relative overflow-hidden bg-[#0F3D3E] text-white pt-16 pb-24 lg:pt-24 lg:pb-32">
        {/* Subtle decorative grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff03_1px,transparent_1px),linear-gradient(to_bottom,#ffffff03_1px,transparent_1px)] bg-[size:4rem_4rem]" />
        
        {/* Soft color highlights */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#5FB3A5]/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Column: Heading and description */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/10 backdrop-blur-md text-xs font-semibold uppercase tracking-wider text-[#5FB3A5]">
                <ShieldCheck className="h-4 w-4" /> Built for Indian Labs
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight leading-[1.1] text-white">
                The Complete Operating System for <span className="text-[#5FB3A5]">Indian Diagnostic Labs</span>
              </h1>
              <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto lg:mx-0 leading-relaxed font-normal">
                Built specifically for Tier 2 and Tier 3 labs. Seamless WhatsApp paywall. Auto doctor commissions. Sub-60-second patient registration. Eliminate leakages.
              </p>
              
              <div className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4 pt-4">
                <Link
                  href="/login?signup=true"
                  className="w-full sm:w-auto text-center bg-[#5FB3A5] hover:bg-[#5FB3A5]/95 text-[#0F3D3E] text-base font-bold px-8 py-4 rounded-xl hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-[#5FB3A5]/15"
                >
                  Start Free Trial
                </Link>
                <button
                  onClick={() => setShowDemoModal(true)}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-white/10 hover:bg-white/15 border border-white/20 text-white text-base font-bold px-8 py-4 rounded-xl hover:shadow-lg transition-all duration-300"
                >
                  <Play className="h-5 w-5 fill-white text-white" /> Watch Demo
                </button>
              </div>

              {/* Simple Bullet Points */}
              <div className="grid grid-cols-2 gap-4 max-w-md mx-auto lg:mx-0 pt-6 text-left border-t border-white/10">
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-[#5FB3A5]" />
                  <span className="text-sm font-medium text-white/90">14-day free trial</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-[#5FB3A5]" />
                  <span className="text-sm font-medium text-white/90">No credit card required</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-[#5FB3A5]" />
                  <span className="text-sm font-medium text-white/90">UPI & QR payments</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <CheckCircle className="h-5 w-5 text-[#5FB3A5]" />
                  <span className="text-sm font-medium text-white/90">Setup in under 10 mins</span>
                </div>
              </div>
            </div>

            {/* Right Column: Live Operating System Preview Widget */}
            <div className="lg:col-span-5 relative w-full max-w-md lg:max-w-none mx-auto">
              <div className="relative rounded-2xl bg-[#1E1E1E] border border-white/10 shadow-2xl p-6 overflow-hidden">
                {/* Simulated window controls */}
                <div className="flex items-center gap-2 mb-6 border-b border-white/5 pb-4">
                  <div className="w-3.5 h-3.5 rounded-full bg-red-500/80" />
                  <div className="w-3.5 h-3.5 rounded-full bg-yellow-500/80" />
                  <div className="w-3.5 h-3.5 rounded-full bg-green-500/80" />
                  <span className="ml-4 text-xs font-mono text-white/40 tracking-wider">pehlix-live-operations.sh</span>
                  <div className="ml-auto flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span className="text-xs font-mono text-emerald-400">Live</span>
                  </div>
                </div>

                {/* Dashboard Mockup Content */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-white/60">Today's Revenue</p>
                      <p className="text-xl font-bold text-white mt-1">₹34,800</p>
                      <span className="text-[10px] text-emerald-400 font-medium">↑ 18% vs yesterday</span>
                    </div>
                    <div className="bg-white/5 border border-white/5 rounded-xl p-3.5">
                      <p className="text-xs text-white/60">Pending Invoices</p>
                      <p className="text-xl font-bold text-white mt-1">0</p>
                      <span className="text-[10px] text-emerald-400 font-medium">100% paywall success</span>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    <p className="text-xs font-semibold text-[#5FB3A5] uppercase tracking-wider">Operations Log</p>
                    <div className="space-y-2 h-[200px] overflow-hidden relative">
                      {liveEvents.map((ev, index) => {
                        const isVisible = index === liveStreamIndex || (index < liveStreamIndex && index > liveStreamIndex - 3) || (liveStreamIndex === 0 && index > liveEvents.length - 3);
                        const isPrimary = index === liveStreamIndex;

                        return (
                          <div 
                            key={index} 
                            className={`flex flex-col gap-1.5 p-3 rounded-xl border transition-all duration-700 ${
                              isPrimary 
                                ? 'bg-white/10 border-white/20 scale-[1.02] shadow-md z-10' 
                                : 'bg-white/5 border-white/5 opacity-40 scale-95'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${ev.color}`}>
                                {ev.tag}
                              </span>
                              <span className="text-[10px] text-white/40">{ev.time}</span>
                            </div>
                            <p className="text-xs font-medium text-white/95">{ev.text}</p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Overlay gradient mask at the bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#1E1E1E] to-transparent pointer-events-none" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE SECTION - 6 cards */}
      <section id="features" className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 scroll-mt-16">
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 sm:mb-20">
          <h2 className="text-[#0F3D3E] text-xs font-bold uppercase tracking-widest">Everything You Need</h2>
          <h3 className="text-3xl sm:text-4xl font-extrabold text-[#1E1E1E] tracking-tight">
            Features Tailored For Modern Indian Laboratories
          </h3>
          <p className="text-base sm:text-lg text-[#1E1E1E]/70 leading-relaxed font-normal">
            Pehlix handles everything from patient check-in to report distribution. Let your team focus on pathology while our software automates the rest.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((f, i) => (
            <div 
              key={i} 
              className="bg-white rounded-2xl border border-[#0F3D3E]/5 hover:border-[#0F3D3E]/15 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 p-8 flex flex-col justify-between group shadow-sm"
            >
              <div className="space-y-4">
                <div className={`p-3.5 rounded-xl w-fit ${f.accent} group-hover:scale-105 transition-transform duration-300`}>
                  <f.icon className="h-6 w-6" />
                </div>
                <h4 className="text-lg font-bold text-[#1E1E1E] group-hover:text-[#0F3D3E] transition-colors">
                  {f.title}
                </h4>
                <p className="text-sm text-[#1E1E1E]/70 leading-relaxed">
                  {f.desc}
                </p>
              </div>
              <div className="pt-6 mt-6 border-t border-[#0F3D3E]/5 flex items-center gap-1.5 text-xs font-semibold text-[#0F3D3E] group-hover:translate-x-1 transition-transform duration-300 w-fit">
                Learn more <ChevronRight className="h-3.5 w-3.5" />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SOCIAL PROOF SECTION - 3 Testimonial Cards */}
      <section className="bg-white py-20 lg:py-28 border-y border-[#0F3D3E]/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto space-y-4 mb-16 sm:mb-20">
            <h2 className="text-[#5FB3A5] text-xs font-bold uppercase tracking-widest">Social Proof</h2>
            <h3 className="text-3xl sm:text-4xl font-extrabold text-[#1E1E1E] tracking-tight">
              Trusted by Labs Across India
            </h3>
            <p className="text-base text-[#1E1E1E]/70">
              Lab owners and pathologists are scaling their operations and eliminating leakages with Pehlix. Here is what they say:
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {testimonials.map((t, i) => (
              <div 
                key={i} 
                className="bg-[#F5F7F7] border border-[#0F3D3E]/5 rounded-2xl p-8 flex flex-col justify-between hover:shadow-md transition-shadow duration-300"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-1 text-[#5FB3A5]">
                    {[...Array(t.stars)].map((_, index) => (
                      <Star key={index} className="h-4.5 w-4.5 fill-[#5FB3A5] text-[#5FB3A5]" />
                    ))}
                  </div>
                  <p className="text-sm sm:text-base text-[#1E1E1E]/80 italic leading-relaxed">
                    "{t.quote}"
                  </p>
                </div>
                <div className="mt-8 pt-6 border-t border-[#0F3D3E]/5 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-[#0F3D3E] text-[#5FB3A5] flex items-center justify-center font-bold text-sm shadow">
                    {t.author.charAt(3)}
                  </div>
                  <div>
                    <h5 className="text-sm font-bold text-[#1E1E1E]">{t.author}</h5>
                    <p className="text-xs text-[#1E1E1E]/60">{t.role}, <span className="font-semibold text-[#0F3D3E]">{t.location}</span></p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* PRICING BRIEF SECTION - Links to /pricing */}
      <section className="py-20 lg:py-28 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-[#0F3D3E] text-white rounded-3xl p-8 sm:p-12 lg:p-16 relative overflow-hidden shadow-xl">
          {/* Gradients */}
          <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-[#5FB3A5]/10 rounded-full blur-[80px] pointer-events-none" />

          <div className="relative grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 space-y-4 text-center lg:text-left">
              <span className="text-[#5FB3A5] text-xs font-bold uppercase tracking-widest">Simple Transparent Payout</span>
              <h3 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
                Simple Pricing That Grows With You
              </h3>
              <p className="text-base sm:text-lg text-white/80 max-w-2xl mx-auto lg:mx-0 font-normal">
                Choose a plan matching your lab volume. All plans include a <strong>14-day free trial</strong> with zero upfront configuration cost. No credit card required.
              </p>

              {/* Plans Overview row */}
              <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-6 pt-4 text-sm">
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/5 font-semibold">
                  Starter <span className="text-[#5FB3A5] font-bold">₹999</span>/mo
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/5 font-semibold">
                  Growth <span className="text-[#5FB3A5] font-bold">₹2,499</span>/mo
                </div>
                <div className="bg-white/10 px-4 py-2 rounded-xl border border-white/5 font-semibold font-extrabold border-[#5FB3A5]/30">
                  Pro <span className="text-[#5FB3A5] font-bold">₹4,999</span>/mo
                </div>
              </div>
            </div>

            <div className="lg:col-span-4 flex flex-col items-center justify-center gap-4">
              <Link 
                href="/pricing"
                className="w-full sm:w-auto text-center bg-[#5FB3A5] hover:bg-[#5FB3A5]/95 text-[#0F3D3E] text-base font-bold px-8 py-4 rounded-xl shadow-lg transition-all duration-300"
              >
                Compare Plans & Features
              </Link>
              <Link 
                href="/login?signup=true"
                className="text-sm font-semibold text-white hover:text-[#5FB3A5] flex items-center gap-1.5 transition-colors group"
              >
                Start free trial now <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* DEMO MODAL COMPONENT */}
      {showDemoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="relative w-full max-w-3xl bg-[#1E1E1E] text-white rounded-2xl overflow-hidden shadow-2xl border border-white/10">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Play className="h-4.5 w-4.5 fill-[#5FB3A5] text-[#5FB3A5]" /> Pehlix Platform Walkthrough
              </h3>
              <button 
                onClick={() => setShowDemoModal(false)}
                className="text-white/60 hover:text-white transition-colors text-sm font-bold bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded-lg"
              >
                Close
              </button>
            </div>

            {/* Video Placeholder Container */}
            <div className="aspect-video bg-neutral-900 flex flex-col items-center justify-center p-8 text-center relative">
              <div className="p-5 bg-[#0F3D3E]/60 border border-[#5FB3A5]/20 rounded-full mb-4 animate-bounce">
                <Smartphone className="h-10 w-10 text-[#5FB3A5]" />
              </div>
              <h4 className="text-xl font-bold text-white">Pehlix Interactive Demo Video</h4>
              <p className="text-sm text-white/60 max-w-md mt-2">
                A 3-minute video covering the reception desk, the technician result entry, critical call escalation, and WhatsApp payment receipts.
              </p>
              
              <div className="mt-6 flex gap-4">
                <Link
                  href="/login?signup=true"
                  onClick={() => setShowDemoModal(false)}
                  className="bg-[#5FB3A5] hover:bg-[#5FB3A5]/90 text-[#0F3D3E] font-bold text-sm px-6 py-2.5 rounded-xl shadow transition-all"
                >
                  Start 14-Day Trial
                </Link>
                <button
                  onClick={() => setShowDemoModal(false)}
                  className="bg-white/10 hover:bg-white/15 text-white font-bold text-sm px-6 py-2.5 rounded-xl transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
