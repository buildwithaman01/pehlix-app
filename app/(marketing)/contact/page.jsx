'use client';

import { useState } from 'react';
import { Mail, Phone, MapPin, Clock, MessageSquare, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.message) {
      toast.error('Please fill in all required fields');
      return;
    }
    setLoading(true);
    setTimeout(() => {
      toast.success('Your message has been received! Our support team will contact you shortly.');
      setForm({ name: '', email: '', subject: '', message: '' });
      setLoading(false);
    }, 800);
  }

  const f = (k) => (v) => setForm((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="bg-[#F5F7F7] min-h-screen py-16 sm:py-24">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header Hero */}
        <div className="text-center max-w-3xl mx-auto space-y-4 mb-16 sm:mb-20">
          <h1 className="text-[#0F3D3E] text-xs font-bold uppercase tracking-widest">Get In Touch</h1>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-[#1E1E1E] tracking-tight">
            We are here to support your diagnostic journey
          </h2>
          <p className="text-base sm:text-lg text-[#1E1E1E]/70 font-normal leading-relaxed">
            Have questions about billing, integrations, or setting up your lab catalog? Connect with our dedicated support team today.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 sm:gap-12">
          {/* Contact Details (Left side) */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-[#0F3D3E] text-white rounded-3xl p-8 relative overflow-hidden shadow-xl border border-white/5">
              <div className="absolute -bottom-10 -right-10 w-48 h-48 bg-[#5FB3A5]/10 rounded-full blur-3xl pointer-events-none" />
              <h3 className="text-xl font-bold mb-6 text-[#5FB3A5]">Contact Information</h3>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-white/10 rounded-xl text-[#5FB3A5] shrink-0 mt-0.5">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Office Address</p>
                    <p className="text-sm font-semibold leading-relaxed mt-1 text-white/90">
                      Pehchanly Digital Solutions<br />
                      Ground Floor, 12 Exhibition Road,<br />
                      Patna, Bihar, 800001, India
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-white/10 rounded-xl text-[#5FB3A5] shrink-0 mt-0.5">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Email Address</p>
                    <p className="text-sm font-semibold leading-relaxed mt-1 text-white/90">
                      <a href="mailto:support@pehlix.in" className="hover:text-[#5FB3A5] transition-colors">support@pehlix.in</a>
                      <span className="block text-[10px] text-white/40 mt-0.5">For queries: hello@pehlix.in</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-white/10 rounded-xl text-[#5FB3A5] shrink-0 mt-0.5">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Contact Number</p>
                    <p className="text-sm font-semibold leading-relaxed mt-1 text-white/90">
                      <a href="tel:+919900000000" className="hover:text-[#5FB3A5] transition-colors">+91 99000 00000</a>
                      <span className="block text-[10px] text-white/40 mt-0.5">Monday to Saturday, 9 AM - 6 PM</span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="p-2.5 bg-white/10 rounded-xl text-[#5FB3A5] shrink-0 mt-0.5">
                    <Clock className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Working Hours</p>
                    <p className="text-sm font-semibold leading-relaxed mt-1 text-white/90">
                      9:00 AM - 6:00 PM IST
                      <span className="block text-[10px] text-white/40 mt-0.5">Closed on Sundays & national holidays</span>
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-[#0F3D3E]/5 rounded-3xl p-8 shadow-sm">
              <h4 className="font-bold text-base sm:text-lg text-[#1E1E1E] mb-2 flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-[#0F3D3E]" /> Chat Support
              </h4>
              <p className="text-[#1E1E1E]/70 text-xs sm:text-sm leading-relaxed">
                Registered lab owners and doctors can launch direct live chat assistance inside the dashboard portal panels 24/7.
              </p>
            </div>
          </div>

          {/* Contact Form (Right side) */}
          <div className="lg:col-span-2">
            <div className="bg-white border border-[#0F3D3E]/5 rounded-3xl p-8 sm:p-10 shadow-sm">
              <h3 className="text-xl font-bold text-[#1E1E1E] mb-2">Send us a Message</h3>
              <p className="text-sm text-neutral-500 mb-8">
                Fill out the form below, and we will get back to you within 24 hours.
              </p>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">Full Name <span className="text-red-500">*</span></Label>
                    <Input
                      id="name"
                      type="text"
                      value={form.name}
                      onChange={(e) => f('name')(e.target.value)}
                      placeholder="Your Name"
                      className="rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                    <Input
                      id="email"
                      type="email"
                      value={form.email}
                      onChange={(e) => f('email')(e.target.value)}
                      placeholder="name@domain.com"
                      className="rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="subject">Subject</Label>
                  <Input
                    id="subject"
                    type="text"
                    value={form.subject}
                    onChange={(e) => f('subject')(e.target.value)}
                    placeholder="How can we assist you?"
                    className="rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="message">Message <span className="text-red-500">*</span></Label>
                  <Textarea
                    id="message"
                    rows={5}
                    value={form.message}
                    onChange={(e) => f('message')(e.target.value)}
                    placeholder="Describe your inquiry in detail..."
                    className="rounded-xl border-neutral-200 focus:border-[#0F3D3E] focus:ring-[#0F3D3E]/20"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white font-semibold transition-all px-6 py-2.5 h-auto flex items-center gap-2"
                >
                  {loading ? 'Sending...' : 'Send Message'} <Send className="h-4 w-4" />
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
