'use client';

import { ShieldCheck, Lock, Eye, Database } from 'lucide-react';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[#F5F7F7] min-h-screen py-16 sm:py-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Header Section */}
        <div className="text-center space-y-3 mb-12 sm:mb-16">
          <ShieldCheck className="h-10 w-10 text-[#5FB3A5] mx-auto" />
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#1E1E1E] tracking-tight">Privacy Policy</h1>
          <p className="text-sm text-[#1E1E1E]/60">Last Updated: May 28, 2026</p>
        </div>

        {/* Content Card */}
        <div className="bg-white border border-[#0F3D3E]/5 rounded-3xl p-8 sm:p-10 shadow-sm space-y-8 text-neutral-800 leading-relaxed font-normal text-sm sm:text-base">
          <div>
            <p>
              Pehchanly Digital Solutions ("we," "our," or "us") operates the Pehlix platform at <strong>pehlix.in</strong> and its subdomains. This Privacy Policy details how we collect, process, protect, and disclose information when diagnostic laboratories, healthcare professionals, patients, and administrators access our Software-as-a-Service (SaaS) diagnostic laboratory operating system.
            </p>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <Eye className="h-5 w-5 text-[#0F3D3E]" /> 1. Data Processor & Controller Separation
            </h2>
            <p>
              Under the Digital Personal Data Protection (DPDP) Act, 2023 (India):
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Data Controller:</strong> The registered laboratory using Pehlix to manage patients and print diagnostic reports is the Data Controller. The laboratory decides what clinical data is recorded and assumes primary responsibility for obtaining patient consent.
              </li>
              <li>
                <strong>Data Processor:</strong> Pehlix operates strictly as a Data Processor. We transmit and store personal and health data solely on behalf of the laboratory under their operational instructions.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <Database className="h-5 w-5 text-[#0F3D3E]" /> 2. Information We Collect & Process
            </h2>
            <p>
              We process information necessary to maintain lab accounts and deliver diagnostic communication services:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Laboratory Account Data:</strong> Lab names, addresses, GSTIN numbers, NABL registration numbers, billing details, and staff log credentials.
              </li>
              <li>
                <strong>Patient Records (entered by Labs):</strong> Names, age, gender, mobile numbers, email addresses, referring doctors, test selections, and diagnostic test outcome values.
              </li>
              <li>
                <strong>Doctor Information:</strong> Doctor names, registered phone numbers, emails, and commission ledger details.
              </li>
              <li>
                <strong>Usage & Device Logging:</strong> IP addresses, browser agents, and device fingerprints captured during login to enforce security.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <Lock className="h-5 w-5 text-[#0F3D3E]" /> 3. Data Protection & Localization
            </h2>
            <p>
              We prioritize medical data security through robust technological safeguards:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Data Encryption:</strong> All data is encrypted in transit using industry-standard SSL/TLS protocols and encrypted at rest using AES-256 database volumes.
              </li>
              <li>
                <strong>Data Localization:</strong> All server operations and database records are hosted strictly within the Indian borders, specifically inside the Mumbai region of MongoDB Atlas and Cloudflare R2 nodes.
              </li>
              <li>
                <strong>Secure R2 Links:</strong> Generated report PDFs stored in Cloudflare R2 are locked from public access. Patient report links sent via WhatsApp are signed URLs that expire automatically after 48 hours.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E] flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-[#0F3D3E]" /> 4. Data Sharing & Third-Party Services
            </h2>
            <p>
              We never sell or rent health data. Data is shared only with verified technical gateways under strict contracts:
            </p>
            <ul className="list-disc pl-6 space-y-2">
              <li>
                <strong>Meta Cloud API (WhatsApp):</strong> For delivering booking confirmations, payment links, and approved report URLs.
              </li>
              <li>
                <strong>Resend SMTP:</strong> For delivering verification codes and laboratory alerts to owners and admins.
              </li>
              <li>
                <strong>Razorpay:</strong> To process patient fees. Patient credentials are securely parsed to Razorpay to generate local payment links.
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h2 className="text-xl font-bold text-[#1E1E1E]">5. Your Rights & Contacts</h2>
            <p>
              Labs and patients can request records rectification or deletion. Since Pehlix processes patient data on behalf of labs, patients should contact their diagnostic laboratory directly. Laboratories can direct any data protection requests to our compliance officer at <a href="mailto:support@pehlix.in" className="text-[#0F3D3E] font-semibold hover:underline">support@pehlix.in</a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
