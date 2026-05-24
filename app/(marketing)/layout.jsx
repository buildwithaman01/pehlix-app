'use client';

import Link from 'next/link';
import { Activity, Menu, X } from 'lucide-react';
import { useState } from 'react';
import PehlixLogo from '@/components/shared/PehlixLogo';

export default function MarketingLayout({ children }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col font-satoshi bg-[#F5F7F7] text-[#1E1E1E]">
      {/* Sticky Header with Glassmorphism */}
      <header className="sticky top-0 z-50 backdrop-blur-md bg-white/80 border-b border-[#0F3D3E]/10 transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            {/* Logo */}
            <div className="flex items-center gap-3">
              <Link href="/" className="flex items-center gap-2.5 group">
                <PehlixLogo variant="icon" className="w-10 h-10 shadow-md group-hover:scale-105 transition-transform duration-300 shrink-0" />
                <PehlixLogo variant="wordmark" className="h-6.5 w-auto" light={false} />
              </Link>
            </div>

            {/* Desktop Nav links */}
            <nav className="hidden md:flex items-center gap-8">
              <Link href="/#features" className="text-sm font-medium text-[#1E1E1E]/75 hover:text-[#0F3D3E] hover:font-semibold transition-all">
                Features
              </Link>
              <Link href="/pricing" className="text-sm font-medium text-[#1E1E1E]/75 hover:text-[#0F3D3E] hover:font-semibold transition-all">
                Pricing
              </Link>
              <Link href="/about" className="text-sm font-medium text-[#1E1E1E]/75 hover:text-[#0F3D3E] hover:font-semibold transition-all">
                About
              </Link>
            </nav>

            {/* Action CTAs */}
            <div className="hidden md:flex items-center gap-4">
              <Link href="/login" className="text-sm font-medium text-[#0F3D3E] hover:text-[#0F3D3E]/80 px-4 py-2 rounded-xl transition-all">
                Sign In
              </Link>
              <Link
                href="/login?signup=true"
                className="bg-[#0F3D3E] text-white text-sm font-semibold px-5 py-2.5 rounded-xl hover:bg-[#0F3D3E]/90 hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 shadow-md shadow-[#0F3D3E]/10"
              >
                Start Free Trial
              </Link>
            </div>

            {/* Mobile Menu Button */}
            <div className="md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="p-2 rounded-xl text-[#0F3D3E] hover:bg-[#0F3D3E]/5 transition-colors focus:outline-none"
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu Overlay */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-white border-b border-[#0F3D3E]/10 animate-in slide-in-from-top duration-300">
            <div className="px-4 pt-2 pb-6 space-y-4 shadow-xl">
              <Link
                href="/#features"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-medium text-[#1E1E1E] hover:text-[#0F3D3E] py-2"
              >
                Features
              </Link>
              <Link
                href="/pricing"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-medium text-[#1E1E1E] hover:text-[#0F3D3E] py-2"
              >
                Pricing
              </Link>
              <Link
                href="/about"
                onClick={() => setMobileMenuOpen(false)}
                className="block text-base font-medium text-[#1E1E1E] hover:text-[#0F3D3E] py-2"
              >
                About
              </Link>
              <div className="border-t border-[#1E1E1E]/5 pt-4 flex flex-col gap-3">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center font-medium text-[#0F3D3E] py-2.5 rounded-xl hover:bg-[#0F3D3E]/5 transition-all"
                >
                  Sign In
                </Link>
                <Link
                  href="/login?signup=true"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center bg-[#0F3D3E] text-white font-semibold py-3 rounded-xl hover:bg-[#0F3D3E]/90 transition-all shadow-md shadow-[#0F3D3E]/10"
                >
                  Start Free Trial
                </Link>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer Section */}
      <footer className="bg-[#0F3D3E] text-white border-t border-white/5 py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 md:gap-12">
            {/* Brand column */}
            <div className="space-y-4 md:col-span-2">
              <div className="flex items-center gap-2.5">
                <PehlixLogo variant="icon" className="w-9 h-9 shadow-md shrink-0" />
                <PehlixLogo variant="wordmark" className="h-5.5 w-auto" light={true} />
              </div>
              <p className="text-sm text-white/70 max-w-sm">
                The modern diagnostic lab OS built from scratch for Tier 2 and Tier 3 Indian labs. Streamlining payments, registrations, doctor payouts, and patient communication.
              </p>
            </div>

            {/* Quick Links */}
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-[#5FB3A5] uppercase mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <Link href="/#features" className="text-sm text-white/70 hover:text-white transition-colors">Features</Link>
                </li>
                <li>
                  <Link href="/pricing" className="text-sm text-white/70 hover:text-white transition-colors">Pricing</Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-white/70 hover:text-white transition-colors">Lab Login</Link>
                </li>
              </ul>
            </div>

            {/* Support and Legal */}
            <div>
              <h3 className="text-sm font-semibold tracking-wider text-[#5FB3A5] uppercase mb-4">Contact & Support</h3>
              <ul className="space-y-2">
                <li className="text-sm text-white/70">
                  Email: <a href="mailto:support@pehlix.in" className="hover:text-white transition-colors">support@pehlix.in</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">Privacy Policy</a>
                </li>
                <li>
                  <a href="#" className="text-sm text-white/70 hover:text-white transition-colors">Terms of Service</a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-white/10 mt-12 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-white/50">
              &copy; {new Date().getFullYear()} Pehlix. All rights reserved.
            </p>
            <p className="text-xs text-white/50">
              Made for diagnostic labs in India. pehlix.in
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
