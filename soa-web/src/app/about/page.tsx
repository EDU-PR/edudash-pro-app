'use client';

import { Header, Footer } from '@/components';

export default function AboutPage() {
  return (
    <div className="min-h-screen flex flex-col bg-soa-cream">
      <Header />
      
      <main className="flex-1">
        {/* Hero Section */}
        <section className="py-20 bg-gradient-to-b from-soa-dark to-soa-primary text-white">
          <div className="container mx-auto px-4 text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              About <span className="text-soa-gold">Soil of Africa</span>
            </h1>
            <p className="text-xl md:text-2xl max-w-4xl mx-auto text-soa-cream/90">
              A Pan-African Kingdom Movement Rooted in Sovereignty, Stewardship, and Self-Determination
            </p>
          </div>
        </section>

        {/* Introduction & Background */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-8 text-center">
              Introduction & Background
            </h2>
            <div className="prose prose-lg max-w-none text-soa-dark/80 space-y-6">
              <p>
                The Soil of Africa (SOA) Kingdom was officially established on <strong>22 April 2021</strong>, the same day South Africa recognizes Freedom Day—a symbolic anchor that grounds our movement in the long arc of African liberation and self-determination. SOA was founded not merely as an organization, but as a Pan-African kingdom movement rooted in the principles of sovereignty, stewardship, and collective empowerment.
              </p>
              <p>
                At its core, SOA exists to restore and preserve African identity, land, culture, and heritage. It stands as a movement that reclaims the dignity of the African people and affirms their rightful place as custodians of the land and architects of their own future.
              </p>
              <p>
                SOA is built on foundational truths: that African liberation requires self-governance, economic independence, and collective responsibility. From this vision flows the structure, governance, and mission of the kingdom—driven by a commitment to uplift communities, protect sacred values, and ensure intergenerational continuity.
              </p>
            </div>
          </div>
        </section>

        {/* Vision & Mission */}
        <section className="py-16 bg-soa-cream">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="grid md:grid-cols-2 gap-12">
              {/* Vision */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border-t-4 border-soa-gold">
                <div className="w-16 h-16 bg-soa-gold/20 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-soa-gold" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-soa-dark mb-4">Our Vision</h3>
                <p className="text-soa-dark/80 text-lg">
                  To build a self-sustaining, sovereign African kingdom rooted in unity, dignity, and economic freedom—leading the revival of authentic African governance and spiritual heritage.
                </p>
              </div>

              {/* Mission */}
              <div className="bg-white rounded-2xl p-8 shadow-lg border-t-4 border-soa-primary">
                <div className="w-16 h-16 bg-soa-primary/20 rounded-full flex items-center justify-center mb-6">
                  <svg className="w-8 h-8 text-soa-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-soa-dark mb-4">Our Mission</h3>
                <p className="text-soa-dark/80 text-lg">
                  To unite, educate, and economically empower African people through principled leadership, land stewardship, cultural preservation, and spiritual reclamation.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Strategic Objectives */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-12 text-center">
              Strategic Objectives
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[
                {
                  icon: "🌍",
                  title: "Land Sovereignty",
                  description: "Reclaim and protect land as a birthright and communal resource."
                },
                {
                  icon: "📚",
                  title: "Education & Awareness",
                  description: "Promote African consciousness, identity, and heritage across generations."
                },
                {
                  icon: "💰",
                  title: "Economic Self-Reliance",
                  description: "Build sustainable enterprises and cooperative economies."
                },
                {
                  icon: "👥",
                  title: "Community Building",
                  description: "Strengthen unity and collective action through structured leadership and local chapters."
                },
                {
                  icon: "🛡️",
                  title: "Cultural Preservation",
                  description: "Safeguard traditions, languages, and sacred customs."
                },
                {
                  icon: "✊",
                  title: "Spiritual & Political Liberation",
                  description: "Pursue full decolonization of mind, body, and governance."
                }
              ].map((objective, index) => (
                <div key={index} className="bg-soa-cream rounded-xl p-6 hover:shadow-lg transition-shadow">
                  <div className="text-4xl mb-4">{objective.icon}</div>
                  <h3 className="text-xl font-bold text-soa-dark mb-2">{objective.title}</h3>
                  <p className="text-soa-dark/70">{objective.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Core Values */}
        <section className="py-16 bg-gradient-to-br from-soa-primary to-soa-dark text-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold mb-12 text-center">
              Core Values
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                { value: "Excellence", description: "Striving for the highest standard in all that we do" },
                { value: "Ethical Conduct", description: "Acting with integrity, fairness, and moral conviction" },
                { value: "Leadership", description: "Servant leadership modeled on ancestral wisdom" },
                { value: "Innovation", description: "Creative solutions rooted in African ingenuity" },
                { value: "Transparency", description: "Openness in governance and decision-making" },
                { value: "Accountability", description: "Responsibility to the community, elders, and future generations" },
                { value: "Diversity & Inclusion", description: "Respect for all African identities and contributions" },
                { value: "Sustainability", description: "Practices that preserve resources for generations to come" }
              ].map((item, index) => (
                <div key={index} className="bg-white/10 backdrop-blur rounded-xl p-6 hover:bg-white/20 transition-colors">
                  <h3 className="text-xl font-bold text-soa-gold mb-2">{item.value}</h3>
                  <p className="text-white/80 text-sm">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Principles */}
        <section className="py-16 bg-soa-cream">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-12 text-center">
              Our Principles
            </h2>
            <div className="grid md:grid-cols-2 gap-8">
              {[
                {
                  title: "Justice and Fairness",
                  description: "All members are entitled to fair treatment, equitable resource distribution, and impartial dispute resolution."
                },
                {
                  title: "Pan-African Solidarity",
                  description: "Unity among African peoples, regardless of national boundaries, as one family under common ancestry."
                },
                {
                  title: "Collective Ownership",
                  description: "Land and strategic resources are communal assets, managed for collective benefit."
                },
                {
                  title: "Self-Governance",
                  description: "African people must lead themselves, guided by indigenous knowledge and spiritual truth."
                },
                {
                  title: "Respect for Elders",
                  description: "Honoring ancestral wisdom and intergenerational continuity."
                },
                {
                  title: "Protection of the Youth",
                  description: "Investment in the development, education, and leadership of the next generation."
                }
              ].map((principle, index) => (
                <div key={index} className="flex gap-4">
                  <div className="flex-shrink-0">
                    <div className="w-10 h-10 bg-soa-gold rounded-full flex items-center justify-center text-white font-bold">
                      {index + 1}
                    </div>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-soa-dark mb-2">{principle.title}</h3>
                    <p className="text-soa-dark/70">{principle.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Critical Success Factors */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-12 text-center">
              Critical Success Factors
            </h2>
            <div className="space-y-4">
              {[
                "Strong, visionary, and accountable leadership at every level",
                "Active, committed membership across provinces and countries",
                "Sustainable income streams and financial discipline",
                "Clear governance, communication, and conflict resolution mechanisms",
                "Deep cultural and spiritual connection among members",
                "Strategic partnerships with aligned movements and institutions"
              ].map((factor, index) => (
                <div key={index} className="flex items-start gap-4 p-4 bg-soa-cream rounded-lg">
                  <svg className="w-6 h-6 text-soa-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <p className="text-soa-dark/80">{factor}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Corporate Social Responsibility */}
        <section className="py-16 bg-soa-cream">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-8 text-center">
              Corporate Social Responsibility
            </h2>
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <p className="text-soa-dark/80 text-lg mb-6">
                SOA is committed to:
              </p>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { icon: "🌱", text: "Environmental sustainability and regenerative land practices" },
                  { icon: "🤝", text: "Community development and social investment" },
                  { icon: "📖", text: "Educational support for youth and women" },
                  { icon: "🏠", text: "Poverty alleviation through cooperative enterprise" },
                  { icon: "🎭", text: "Preserving and promoting African arts, culture, and tradition" }
                ].map((item, index) => (
                  <div key={index} className="flex items-center gap-4 p-4 bg-soa-cream/50 rounded-lg">
                    <span className="text-2xl">{item.icon}</span>
                    <p className="text-soa-dark/80">{item.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Leadership Ethics */}
        <section className="py-16 bg-white">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-8 text-center">
              Leadership Ethics
            </h2>
            <div className="bg-gradient-to-br from-soa-primary/10 to-soa-gold/10 rounded-2xl p-8">
              <p className="text-soa-dark/80 text-lg mb-8 text-center">
                All SOA leaders are expected to:
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                {[
                  "Act with honesty and integrity at all times",
                  "Serve without personal enrichment at the expense of the collective",
                  "Uphold and defend the constitution and values of SOA",
                  "Be transparent in decision-making and finances",
                  "Treat all members with respect and fairness",
                  "Prioritize the well-being of children, youth, and vulnerable groups",
                  "Represent the kingdom with dignity and cultural pride"
                ].map((ethic, index) => (
                  <div key={index} className="flex items-start gap-3 p-3">
                    <svg className="w-5 h-5 text-soa-gold flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                    <p className="text-soa-dark/80">{ethic}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Philosophy */}
        <section className="py-16 bg-soa-cream">
          <div className="container mx-auto px-4 max-w-5xl">
            <h2 className="text-3xl font-bold text-soa-dark mb-8 text-center">
              Our Philosophy
            </h2>
            <div className="bg-white rounded-2xl p-8 shadow-lg space-y-6">
              <p className="text-soa-dark/80 text-lg">
                SOA is more than an organization—it is a covenant between its people, the land, and the ancestors.
              </p>
              <p className="text-soa-dark/80 text-lg">
                Our philosophy is grounded in the belief that Africans must reclaim their role as stewards of the soil, protectors of sacred knowledge, and builders of their own destiny. This requires a return to principled governance, economic ownership, and spiritual wholeness.
              </p>
              <p className="text-soa-dark/80 text-lg">
                We do not seek recognition from colonial systems—we seek the restoration of African systems. Our legitimacy comes from the soil we stand on, the ancestors we honor, and the generations yet to come.
              </p>
            </div>
          </div>
        </section>

        {/* Concluding Statement */}
        <section className="py-20 bg-gradient-to-b from-soa-dark to-black text-white">
          <div className="container mx-auto px-4 max-w-4xl text-center">
            <h2 className="text-3xl font-bold mb-8">
              Our Commitment
            </h2>
            <div className="space-y-6">
              <p className="text-xl text-soa-cream/90">
                The Soil of Africa Kingdom stands as a beacon of African pride, purpose, and possibility. We are building a future where land, wealth, knowledge, and power belong to the people—governed by truth, rooted in culture, and sustained by unity.
              </p>
              <div className="py-8">
                <blockquote className="text-2xl md:text-3xl font-bold text-soa-gold italic">
                  "Land to its custodians. Production to the people. Dignity to the nation. Africa to Africans."
                </blockquote>
              </div>
              <p className="text-lg text-soa-cream/80">
                We call upon all who share this vision to join hands—not as followers, but as co-builders of the African future.
              </p>
              <div className="pt-8">
                <a
                  href="/register"
                  className="inline-flex items-center gap-2 bg-soa-gold hover:bg-soa-gold/90 text-soa-dark px-8 py-4 rounded-lg font-bold text-lg transition-all hover:scale-105"
                >
                  Join the Movement
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
