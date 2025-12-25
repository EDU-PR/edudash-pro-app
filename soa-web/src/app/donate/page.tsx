'use client';

import { Header, Footer } from '@/components';
import { Heart, Users, Building2, Briefcase, Gift, CreditCard, Smartphone, Mail, Phone } from 'lucide-react';
import Link from 'next/link';

const donationOptions = [
  { amount: 'R50', label: 'Supporter', description: 'Help provide resources for 1 youth' },
  { amount: 'R100', label: 'Contributor', description: 'Fund a skills workshop session' },
  { amount: 'R250', label: 'Champion', description: 'Support a community project' },
  { amount: 'R500', label: 'Patron', description: 'Sponsor a youth training program' },
  { amount: 'R1000', label: 'Benefactor', description: 'Fund a full skills development course' },
  { amount: 'Custom', label: 'Your Choice', description: 'Any amount makes a difference' },
];

const supportWays = [
  {
    icon: Users,
    title: 'Individual Donations',
    description: 'Make a one-time or recurring donation to support our programs and initiatives.',
  },
  {
    icon: Building2,
    title: 'Corporate Sponsorship',
    description: 'Partner with SOA as a corporate sponsor and invest in community development.',
  },
  {
    icon: Briefcase,
    title: 'Patronage Programs',
    description: 'Become a patron and provide ongoing support for youth empowerment.',
  },
  {
    icon: Gift,
    title: 'In-Kind Contributions',
    description: 'Donate equipment, materials, or services to support our chapters.',
  },
];

export default function DonatePage() {
  return (
    <div className="min-h-screen flex flex-col bg-soa-cream">
      <Header />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-soa-dark to-soa-primary text-white">
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full text-white text-sm font-medium mb-6">
              <Heart className="w-4 h-4" />
              Support the Movement
            </div>
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Make a <span className="text-soa-gold">Donation</span>
            </h1>
            <p className="text-xl max-w-3xl mx-auto text-white/90">
              Your contribution helps fund skills development, community programs, and youth empowerment across South Africa.
            </p>
          </div>
        </section>

        {/* Donation Options */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-soa-dark mb-4">Choose Your Impact</h2>
              <p className="text-soa-dark/70">Every contribution, big or small, makes a difference</p>
            </div>

            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
              {donationOptions.map((option, index) => (
                <button
                  key={index}
                  className="p-6 bg-soa-cream rounded-2xl border-2 border-transparent hover:border-soa-gold transition-all hover:shadow-lg text-left group"
                >
                  <div className="text-3xl font-bold text-soa-gold mb-1">{option.amount}</div>
                  <div className="font-semibold text-soa-dark mb-2">{option.label}</div>
                  <p className="text-sm text-soa-dark/70">{option.description}</p>
                </button>
              ))}
            </div>

            {/* Payment Methods */}
            <div className="bg-gradient-to-br from-soa-primary to-soa-dark rounded-2xl p-8 text-white">
              <h3 className="text-2xl font-bold mb-6 text-center">How to Donate</h3>
              
              <div className="grid md:grid-cols-2 gap-8">
                {/* Bank Transfer */}
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-semibold">Bank Transfer (EFT)</h4>
                  </div>
                  <div className="space-y-2 text-sm text-white/90">
                    <p><span className="text-white/60">Bank:</span> Standard Bank / FNB / Capitec</p>
                    <p><span className="text-white/60">Account Name:</span> Soil of Africa</p>
                    <p><span className="text-white/60">Account No:</span> Contact us for details</p>
                    <p><span className="text-white/60">Reference:</span> Your Name + "Donation"</p>
                  </div>
                </div>

                {/* Mobile Payment */}
                <div className="bg-white/10 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                      <Smartphone className="w-6 h-6" />
                    </div>
                    <h4 className="text-lg font-semibold">Mobile & Digital</h4>
                  </div>
                  <div className="space-y-3 text-sm">
                    <a 
                      href="https://wa.me/27762233981?text=Hi%2C%20I%20would%20like%20to%20make%20a%20donation%20to%20Soil%20of%20Africa"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-white/90 hover:text-white transition"
                    >
                      <span className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </span>
                      WhatsApp: +27 76 223 3981
                    </a>
                    <p className="text-white/70">Contact us via WhatsApp for payment links, SnapScan, or other digital payment options.</p>
                  </div>
                </div>
              </div>

              <div className="mt-8 text-center">
                <p className="text-white/80 text-sm mb-4">
                  For large donations or corporate sponsorships, please contact us directly
                </p>
                <div className="flex flex-wrap justify-center gap-4">
                  <a
                    href="mailto:donations@soilofafrica.org"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white text-soa-dark rounded-xl font-medium hover:bg-gray-100 transition"
                  >
                    <Mail className="w-5 h-5" />
                    donations@soilofafrica.org
                  </a>
                  <a
                    href="tel:+27762233981"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/20 text-white border border-white/30 rounded-xl font-medium hover:bg-white/30 transition"
                  >
                    <Phone className="w-5 h-5" />
                    +27 76 223 3981
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Ways to Support */}
        <section className="py-16 bg-soa-cream">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-soa-dark mb-4">Ways to Support</h2>
              <p className="text-soa-dark/70">There are many ways to contribute to the movement</p>
            </div>

            <div className="grid sm:grid-cols-2 gap-6">
              {supportWays.map((way, index) => (
                <div key={index} className="bg-white rounded-2xl p-6 shadow-sm hover:shadow-lg transition">
                  <div className="w-14 h-14 bg-soa-gold/20 rounded-xl flex items-center justify-center mb-4">
                    <way.icon className="w-7 h-7 text-soa-gold" />
                  </div>
                  <h3 className="text-xl font-bold text-soa-dark mb-2">{way.title}</h3>
                  <p className="text-soa-dark/70">{way.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Impact Section */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-3xl font-bold text-soa-dark mb-8">Your Impact</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              <div>
                <div className="text-4xl font-bold text-soa-gold mb-2">3,324+</div>
                <p className="text-soa-dark/70">Members Empowered</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-soa-gold mb-2">9</div>
                <p className="text-soa-dark/70">Provinces Reached</p>
              </div>
              <div>
                <div className="text-4xl font-bold text-soa-gold mb-2">100+</div>
                <p className="text-soa-dark/70">Skills Programs</p>
              </div>
            </div>
            <p className="mt-8 text-soa-dark/70 max-w-2xl mx-auto">
              Your donations directly fund youth skills development, community empowerment programs, 
              and advocacy initiatives across South Africa.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="py-16 bg-gradient-to-r from-soa-gold to-amber-500 text-white">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold mb-4">Not Ready to Donate?</h2>
            <p className="text-white/90 mb-8 max-w-2xl mx-auto">
              You can still support by becoming a member, volunteering your time, or spreading the word about Soil of Africa.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Link
                href="/register"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white text-soa-dark rounded-xl font-semibold hover:bg-gray-100 transition"
              >
                Become a Member
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center gap-2 px-8 py-4 bg-white/20 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/30 transition"
              >
                Volunteer With Us
              </Link>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
