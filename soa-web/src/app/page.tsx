'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Header, Footer, MerchandiseSlider, FadeIn, ScaleIn, StaggerChildren, StaggerItem, SlideIn, CountUp, FloatingElement } from '@/components';
import {
  Users,
  MapPin,
  Award,
  ChevronRight,
  Smartphone,
  Download,
  CheckCircle2,
  ArrowRight,
  Star,
  Shield,
  Sparkles,
  Play,
  Heart,
  GraduationCap,
  Scale,
  Megaphone,
  Youtube,
  Instagram,
  Facebook,
} from 'lucide-react';

// South African Regions
const regions = [
  { code: 'GP', name: 'Gauteng', members: 847, city: 'Pretoria, Johannesburg' },
  { code: 'WC', name: 'Western Cape', members: 523, city: 'Cape Town' },
  { code: 'KZN', name: 'KwaZulu-Natal', members: 412, city: 'Durban' },
  { code: 'EC', name: 'Eastern Cape', members: 389, city: 'Port Elizabeth' },
  { code: 'LP', name: 'Limpopo', members: 298, city: 'Polokwane' },
  { code: 'MP', name: 'Mpumalanga', members: 267, city: 'Nelspruit' },
  { code: 'NW', name: 'North West', members: 234, city: 'Rustenburg' },
  { code: 'FS', name: 'Free State', members: 198, city: 'Bloemfontein' },
  { code: 'NC', name: 'Northern Cape', members: 156, city: 'Kimberley' },
];

// SOA Chapters
const chapters = [
  {
    id: 'womens',
    name: 'Women\'s Chapter',
    tagline: 'Empowering African Women',
    description: 'Supporting and uplifting women through skills development, entrepreneurship, and leadership programs.',
    icon: GraduationCap,
    color: 'from-soa-khaki to-soa-primary',
    programs: ['Women Entrepreneurship', 'Financial Literacy', 'Leadership Development', 'Health & Wellness'],
  },
  {
    id: 'youth',
    name: 'Youth Chapter',
    tagline: 'The Future of South Africa',
    description: 'Young leaders driving change in their communities. Building the next generation of South African changemakers.',
    icon: Users,
    color: 'from-blue-500 to-indigo-600',
    programs: ['Leadership Development', 'Community Projects', 'Mentorship', 'Youth Advocacy'],
  },
  {
    id: 'disability',
    name: 'Disability Chapter',
    tagline: 'Inclusion & Accessibility for All',
    description: 'Advocating for the rights and inclusion of persons with disabilities, ensuring equal opportunities and accessibility.',
    icon: Scale,
    color: 'from-amber-500 to-orange-600',
    programs: ['Disability Rights Advocacy', 'Skills & Employment', 'Accessibility Programs', 'Support Networks'],
  },
];

// Core Values
const coreValues = [
  { icon: Award, title: 'Excellent Quality Service', description: 'Delivering excellence in everything we do' },
  { icon: Shield, title: 'Ethical Conduct', description: 'Maintaining high moral codes' },
  { icon: Users, title: 'Effective Leadership', description: 'Leading with purpose and integrity' },
  { icon: Sparkles, title: 'Dynamic Innovation', description: 'Creative solutions for African challenges' },
];

export default function AnimatedHomePage() {
  const totalMembers = regions.reduce((sum, r) => sum + r.members, 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50/50 to-stone-100" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-20 left-10 w-72 h-72 bg-soa-secondary/30 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-40 right-1/3 w-48 h-48 bg-soa-primary/15 rounded-full blur-2xl animate-pulse" style={{ animationDelay: '2s' }} />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              <FadeIn delay={0.1} direction="down">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-soa-primary/10 rounded-full text-soa-primary text-sm font-medium mb-6">
                  <Megaphone className="w-4 h-4" />
                  #SIZOSEBENZANGENKANI - We Will Work Together
                </div>
              </FadeIn>

              <FadeIn delay={0.2}>
                <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                  Formed to{' '}
                  <span className="gradient-text">Transform & Liberate</span>{' '}
                  South Africans
                </h1>
              </FadeIn>

              <FadeIn delay={0.3}>
                <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                  SOA's objective is to improve the living conditions of all residents of South Africa.
                  We are the vehicle of African transformation, empowering communities through skills
                  development, social justice, and youth leadership.
                </p>
              </FadeIn>

              <FadeIn delay={0.4}>
                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                  <Link
                    href="/register"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold text-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/30 hover:scale-105"
                  >
                    Join the Movement
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/media"
                    className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-xl font-semibold text-lg hover:border-soa-primary hover:text-soa-primary transition-all duration-300 hover:scale-105"
                  >
                    <Play className="w-5 h-5" />
                    Watch Our Story
                  </Link>
                </div>
              </FadeIn>

              {/* Social Links */}
              <FadeIn delay={0.5}>
                <div className="flex items-center gap-4 mt-8 justify-center lg:justify-start">
                  <span className="text-sm text-gray-500">Follow us:</span>
                  <a href="https://www.facebook.com/61575839187032" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-200 transition-all duration-300 hover:scale-110">
                    <Facebook className="w-5 h-5" />
                  </a>
                  <a href="https://www.tiktok.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition-all duration-300 hover:scale-110">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
                  </a>
                  <a href="https://www.youtube.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 hover:bg-red-200 transition-all duration-300 hover:scale-110">
                    <Youtube className="w-5 h-5" />
                  </a>
                  <a href="https://www.instagram.com/soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-200 transition-all duration-300 hover:scale-110">
                    <Instagram className="w-5 h-5" />
                  </a>
                  <a href="https://wa.me/27762233981" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-soa-light rounded-full flex items-center justify-center text-soa-gold hover:bg-soa-beige transition-all duration-300 hover:scale-110">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                </div>
              </FadeIn>
            </div>

            {/* Right Content - SOA Logo Card */}
            <SlideIn direction="right" delay={0.3}>
              <div className="relative">
                {/* Decorative African pattern accent */}
                <div className="absolute -inset-4 bg-gradient-to-br from-amber-400/20 via-soa-primary/10 to-amber-500/20 rounded-[2rem] blur-xl animate-pulse" />
                <FloatingElement duration={4} distance={8}>
                  <div className="relative bg-gradient-to-br from-soa-dark via-soa-primary to-soa-dark rounded-3xl shadow-2xl p-8 max-w-md mx-auto border-2 border-amber-400/50 overflow-hidden">
                    {/* African pattern overlay */}
                    <div className="absolute inset-0 opacity-10">
                      <div className="absolute top-0 left-0 w-full h-full" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'}} />
                    </div>
                    
                    {/* SOA Logo */}
                    <div className="relative text-center mb-4 pt-2">
                      <ScaleIn delay={0.5}>
                        <div className="w-52 h-52 mx-auto mb-4 relative bg-white rounded-full p-3 shadow-lg border-4 border-amber-400/50 overflow-hidden">
                          <Image
                            src="/images/soa-logo.png"
                            alt="Soil of Africa Logo"
                            width={200}
                            height={200}
                            className="object-contain w-full h-full"
                          />
                        </div>
                      </ScaleIn>
                      <h2 className="text-3xl font-bold text-white">S.O.A</h2>
                      <p className="text-amber-400 font-bold text-lg tracking-wider">SOIL OF AFRICA</p>
                      <p className="text-sm text-gray-300 mt-2 italic">Vehicle of African Transformation</p>
                      <p className="text-amber-400/80 text-xs mt-1 font-semibold">#SIZOSEBENZANGENKANI</p>
                    </div>

                    {/* Stats with CountUp */}
                    <div className="relative grid grid-cols-3 gap-4 text-center border-t-2 border-amber-400/30 pt-6">
                      <div>
                        <p className="text-2xl font-bold text-white">
                          <CountUp end={totalMembers} suffix="+" />
                        </p>
                        <p className="text-xs text-gray-400">Members</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-amber-400">
                          <CountUp end={9} />
                        </p>
                        <p className="text-xs text-gray-400">Provinces</p>
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-white">
                          <CountUp end={3} />
                        </p>
                        <p className="text-xs text-gray-400">Chapters</p>
                      </div>
                    </div>
                  </div>
                </FloatingElement>
              </div>
            </SlideIn>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 bg-soa-dark text-white overflow-hidden">
        <FadeIn>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">Our Mission</h2>
            <p className="text-lg text-gray-300 leading-relaxed">
              Through our chapters, we aim to equip young people with practical skills
              that open doors to employment, entrepreneurship, and lifelong impact. We are committed
              to reducing the youth unemployment rate from <span className="text-soa-secondary font-bold">62.7% to 40%</span> while
              tackling high crime rates in our communities.
            </p>
          </div>
        </FadeIn>
      </section>

      {/* Our Leader Section */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-soa-dark to-gray-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Image Side */}
            <SlideIn direction="left" delay={0.2} className="order-2 lg:order-1">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-br from-amber-400/30 via-soa-primary/20 to-amber-500/30 rounded-3xl blur-2xl" />
                <div className="relative">
                  <div className="relative rounded-2xl overflow-hidden shadow-2xl border-4 border-amber-400/50">
                    <Image
                      src="/images/president-raising.jpg"
                      alt="SOA President"
                      width={600}
                      height={750}
                      className="object-cover w-full"
                    />
                    {/* Overlay gradient */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                    {/* Caption */}
                    <div className="absolute bottom-0 left-0 right-0 p-6">
                      <p className="text-amber-400 font-bold text-lg">#SIZOSEBENZANGENKANI</p>
                      <p className="text-white/80 text-sm">We Will Work Together</p>
                    </div>
                  </div>
                </div>
              </div>
            </SlideIn>

            {/* Content Side */}
            <div className="order-1 lg:order-2">
              <FadeIn delay={0.1} direction="right">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/20 rounded-full text-amber-400 text-sm font-medium mb-6">
                  <Star className="w-4 h-4" />
                  Our Leadership
                </div>
              </FadeIn>
              
              <FadeIn delay={0.2} direction="right">
                <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                  Leading the Movement for{' '}
                  <span className="text-amber-400">African Transformation</span>
                </h2>
              </FadeIn>
              
              <FadeIn delay={0.3} direction="right">
                <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                  Soil of Africa stands as a beacon of hope for South African communities. 
                  Under visionary leadership, we are mobilizing citizens to demand economic 
                  inclusion, skills development, and dignified employment for all.
                </p>
              </FadeIn>
              
              <FadeIn delay={0.4} direction="right">
                <blockquote className="border-l-4 border-amber-400 pl-6 py-4 mb-8">
                  <p className="text-xl italic text-gray-200 mb-4">
                    "We are not just an organization — we are a movement. A movement of the people, 
                    for the people. Together, we will transform South Africa."
                  </p>
                  <footer className="text-amber-400 font-semibold">
                    — SOA National Leadership
                  </footer>
                </blockquote>
              </FadeIn>

              <FadeIn delay={0.5} direction="right">
                <div className="flex flex-wrap gap-4">
                  <Link
                    href="/about"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-lg hover:scale-105"
                  >
                    Learn More About Us
                    <ArrowRight className="w-5 h-5" />
                  </Link>
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 hover:scale-105"
                  >
                    Join the Movement
                  </Link>
                </div>
              </FadeIn>
            </div>
          </div>
        </div>
      </section>

      {/* Chapters Section */}
      <section className="py-20 bg-stone-100/80 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Our Chapters
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Three pillars of transformation driving change across South Africa
              </p>
            </div>
          </FadeIn>

          <StaggerChildren staggerDelay={0.15} className="grid md:grid-cols-3 gap-8">
            {chapters.map((chapter) => (
              <StaggerItem key={chapter.id}>
                <div className="bg-stone-50 rounded-2xl shadow-lg overflow-hidden card-hover h-full">
                  <div className={`bg-gradient-to-r ${chapter.color} p-6 text-white`}>
                    <chapter.icon className="w-10 h-10 mb-3" />
                    <h3 className="text-xl font-bold">{chapter.name}</h3>
                    <p className="text-sm opacity-90">{chapter.tagline}</p>
                  </div>
                  <div className="p-6">
                    <p className="text-gray-600 text-sm mb-4">{chapter.description}</p>
                    <div className="space-y-2">
                      {chapter.programs.map((program, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="w-4 h-4 text-soa-primary" />
                          <span className="text-gray-700">{program}</span>
                        </div>
                      ))}
                    </div>
                    <Link
                      href={`/chapters/${chapter.id}`}
                      className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-soa-primary hover:text-soa-primary transition-all duration-300"
                    >
                      Learn More
                      <ChevronRight className="w-4 h-4" />
                    </Link>
                  </div>
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Our Core Values
              </h2>
            </div>
          </FadeIn>

          <StaggerChildren staggerDelay={0.1} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((value, index) => (
              <StaggerItem key={index}>
                <div className="bg-stone-50 rounded-2xl p-6 shadow-sm border border-stone-200 card-hover text-center h-full">
                  <div className="w-14 h-14 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-xl flex items-center justify-center mx-auto mb-4">
                    <value.icon className="w-7 h-7 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                  <p className="text-gray-600 text-sm">{value.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* Membership & Support */}
      <section className="py-20 bg-stone-100/80 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Join the Movement
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Be part of African transformation — as a member or a supporter
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Membership Card */}
            <SlideIn direction="left" delay={0.2}>
              <div className="relative bg-stone-50 rounded-2xl shadow-lg overflow-hidden card-hover h-full">
                <div className="bg-gradient-to-r from-soa-primary to-soa-secondary p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Community Membership</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">R20</span>
                    <span className="text-sm opacity-80">/year</span>
                  </div>
                  <p className="text-sm opacity-80 mt-2">Join the movement and stay connected</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {['Digital Member ID Card', 'Community Updates', 'Event Notifications', 'Basic Resources', 'Newsletter Access'].map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-soa-primary shrink-0 mt-0.5" />
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href="/register?tier=community"
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-all duration-300 hover:scale-105"
                  >
                    Become a Member
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            </SlideIn>

            {/* Donations/Support Card */}
            <SlideIn direction="right" delay={0.3}>
              <div className="relative bg-stone-50 rounded-2xl shadow-lg overflow-hidden card-hover h-full">
                <div className="absolute top-0 right-0 bg-soa-gold text-white text-xs font-semibold px-3 py-1 rounded-bl-lg z-10">
                  Support Us
                </div>
                <div className="bg-gradient-to-r from-amber-500 to-amber-600 p-6 text-white">
                  <h3 className="text-xl font-bold mb-2">Make a Donation</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">Any Amount</span>
                  </div>
                  <p className="text-sm opacity-80 mt-2">Individuals, companies & organizations welcome</p>
                </div>
                <div className="p-6">
                  <ul className="space-y-3">
                    {[
                      'One-time or recurring donations',
                      'Corporate sponsorships',
                      'Crowdfunding campaigns',
                      'Patronage programs',
                      'In-kind contributions',
                      'Skills & expertise donations',
                    ].map((feature, index) => (
                      <li key={index} className="flex items-start gap-3">
                        <Heart className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                        <span className="text-gray-600 text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 mt-4 mb-4">
                    Your contribution helps fund skills development, community programs, and youth empowerment across South Africa.
                  </p>
                  <Link
                    href="/donate"
                    className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-all duration-300 hover:scale-105"
                  >
                    Donate Now
                    <Heart className="w-4 h-4" />
                  </Link>
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500 text-center">
                      Want to become a patron or sponsor? <a href="/contact" className="text-soa-primary hover:underline">Contact us</a>
                    </p>
                  </div>
                </div>
              </div>
            </SlideIn>
          </div>

          {/* Merchandise Banner with Slider */}
          <FadeIn delay={0.4}>
            <MerchandiseSlider />
          </FadeIn>
        </div>
      </section>

      {/* Media Hub Preview */}
      <section className="py-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
              <div>
                <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                  Latest from SOA
                </h2>
                <p className="text-gray-600">News, videos, and updates from our community</p>
              </div>
              <Link
                href="/media"
                className="inline-flex items-center gap-2 text-soa-primary hover:underline font-medium transition-all duration-300 hover:gap-3"
              >
                View All Media
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </FadeIn>

          {/* Social Media Feed Preview */}
          <StaggerChildren staggerDelay={0.1} className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* X (Twitter) Embed */}
            <StaggerItem className="col-span-2">
              <div className="bg-stone-50 rounded-xl shadow-sm border border-stone-200 overflow-hidden h-full">
                <div className="p-4 border-b border-stone-200 flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">@SABCNews</p>
                    <p className="text-xs text-gray-500">July 28, 2025</p>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-gray-700 text-sm mb-3">
                    [WATCH] The Soil of Africa led a march in Mamelodi, east of Pretoria, 
                    to demand employment for SA citizens. The civic movement claims the N4 
                    Gateway industrial park prioritises undocumented foreigners over locals.
                  </p>
                  <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center cursor-pointer hover:bg-gray-200 transition-colors">
                    <Play className="w-12 h-12 text-gray-400" />
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Gallery Preview */}
            <StaggerItem>
              <div className="bg-stone-50 rounded-xl shadow-sm border border-stone-200 overflow-hidden h-full">
                <div className="aspect-square bg-gradient-to-br from-soa-primary to-soa-secondary flex items-center justify-center">
                  <div className="text-center text-white">
                    <GraduationCap className="w-12 h-12 mx-auto mb-2" />
                    <p className="font-semibold">Skills Centre</p>
                    <p className="text-xs opacity-80">Mamelodi Launch</p>
                  </div>
                </div>
              </div>
            </StaggerItem>

            {/* Quick Stats */}
            <StaggerItem>
              <div className="bg-gradient-to-br from-soa-dark to-gray-900 rounded-xl shadow-sm border border-stone-200 overflow-hidden p-6 text-white h-full">
                <h3 className="font-semibold mb-4">Community Impact</h3>
                <div className="space-y-4">
                  <div>
                    <p className="text-2xl font-bold text-amber-400">
                      <CountUp end={3324} suffix="+" />
                    </p>
                    <p className="text-xs text-gray-400">Members Nationwide</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">
                      <CountUp end={9} />
                    </p>
                    <p className="text-xs text-gray-400">Provincial Chapters</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-soa-secondary">
                      <CountUp end={15} suffix="+" />
                    </p>
                    <p className="text-xs text-gray-400">Community Programs</p>
                  </div>
                </div>
              </div>
            </StaggerItem>
          </StaggerChildren>
        </div>
      </section>

      {/* Regions Section */}
      <section className="py-20 bg-stone-100/80 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
                Our Provincial Chapters
              </h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                SOA is present in all 9 provinces of South Africa
              </p>
            </div>
          </FadeIn>

          <StaggerChildren staggerDelay={0.05} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {regions.map((region) => (
              <StaggerItem key={region.code}>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-stone-200 text-center card-hover">
                  <div className="w-12 h-12 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-full flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-gray-900 text-sm">{region.name}</h3>
                  <p className="text-xs text-gray-500">{region.city}</p>
                  <p className="text-lg font-bold text-soa-primary mt-2">
                    <CountUp end={region.members} suffix="+" duration={1.5} />
                  </p>
                  <p className="text-xs text-gray-400">members</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerChildren>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-soa-dark via-soa-primary to-soa-dark text-white overflow-hidden">
        <FadeIn>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            <h2 className="text-3xl sm:text-4xl font-bold mb-6">
              Ready to Make a Difference?
            </h2>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto">
              Join thousands of South Africans who are working together to transform our nation. 
              Together, we can build a better future.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                href="/register"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold text-lg hover:from-amber-600 hover:to-amber-700 transition-all duration-300 shadow-lg hover:scale-105"
              >
                Join SOA Today
                <ArrowRight className="w-5 h-5" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white/10 text-white border border-white/20 rounded-xl font-semibold text-lg hover:bg-white/20 transition-all duration-300 hover:scale-105"
              >
                Contact Us
              </Link>
            </div>
          </div>
        </FadeIn>
      </section>

      {/* Download App Section */}
      <section className="py-16 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-3xl p-8 md:p-12 flex flex-col md:flex-row items-center gap-8">
              <div className="flex-1 text-center md:text-left">
                <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">
                  Get the SOA Mobile App
                </h2>
                <p className="text-gray-300 mb-6">
                  Access your membership, events, and community features on the go.
                  Available for Android and iOS.
                </p>
                <div className="flex flex-wrap gap-4 justify-center md:justify-start">
                  <a href="#" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-gray-900 rounded-xl font-medium hover:bg-gray-100 transition-all duration-300 hover:scale-105">
                    <Download className="w-5 h-5" />
                    Download App
                  </a>
                </div>
              </div>
              <div className="flex-shrink-0">
                <FloatingElement duration={3} distance={6}>
                  <div className="w-48 h-48 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-3xl flex items-center justify-center shadow-2xl">
                    <Smartphone className="w-24 h-24 text-white" />
                  </div>
                </FloatingElement>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      <Footer />
    </div>
  );
}
