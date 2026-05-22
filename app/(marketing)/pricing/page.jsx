'use client';

import { useState } from 'react';
import Link from 'next/link';
import { 
  Check, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  Info,
  Calendar,
  Sparkles,
  Zap,
  Building
} from 'lucide-react';

export default function PricingPage() {
  const [billingCycle, setBillingCycle] = useState('monthly'); // 'monthly' or 'annual'
  const [openFaq, setOpenFaq] = useState(null);

  const plans = [
    {
      id: 'starter',
      name: 'Starter',
      icon: Zap,
      desc: 'Perfect for local clinics and budding diagnostic setups.',
      monthlyPrice: 999,
      annualPrice: 9990,
      features: [
        'Up to 500 patients / month',
        'Up to 5 staff accounts',
        'Smart WhatsApp Paywall',
        'Basic PDF reports & templates',
        'Secure patient check-in dashboard',
        'UPI & QR payment integration',
        'Email & chat support'
      ],
      cta: 'Start 14-Day Free Trial',
      popular: false,
      accent: 'border-[#0F3D3E]/10 bg-white'
    },
    {
      id: 'growth',
      name: 'Growth',
      icon: Sparkles,
      desc: 'Designed for scaling diagnostic labs with doctor networks.',
      monthlyPrice: 2499,
      annualPrice: 24990,
      features: [
        'Up to 2,000 patients / month',
        'Up to 15 staff accounts',
        'Smart WhatsApp Paywall',
        'Auto Doctor Commission engine',
        'Daily 9pm WhatsApp digest',
        'Home Collection & phlebo app',
        'Inventory tracking & warnings',
        'NABL compliant report formats',
        'Priority email & WhatsApp support'
      ],
      cta: 'Start 14-Day Free Trial',
      popular: true,
      accent: 'border-[#5FB3A5] bg-white ring-4 ring-[#5FB3A5]/10'
    },
    {
      id: 'pro',
      name: 'Pro',
      icon: Building,
      desc: 'Built for large multi-center diagnostic labs & operations.',
      monthlyPrice: 4999,
      annualPrice: 49990,
      features: [
        'Unlimited patients / month',
        'Unlimited staff accounts',
        'Smart WhatsApp Paywall',
        'All features in Growth plan',
        'Custom lab report templates',
        'Multi-center tenant support',
        'Advanced analytics dashboard',
        'White-glove onboarding & setup',
        'Dedicated account manager 24/7'
      ],
      cta: 'Contact Sales',
      popular: false,
      accent: 'border-[#0F3D3E]/10 bg-white'
    }
  ];

  const faqs = [
    {
      q: "How does the WhatsApp paywall work?",
      a: "Once the pathologist approves a report, Pehlix automatically messages the patient. The message details their test outcomes and displays a secure UPI payment link. When they finish paying, the NABL PDF report is instantly sent to them on WhatsApp. If they already paid upfront, the report is shared instantly."
    },
    {
      q: "Are there any setup fees or hidden charges?",
      a: "Absolutely not. There are zero setup fees or hidden installation charges. Your subscription fee includes template fees for WhatsApp messages up to generous usage bounds, and online payment transaction charges are directly settled via Razorpay."
    },
    {
      q: "Can I change my plan or cancel at any time?",
      a: "Yes. You can upgrade, downgrade, or cancel your subscription at any time right from your dashboard billing panel. Changes are prorated, meaning you are only billed for what you use."
    },
    {
      q: "How do the auto doctor commission calculations work?",
      a: "During patient check-in, you select the referring doctor. If that doctor is configured with a percentage (e.g. 10%) or flat rate commission on that test, our ledger registers it automatically once the patient's invoice is marked paid. You can pull complete statements monthly."
    },
    {
      q: "What does the 14-day free trial include?",
      a: "The trial includes complete, unrestricted access to the selected plan's features (excluding WhatsApp direct text broadcast limits to prevent spam). You do not need to register a credit card to try it out. You can choose to lock in a tier anytime."
    }
  ];

  const toggleFaq = (index) => {
    if (openFaq === index) {
      setOpenFaq(null);
    } else {
      setOpenFaq(index);
    }
  };

  return (
    <div className="bg-[#F5F7F7] min-h-screen py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Page Header */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 sm:mb-20">
          <h1 className="text-[#0F3D3E] text-xs font-bold uppercase tracking-widest">Pricing Plans</h1>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1E1E1E] tracking-tight">
            Simple, Fair pricing with no surprises
          </h2>
          <p className="text-base sm:text-lg text-[#1E1E1E]/70 font-normal leading-relaxed">
            All plans include a 14-day free trial. No credit card required. Cancel or swap tiers at any time.
          </p>

          {/* Billing Cycle Toggle */}
          <div className="flex items-center justify-center gap-4 pt-6">
            <span className={`text-sm font-semibold transition-colors ${billingCycle === 'monthly' ? 'text-[#0F3D3E]' : 'text-[#1E1E1E]/50'}`}>
              Monthly billing
            </span>
            <button
              onClick={() => setBillingCycle(billingCycle === 'monthly' ? 'annual' : 'monthly')}
              className="relative w-12 h-6.5 rounded-full bg-[#0F3D3E] p-1 transition-colors focus:outline-none"
            >
              <div 
                className={`w-4.5 h-4.5 rounded-full bg-[#5FB3A5] transition-transform duration-300 ${billingCycle === 'annual' ? 'translate-x-5.5' : 'translate-x-0'}`}
              />
            </button>
            <span className={`text-sm font-semibold flex items-center gap-1.5 transition-colors ${billingCycle === 'annual' ? 'text-[#0F3D3E]' : 'text-[#1E1E1E]/50'}`}>
              Annual billing 
              <span className="text-[10px] bg-[#5FB3A5]/20 text-[#0F3D3E] border border-[#5FB3A5]/30 font-bold px-2 py-0.5 rounded-full">
                2 months free
              </span>
            </span>
          </div>
        </div>

        {/* Pricing Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-stretch mb-20 lg:mb-28">
          {plans.map((p, i) => {
            const PlanIcon = p.icon;
            const price = billingCycle === 'monthly' ? p.monthlyPrice : p.annualPrice;
            const cycleText = billingCycle === 'monthly' ? '/month' : '/year';

            return (
              <div 
                key={p.id}
                className={`rounded-3xl border p-8 flex flex-col justify-between relative transition-all duration-300 hover:shadow-xl ${p.accent}`}
              >
                {/* Popular Ribbon */}
                {p.popular && (
                  <div className="absolute top-0 right-8 -translate-y-1/2 bg-[#5FB3A5] text-[#0F3D3E] text-[10px] font-extrabold uppercase tracking-widest px-3 py-1 rounded-full shadow-md">
                    Most Popular
                  </div>
                )}

                <div className="space-y-6">
                  {/* Plan Identifier */}
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl bg-[#0F3D3E]/5 text-[#0F3D3E]`}>
                      <PlanIcon className="h-6 w-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-[#1E1E1E]">{p.name}</h3>
                      <p className="text-xs text-[#1E1E1E]/50">Pehlix diagnostic OS</p>
                    </div>
                  </div>

                  <p className="text-sm text-[#1E1E1E]/70 min-h-[40px] leading-relaxed">
                    {p.desc}
                  </p>

                  {/* Pricing Display */}
                  <div className="border-y border-[#0F3D3E]/5 py-6">
                    <div className="flex items-baseline gap-1">
                      <span className="text-4xl font-extrabold text-[#1E1E1E]">₹{price.toLocaleString('en-IN')}</span>
                      <span className="text-sm font-medium text-[#1E1E1E]/50">{cycleText}</span>
                    </div>
                    {billingCycle === 'annual' && (
                      <p className="text-[10px] text-[#5FB3A5] font-bold mt-1.5 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Save ₹{(p.monthlyPrice * 2).toLocaleString('en-IN')} annually
                      </p>
                    )}
                  </div>

                  {/* Features Checklist */}
                  <ul className="space-y-3.5">
                    {p.features.map((f, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-[#5FB3A5] shrink-0 mt-0.5" />
                        <span className="text-sm text-[#1E1E1E]/80 font-medium leading-tight">{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Plan Button CTA */}
                <div className="mt-8 pt-6 border-t border-[#0F3D3E]/5">
                  {p.id === 'pro' ? (
                    <a 
                      href="mailto:sales@pehlix.in?subject=Pehlix%20Enterprise%20Plan%20Inquiry"
                      className="block w-full text-center bg-[#1E1E1E] hover:bg-[#1E1E1E]/90 text-white font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md"
                    >
                      {p.cta}
                    </a>
                  ) : (
                    <Link
                      href={`/login?signup=true&plan=${p.id}&cycle=${billingCycle}`}
                      className={`block w-full text-center font-bold text-sm py-3.5 rounded-xl transition-all duration-300 shadow-md ${
                        p.popular 
                          ? 'bg-[#0F3D3E] hover:bg-[#0F3D3E]/90 text-white' 
                          : 'bg-[#0F3D3E]/5 hover:bg-[#0F3D3E]/10 text-[#0F3D3E] shadow-none'
                      }`}
                    >
                      {p.cta}
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Feature Grid / Trial Banner */}
        <div className="bg-[#0F3D3E] text-white rounded-3xl p-8 sm:p-12 mb-20 lg:mb-28 text-center relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-[#5FB3A5]/5 rounded-full blur-[80px] pointer-events-none" />
          <div className="relative max-w-2xl mx-auto space-y-4">
            <span className="text-[#5FB3A5] text-xs font-bold uppercase tracking-widest">Risk-Free Tryout</span>
            <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Need assistance deciding?</h3>
            <p className="text-sm sm:text-base text-white/80 leading-relaxed font-normal">
              Sign up for a free 14-day trial on the Growth plan. Our customer success team will assist with data import (from your old software) and connect your WhatsApp number free of charge.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row justify-center items-center gap-4">
              <Link 
                href="/login?signup=true"
                className="bg-[#5FB3A5] hover:bg-[#5FB3A5]/95 text-[#0F3D3E] font-bold text-sm px-6 py-3 rounded-xl transition-all duration-300 w-full sm:w-auto"
              >
                Launch Free Trial
              </Link>
              <a 
                href="mailto:support@pehlix.in"
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-white/80 hover:text-white transition-colors"
              >
                Talk to support <Info className="h-4.5 w-4.5 text-[#5FB3A5]" />
              </a>
            </div>
          </div>
        </div>

        {/* FAQ Section */}
        <div className="max-w-4xl mx-auto">
          <div className="text-center space-y-3 mb-12 sm:mb-16">
            <HelpCircle className="h-8 w-8 text-[#5FB3A5] mx-auto" />
            <h3 className="text-2xl sm:text-3xl font-extrabold text-[#1E1E1E] tracking-tight">Frequently Asked Questions</h3>
            <p className="text-sm text-[#1E1E1E]/60">Got questions about Pehlix? We have answers.</p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => {
              const isOpen = openFaq === index;
              return (
                <div 
                  key={index}
                  className="bg-white border border-[#0F3D3E]/5 rounded-2xl overflow-hidden transition-all duration-300 shadow-sm"
                >
                  <button
                    onClick={() => toggleFaq(index)}
                    className="w-full flex items-center justify-between p-6 text-left focus:outline-none hover:bg-neutral-light transition-colors"
                  >
                    <span className="font-bold text-sm sm:text-base text-[#1E1E1E] tracking-tight pr-4">
                      {faq.q}
                    </span>
                    <span className="text-[#0F3D3E] shrink-0 p-1 bg-[#0F3D3E]/5 rounded-lg">
                      {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-6 pb-6 text-xs sm:text-sm text-[#1E1E1E]/70 border-t border-[#0F3D3E]/5 pt-4 animate-in fade-in slide-in-from-top-2 duration-300 leading-relaxed font-normal">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
