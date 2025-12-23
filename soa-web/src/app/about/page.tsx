import Link from 'next/link';
import { Header, Footer } from '@/components';
import {
  Target,
  Eye,
  Heart,
  Users,
  Award,
  Shield,
  Sparkles,
  GraduationCap,
  Scale,
  MapPin,
  Phone,
  Mail,
  Clock,
  ChevronRight,
  Quote,
  Calendar,
} from 'lucide-react';

// Core Values
const coreValues = [
  { 
    icon: Award, 
    title: 'Excellent Quality Service', 
    description: 'We deliver excellence in everything we do, ensuring every program and initiative meets the highest standards.' 
  },
  { 
    icon: Shield, 
    title: 'Ethical Conduct', 
    description: 'We maintain high moral codes and integrity in all our dealings with members and communities.' 
  },
  { 
    icon: Users, 
    title: 'Effective Leadership', 
    description: 'We lead with purpose, accountability, and a commitment to serving our people.' 
  },
  { 
    icon: Sparkles, 
    title: 'Dynamic Innovation', 
    description: 'We embrace creative solutions to address the challenges facing African communities.' 
  },
];

// Leadership Team
const leadershipTeam = [
  {
    name: 'President',
    role: 'Founder & National President',
    description: 'Leading the SOA movement with the vision to transform and liberate South Africans through skills development and social justice.',
    image: '/team/president.jpg',
  },
  {
    name: 'Vice President',
    role: 'National Vice President',
    description: 'Coordinating regional operations and ensuring the mission reaches every province.',
    image: '/team/vice-president.jpg',
  },
  {
    name: 'Secretary General',
    role: 'National Secretary',
    description: 'Managing organizational affairs and member communications.',
    image: '/team/secretary.jpg',
  },
];

// Timeline milestones
const milestones = [
  { year: '2020', title: 'Foundation', description: 'Soil of Africa established with vision to transform SA' },
  { year: '2022', title: 'Skills Chapter Launch', description: 'Established skills development programs' },
  { year: '2023', title: 'Youth Chapter Launch', description: 'Established dedicated chapter for young leaders' },
  { year: '2024', title: 'Mamelodi Skills Centre', description: 'Opened flagship training facility' },
  { year: '2025', title: 'National Expansion', description: 'Active presence in all 9 provinces' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-white">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-16 bg-gradient-to-br from-soa-primary via-soa-dark to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 rounded-full text-sm mb-6">
              <Heart className="w-4 h-4" />
              About Us
            </div>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              Vehicle of African Transformation
            </h1>
            <p className="text-xl text-gray-300 leading-relaxed">
              Soil of Africa is a civic movement formed to transform and liberate South Africans 
              through skills development, community empowerment, and social justice advocacy.
            </p>
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Mission */}
            <div className="bg-gradient-to-br from-soa-primary to-soa-secondary rounded-2xl p-8 text-white">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                <Target className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Our Mission</h3>
              <p className="text-white/90 leading-relaxed">
                To improve the living conditions of all residents of South Africa through 
                skills development, job creation, and advocacy for improved service delivery. 
                We aim to reduce youth unemployment from 62.7% to 40%.
              </p>
            </div>

            {/* Vision */}
            <div className="bg-gray-900 rounded-2xl p-8 text-white">
              <div className="w-14 h-14 bg-soa-primary/20 rounded-xl flex items-center justify-center mb-6">
                <Eye className="w-7 h-7 text-soa-secondary" />
              </div>
              <h3 className="text-2xl font-bold mb-4">Our Vision</h3>
              <p className="text-gray-300 leading-relaxed">
                A South Africa where every citizen has access to quality skills training, 
                meaningful employment, and dignified living conditions. We envision communities 
                that are self-sufficient, empowered, and thriving.
              </p>
            </div>

            {/* Tagline */}
            <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-8 text-white">
              <div className="w-14 h-14 bg-white/20 rounded-xl flex items-center justify-center mb-6">
                <Quote className="w-7 h-7" />
              </div>
              <h3 className="text-2xl font-bold mb-4">#SIZOSEBENZANGENKANI</h3>
              <p className="text-white/90 leading-relaxed">
                "We Will Work Together" - Our rallying cry that unites members across 
                all provinces. Together, we build a better South Africa for all.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Our Core Values
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              These principles guide everything we do at Soil of Africa
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((value, index) => (
              <div
                key={index}
                className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-lg transition"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-xl flex items-center justify-center mb-4">
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Our Chapters */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Our Three Pillars
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Three chapters driving transformation across South Africa
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Skills Development */}
            <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
                <GraduationCap className="w-20 h-20 text-white/80" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Skills Development Chapter</h3>
                <p className="text-sm text-soa-primary font-medium mb-3">Practical Training</p>
                <p className="text-gray-600 text-sm mb-4">
                  Empowering youth through practical training in entrepreneurship, 
                  agriculture, ICT, and poultry farming. 6-12 month programs leading to 
                  recognized qualifications.
                </p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>• Entrepreneurship & Business Skills</p>
                  <p>• Agriculture & Agro-processing</p>
                  <p>• Information Technology (ICT)</p>
                  <p>• Poultry & Livestock Management</p>
                </div>
                <Link
                  href="/chapters/skills"
                  className="mt-4 inline-flex items-center gap-1 text-soa-primary font-medium hover:underline"
                >
                  Learn More <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Youth Chapter */}
            <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                <Users className="w-20 h-20 text-white/80" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Youth Chapter</h3>
                <p className="text-sm text-blue-600 font-medium mb-3">The Future of SA</p>
                <p className="text-gray-600 text-sm mb-4">
                  Building the next generation of South African leaders through mentorship, 
                  community projects, and youth advocacy programs.
                </p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>• Leadership Development</p>
                  <p>• Community Service Projects</p>
                  <p>• Peer Mentorship Programs</p>
                  <p>• Youth Rights Advocacy</p>
                </div>
                <Link
                  href="/chapters/youth"
                  className="mt-4 inline-flex items-center gap-1 text-blue-600 font-medium hover:underline"
                >
                  Learn More <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Social Development */}
            <div className="relative bg-white rounded-2xl shadow-lg overflow-hidden">
              <div className="h-48 bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
                <Scale className="w-20 h-20 text-white/80" />
              </div>
              <div className="p-6">
                <h3 className="text-xl font-bold text-gray-900 mb-2">Social Development & Justice</h3>
                <p className="text-sm text-amber-600 font-medium mb-3">Voice of the Voiceless</p>
                <p className="text-gray-600 text-sm mb-4">
                  Advocating for improved service delivery, exposing municipal failures, 
                  and restoring dignity through people-driven development initiatives.
                </p>
                <div className="space-y-2 text-sm text-gray-700">
                  <p>• Service Delivery Advocacy</p>
                  <p>• Rights Awareness Education</p>
                  <p>• Community Mobilisation</p>
                  <p>• Social Justice Campaigns</p>
                </div>
                <Link
                  href="/chapters/social"
                  className="mt-4 inline-flex items-center gap-1 text-amber-600 font-medium hover:underline"
                >
                  Learn More <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 bg-soa-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Our Journey</h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Key milestones in the Soil of Africa movement
            </p>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-soa-secondary/30 hidden md:block" />

            <div className="space-y-8">
              {milestones.map((milestone, index) => (
                <div
                  key={index}
                  className={`relative flex items-center gap-8 ${
                    index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                  }`}
                >
                  <div className={`flex-1 ${index % 2 === 0 ? 'md:text-right' : 'md:text-left'}`}>
                    <div className="bg-white/10 rounded-xl p-6 backdrop-blur-sm">
                      <span className="text-soa-secondary font-bold text-2xl">{milestone.year}</span>
                      <h4 className="text-lg font-semibold mt-2">{milestone.title}</h4>
                      <p className="text-gray-400 text-sm mt-1">{milestone.description}</p>
                    </div>
                  </div>

                  {/* Center dot */}
                  <div className="hidden md:flex w-12 h-12 bg-soa-secondary rounded-full items-center justify-center shrink-0 z-10">
                    <Calendar className="w-5 h-5 text-soa-dark" />
                  </div>

                  <div className="flex-1 hidden md:block" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Contact Information */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">Get In Touch</h2>
              <p className="text-gray-600 mb-8">
                Ready to join the movement or have questions? Reach out to us through 
                any of the channels below. We're here to help you become part of African transformation.
              </p>

              <div className="space-y-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                    <MapPin className="w-6 h-6 text-soa-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Physical Address</h4>
                    <p className="text-gray-600">679 Tanya Street, Moreleta Park</p>
                    <p className="text-gray-600">Pretoria, 0044</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                    <Phone className="w-6 h-6 text-soa-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Phone Numbers</h4>
                    <p className="text-gray-600">+27 12 884-5118</p>
                    <p className="text-gray-600">+27 76 223-3981</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                    <Mail className="w-6 h-6 text-soa-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Email</h4>
                    <a href="mailto:info@soilofafrica.org" className="text-soa-primary hover:underline">
                      info@soilofafrica.org
                    </a>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                    <Clock className="w-6 h-6 text-soa-primary" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">Office Hours</h4>
                    <p className="text-gray-600">Monday - Friday: 8:00 AM - 5:00 PM</p>
                    <p className="text-gray-600">Saturday: 9:00 AM - 1:00 PM</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Map Placeholder */}
            <div className="bg-gray-100 rounded-2xl overflow-hidden h-[400px] flex items-center justify-center">
              <div className="text-center">
                <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500 font-medium">Location Map</p>
                <p className="text-gray-400 text-sm">679 Tanya St, Moreleta Park</p>
                <a
                  href="https://maps.google.com/?q=679+Tanya+Street,+Moreleta+Park,+Pretoria"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-soa-primary text-sm mt-3 hover:underline"
                >
                  Open in Google Maps <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 bg-gradient-to-r from-soa-primary to-soa-secondary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Join the Movement Today</h2>
          <p className="text-lg text-white/90 mb-8">
            Be part of African transformation. Register as a member and receive your 
            digital ID card instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-soa-primary rounded-xl font-semibold hover:bg-gray-100 transition"
            >
              Register Now
              <ChevronRight className="w-5 h-5" />
            </Link>
            <Link
              href="https://wa.me/27762233981"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/30 rounded-xl font-semibold hover:bg-white/20 transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp Us
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
