'use client';

import { RefreshCw, CreditCard, XCircle, HelpCircle } from 'lucide-react';

export default function RefundPolicyPage() {
  return (
    <div className="bg-[#F5F7F7] min-h-screen py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center space-y-3 mb-12 sm:mb-16">
          <RefreshCw className="h-10 w-10 text-[#5FB3A5] mx-auto" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E1E1E] tracking-tight">Refund & Cancellation Policy</h1>
          <p className="text-sm text-[#1E1E1E]/60">Last Updated: May 28, 2026</p>
        </div>

        {/* Content Card */}
        <div className="bg-white border border-[#0F3D3E]/5 rounded-3xl p-8 sm:p-10 shadow-sm space-y-8 text-neutral-800 leading-relaxed font-normal text-sm sm:text-base">
          <div>
            <p>
              Pehchanly Digital Solutions provides the Pehlix software platform on a Business-to-Business (B2B) subscription model. We want to ensure a clear and fair relationship with all laboratories using our software, which is why we enforce the following refund and cancellation guidelines.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#0F3D3E]" /> 1. 14-Day Risk-Free Trial Period
            </h2>
            <p>
              To ensure Pehlix fits your laboratory's workflow before you pay, we offer a **14-day free trial period** on our Starter and Growth plans:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>No Credit Card Required:</strong> You do not need to register a credit card or pay any upfront fees to try out the platform.
              </li>
              <li>
                <strong>Unrestricted Access:</strong> The trial includes complete, unrestricted access to the selected plan's features (excluding bulk WhatsApp direct broadcast lists to protect third-party patients from spam).
              </li>
              <li>
                <strong>Zero Obligation:</strong> If you decide not to lock in the subscription during the 14 days, your account will be paused at the end of the trial period with no charges.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <XCircle className="h-5 w-5 text-[#0F3D3E]" /> 2. Subscription Cancellations
            </h2>
            <p>
              You can cancel your subscription plan at any time:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Self-Service:</strong> Cancellations can be triggered directly from your laboratory's billing dashboard settings page.
              </li>
              <li>
                <strong>Effect of Cancellation:</strong> When you cancel your subscription, your account will remain fully active until the end of your current active billing cycle (monthly or annual).
              </li>
              <li>
                <strong>No Automatic Renewals:</strong> Once cancelled, you will not be billed for subsequent billing cycles.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-[#0F3D3E]" /> 3. Refund Policy
            </h2>
            <p>
              Since we are a B2B SaaS platform that provides a free 14-day trial period to evaluate the product, we enforce a strict refund policy:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Non-Refundable Subscription Fees:</strong> All monthly and annual subscription fees paid are non-refundable. We do not offer prorated refunds or credits for partially used billing cycles.
              </li>
              <li>
                <strong>Exception Cases (Technical Faults):</strong> If you were charged due to a platform billing system error (e.g., double-billing), please contact our billing desk within 7 working days of the transaction. Verified erroneous charges will be refunded in full to the original payment source within 5 to 7 bank working days.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E]">4. Support Desk</h2>
            <p>
              For any billing inquiries, payment disputes, or subscription cancellation assistance, please contact our billing support desk at <a href="mailto:support@pehlix.in" className="text-[#0F3D3E] font-semibold hover:underline">support@pehlix.in</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
