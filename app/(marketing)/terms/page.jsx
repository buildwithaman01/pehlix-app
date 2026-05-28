'use client';

import { Scale, FileText, AlertTriangle, ShieldCheck } from 'lucide-react';

export default function TermsOfServicePage() {
  return (
    <div className="bg-[#F5F7F7] min-h-screen py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center space-y-3 mb-12 sm:mb-16">
          <Scale className="h-10 w-10 text-[#5FB3A5] mx-auto" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E1E1E] tracking-tight">Terms of Service</h1>
          <p className="text-sm text-[#1E1E1E]/60">Last Updated: May 28, 2026</p>
        </div>

        {/* Content Card */}
        <div className="bg-white border border-[#0F3D3E]/5 rounded-3xl p-8 sm:p-10 shadow-sm space-y-8 text-neutral-800 leading-relaxed font-normal text-sm sm:text-base">
          <div>
            <p>
              Welcome to Pehlix. Please read these Terms of Service ("Terms") carefully. By registering for or using our diagnostic laboratory operating system platform, you agree to be bound by these Terms. If you are accepting on behalf of a diagnostic laboratory, you warrant that you have authority to bind that business entity.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-[#0F3D3E]" /> 1. Diagnostic Software & Clinical Disclaimers
            </h2>
            <p>
              Please understand the strict boundaries of our service:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Not a Medical Device:</strong> Pehlix is an administrative data-entry, reporting, and message transmission SaaS utility. It is NOT a medical device under the Medical Devices Rules, 2017 (India) or any other regulatory framework.
              </li>
              <li>
                <strong>No Clinical Decisions:</strong> Pehlix does not generate, interpret, or validate diagnostic findings. It merely stores and structures values inputted by your licensed clinical technicians and pathologists.
              </li>
              <li>
                <strong>Sole Medical Responsibility:</strong> All clinical responsibility for patient check-in, test accuracy, reference ranges, report approval, and digital signatures rests entirely with the registered laboratory and its licensed signing pathologists.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <FileText className="h-5 w-5 text-[#0F3D3E]" /> 2. Account Security & Use Policies
            </h2>
            <p>
              You agree to use our services responsibly:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Credentials Security:</strong> Laboratory owners are responsible for setting and protecting passwords for their staff members. You must notify us immediately of any unauthorized account access.
              </li>
              <li>
                <strong>Regulatory Compliance:</strong> You must possess all valid medical and business licenses (including state pollution control NOCs, NABL accreditations if claimed, and local registrations) to operate a diagnostic lab in your region.
              </li>
              <li>
                <strong>WhatsApp Messaging Policies:</strong> Outbound WhatsApp reports and notifications must comply with Meta's Business Policies. Using the messaging channel for spamming or non-diagnostics marketing will result in immediate account suspension.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#0F3D3E]" /> 3. Limitation of Liability & Indemnity
            </h2>
            <p>
              To the maximum extent permitted by applicable law:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>No Liability for Clinical Outcomes:</strong> In no event shall Pehchanly Digital Solutions or its founder be held liable for any clinical outcomes, misdiagnoses, patient disputes, or delayed medical interventions arising from technical issues, database downtime, or delayed/failed WhatsApp report deliveries.
              </li>
              <li>
                <strong>Indemnity:</strong> You agree to defend, indemnify, and hold harmless Pehchanly Digital Solutions from and against any claims, actions, or demands resulting from your laboratory's staff activities, pathologist signatures, or report dispatches.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E]">4. Subscription Billing</h2>
            <p>
              Subscription charges are billed in advance on a recurring monthly or annual basis depending on your plan. Pricing rates are listed on our pricing page and are subject to change with a 30-day notice period. 
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E]">5. Governing Law</h2>
            <p>
              These Terms are governed by and construed in accordance with the laws of India. Any disputes arising out of these Terms shall be subject to the exclusive jurisdiction of the courts located in Patna, Bihar, India.
            </p>
            <p>
              For legal inquiries or terms clarification, contact our compliance desk at <a href="mailto:contact@pehchanly.com" className="text-[#0F3D3E] font-semibold hover:underline">contact@pehchanly.com</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
