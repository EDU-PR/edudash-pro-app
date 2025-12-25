import Link from 'next/link';
import Image from 'next/image';
import { Header, Footer } from '@/components';
import {
  Leaf,
  Users,
  MapPin,
  Calendar,
  BookOpen,
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
  Briefcase,
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

// Membership Tiers
const tiers = [
  {
    name: 'Community',
    price: 'R20',
    period: '/year',
    description: 'Join the movement and stay connected',
    features: [
      'Digital Member ID Card',
      'Community Updates',
      'Event Notifications',
      'Basic Resources',
    ],
    color: 'from-soa-primary to-soa-secondary',
    badge: null,
  },
];

// Latest News/Media
const latestMedia = [
  {
    type: 'video',
    platform: 'twitter',
    title: 'SOA March in Mamelodi',
    description: 'The Soil of Africa led a march demanding employment for SA citizens at N4 Gateway.',
    thumbnail: '/media/march.jpg',
    url: 'https://twitter.com/SABCNews/status/1949862717621178383',
  },
  {
    type: 'image',
    platform: 'facebook',
    title: 'Skills Centre Launch',
    description: 'Opening of Skills Development Centre in Mamelodi',
    thumbnail: '/media/skills-centre.jpg',
    url: 'https://www.facebook.com/61575839187032',
  },
];

export default function HomePage() {
  const totalMembers = regions.reduce((sum, r) => sum + r.members, 0);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />

      {/* Hero Section */}
      <section className="relative pt-28 pb-20 overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-stone-100 via-amber-50/50 to-stone-100" />
        <div className="absolute inset-0 opacity-40">
          <div className="absolute top-20 left-10 w-72 h-72 bg-soa-secondary/30 rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-amber-400/20 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/3 w-48 h-48 bg-soa-primary/15 rounded-full blur-2xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Left Content */}
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-soa-primary/10 rounded-full text-soa-primary text-sm font-medium mb-6">
                <Megaphone className="w-4 h-4" />
                #SIZOSEBENZANGENKANI - We Will Work Together
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-gray-900 mb-6">
                Formed to{' '}
                <span className="gradient-text">Transform & Liberate</span>{' '}
                South Africans
              </h1>

              <p className="text-lg text-gray-600 mb-8 max-w-xl mx-auto lg:mx-0">
                SOA's objective is to improve the living conditions of all residents of South Africa.
                We are the vehicle of African transformation, empowering communities through skills
                development, social justice, and youth leadership.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Link
                  href="/register"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold text-lg hover:from-amber-600 hover:to-amber-700 transition shadow-lg shadow-amber-500/25"
                >
                  Join the Movement
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/media"
                  className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-xl font-semibold text-lg hover:border-soa-primary transition"
                >
                  <Play className="w-5 h-5" />
                  Watch Our Story
                </Link>
              </div>

              {/* Social Links */}
              <div className="flex items-center gap-4 mt-8 justify-center lg:justify-start">
                <span className="text-sm text-gray-500">Follow us:</span>
                <a href="https://www.facebook.com/61575839187032" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 hover:bg-blue-200 transition">
                  <Facebook className="w-5 h-5" />
                </a>
                <a href="https://www.tiktok.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-900 rounded-full flex items-center justify-center text-white hover:bg-gray-800 transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/></svg>
                </a>
                <a href="https://www.youtube.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center text-red-600 hover:bg-red-200 transition">
                  <Youtube className="w-5 h-5" />
                </a>
                <a href="https://www.instagram.com/soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 hover:bg-pink-200 transition">
                  <Instagram className="w-5 h-5" />
                </a>
                <a href="https://wa.me/27762233981" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-soa-light rounded-full flex items-center justify-center text-soa-gold hover:bg-soa-beige transition">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                </a>
              </div>
            </div>

            {/* Right Content - SOA Logo Card */}
            <div className="relative">
              {/* Decorative African pattern accent */}
              <div className="absolute -inset-4 bg-gradient-to-br from-amber-400/20 via-soa-primary/10 to-amber-500/20 rounded-[2rem] blur-xl" />
              <div className="relative bg-gradient-to-br from-soa-dark via-soa-primary to-soa-dark rounded-3xl shadow-2xl p-8 max-w-md mx-auto border-2 border-amber-400/50 overflow-hidden">
                {/* African pattern overlay */}
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-0 left-0 w-full h-full" style={{backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 10px, rgba(255,255,255,0.1) 10px, rgba(255,255,255,0.1) 20px)'}} />
                </div>
                
                {/* SOA Logo */}
                <div className="relative text-center mb-4 pt-2">
                  <div className="w-52 h-52 mx-auto mb-4 relative bg-white rounded-full p-3 shadow-lg border-4 border-amber-400/50 overflow-hidden">
                    <Image
                      src="/images/soa-logo.png"
                      alt="Soil of Africa Logo"
                      width={200}
                      height={200}
                      className="object-contain w-full h-full"
                    />
                  </div>
                  <h2 className="text-3xl font-bold text-white">S.O.A</h2>
                  <p className="text-amber-400 font-bold text-lg tracking-wider">SOIL OF AFRICA</p>
                  <p className="text-sm text-gray-300 mt-2 italic">Vehicle of African Transformation</p>
                  <p className="text-amber-400/80 text-xs mt-1 font-semibold">#SIZOSEBENZANGENKANI</p>
                </div>

                {/* Stats */}
                <div className="relative grid grid-cols-3 gap-4 text-center border-t-2 border-amber-400/30 pt-6">
                  <div>
                    <p className="text-2xl font-bold text-white">{totalMembers.toLocaleString()}+</p>
                    <p className="text-xs text-gray-400">Members</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-amber-400">9</p>
                    <p className="text-xs text-gray-400">Provinces</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-white">3</p>
                    <p className="text-xs text-gray-400">Chapters</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Mission Statement */}
      <section className="py-16 bg-soa-dark text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-6">Our Mission</h2>
          <p className="text-lg text-gray-300 leading-relaxed">
            Through our chapters, we aim to equip young people with practical skills
            that open doors to employment, entrepreneurship, and lifelong impact. We are committed
            to reducing the youth unemployment rate from <span className="text-soa-secondary font-bold">62.7% to 40%</span> while
            tackling high crime rates in our communities.
          </p>
        </div>
      </section>

      {/* Our Leader Section */}
      <section className="py-20 bg-gradient-to-br from-gray-900 via-soa-dark to-gray-900 text-white overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Image Side */}
            <div className="relative order-2 lg:order-1">
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

            {/* Content Side */}
            <div className="order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-400/20 rounded-full text-amber-400 text-sm font-medium mb-6">
                <Star className="w-4 h-4" />
                Our Leadership
              </div>
              
              <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-6">
                Leading the Movement for{' '}
                <span className="text-amber-400">African Transformation</span>
              </h2>
              
              <p className="text-lg text-gray-300 mb-6 leading-relaxed">
                Soil of Africa stands as a beacon of hope for South African communities. 
                Under visionary leadership, we are mobilizing citizens to demand economic 
                inclusion, skills development, and dignified employment for all.
              </p>
              
              <blockquote className="border-l-4 border-amber-400 pl-6 py-4 mb-8">
                <p className="text-xl italic text-gray-200 mb-4">
                  "We are not just an organization — we are a movement. A movement of the people, 
                  for the people. Together, we will transform South Africa."
                </p>
                <footer className="text-amber-400 font-semibold">
                  — SOA National Leadership
                </footer>
              </blockquote>

              <div className="flex flex-wrap gap-4">
                <Link
                  href="/about"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-white rounded-xl font-semibold hover:from-amber-600 hover:to-amber-700 transition shadow-lg"
                >
                  Learn More About Us
                  <ArrowRight className="w-5 h-5" />
                </Link>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-semibold hover:bg-white/20 transition"
                >
                  Join the Movement
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Chapters Section */}
      <section className="py-20 bg-stone-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Our Chapters
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Three pillars of transformation driving change across South Africa
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {chapters.map((chapter) => (
              <div
                key={chapter.id}
                className="bg-stone-50 rounded-2xl shadow-lg overflow-hidden card-hover"
              >
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
                    className="mt-6 w-full inline-flex items-center justify-center gap-2 px-4 py-2 border-2 border-gray-200 text-gray-700 rounded-xl font-medium hover:border-soa-primary hover:text-soa-primary transition"
                  >
                    Learn More
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Core Values */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Our Core Values
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {coreValues.map((value, index) => (
              <div
                key={index}
                className="bg-stone-50 rounded-2xl p-6 shadow-sm border border-stone-200 card-hover text-center"
              >
                <div className="w-14 h-14 bg-gradient-to-br from-soa-primary to-soa-secondary rounded-xl flex items-center justify-center mx-auto mb-4">
                  <value.icon className="w-7 h-7 text-white" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-gray-600 text-sm">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Membership & Support */}
      <section className="py-20 bg-stone-100/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
              Join the Movement
            </h2>
            <p className="text-gray-600 max-w-2xl mx-auto">
              Be part of African transformation — as a member or a supporter
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Membership Card */}
            <div className="relative bg-stone-50 rounded-2xl shadow-lg overflow-hidden card-hover">
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
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition"
                >
                  Become a Member
                  <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
            </div>

            {/* Donations/Support Card */}
            <div className="relative bg-stone-50 rounded-2xl shadow-lg overflow-hidden card-hover">
              <div className="absolute top-0 right-0 bg-soa-gold text-white text-xs font-semibold px-3 py-1 rounded-bl-lg">
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
                  className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition"
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
          </div>

          {/* Merchandise Banner */}
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="relative rounded-2xl overflow-hidden shadow-xl">
              <Image 
                src="/images/combo.png" 
                alt="SOA Combo - T-Shirt and Cap R300" 
                width={1024}
                height={500}
                className="w-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-white text-center sm:text-left">
                    <h3 className="text-xl font-bold">Official SOA Merchandise</h3>
                    <p className="text-white/80 text-sm">Show your pride with our exclusive combo pack</p>
                  </div>
                  <a
                    href="https://wa.me/27762233981?text=Hi%2C%20I%20would%20like%20to%20order%20the%20SOA%20Combo%20(T-Shirt%20and%20Cap)%20for%20R300"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 bg-soa-gold text-white rounded-xl font-semibold hover:bg-amber-500 transition whitespace-nowrap"
                  >
                    Order Now - R300
                    <ChevronRight className="w-4 h-4" />
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Media Hub Preview */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
                Latest from SOA
              </h2>
              <p className="text-gray-600">News, videos, and updates from our community</p>
            </div>
            <Link
              href="/media"
              className="inline-flex items-center gap-2 text-soa-primary hover:underline font-medium"
            >
              View All Media
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>

          {/* Social Media Feed Preview */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* X (Twitter) Embed */}
            <div className="bg-stone-50 rounded-xl shadow-sm border border-stone-200 overflow-hidden col-span-2">
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
                <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center">
                  <Play className="w-12 h-12 text-gray-400" />
                </div>
              </div>
            </div>

            {/* Gallery Preview */}
            <div className="bg-stone-50 rounded-xl shadow-sm border border-stone-200 overflow-hidden">
              <div className="aspect-square bg-gradient-to-br from-soa-primary to-soa-secondary flex items-center justify-center">
                <div className="text-center text-white">
                  <GraduationCap className="w-12 h-12 mx-auto mb-2" />
                  <p className="font-semibold">Skills Centre</p>
                  <p className="text-xs opacity-80">Mamelodi Launch</p>
                </div>
              </div>
              <div className="p-3">
                <p className="text-sm font-medium text-gray-900">New Skills Centre</p>
                <p className="text-xs text-gray-500">6-12 month programs</p>
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-gradient-to-br from-soa-primary to-soa-dark rounded-xl p-6 text-white flex flex-col justify-between">
              <div>
                <Heart className="w-8 h-8 mb-4" />
                <p className="text-3xl font-bold">62.7%</p>
                <p className="text-sm opacity-80">Youth Unemployment Rate</p>
              </div>
              <div className="mt-6 pt-4 border-t border-white/20">
                <p className="text-sm font-medium">Our Goal: 40%</p>
                <p className="text-xs opacity-80">Through skills & employment</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Regions Section */}
      <section className="py-20 bg-soa-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Active Across South Africa
            </h2>
            <p className="text-gray-400 max-w-2xl mx-auto">
              Join members in all 9 provinces. Select your region during registration.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
            {regions.map((region, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-4 text-center hover:shadow-lg transition shadow-md"
              >
                <div className="w-12 h-12 bg-soa-gold/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <MapPin className="w-6 h-6 text-soa-gold" />
                </div>
                <p className="font-semibold text-soa-dark">{region.name}</p>
                <p className="text-sm text-soa-primary">{region.members} members</p>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-5xl font-bold text-soa-secondary mb-2">
              {totalMembers.toLocaleString()}+
            </p>
            <p className="text-gray-400">Total Members Nationwide</p>
          </div>
        </div>
      </section>

      {/* Download App Section - EduDash Pro Branding */}
      <section className="py-20 bg-gradient-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="text-white">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#6366f1]/20 rounded-full text-[#818cf8] text-sm font-medium mb-6">
                <Smartphone className="w-4 h-4" />
                Mobile App Available
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-4">
                Take Your Membership <span className="text-[#6366f1]">Anywhere</span>
              </h2>
              <p className="text-gray-300 mb-6 text-lg">
                Access your digital ID card, learning programs, assignment help, and connect with 
                other members on the go. Download the EduDash Pro app to get started.
              </p>
              
              {/* Features list */}
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#6366f1]/20 rounded-lg flex items-center justify-center">
                    <Award className="w-5 h-5 text-[#6366f1]" />
                  </div>
                  <span className="text-gray-300 text-sm">Digital ID Card</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#10b981]/20 rounded-lg flex items-center justify-center">
                    <BookOpen className="w-5 h-5 text-[#10b981]" />
                  </div>
                  <span className="text-gray-300 text-sm">Skills Programs</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#f59e0b]/20 rounded-lg flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#f59e0b]" />
                  </div>
                  <span className="text-gray-300 text-sm">Community</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-[#ec4899]/20 rounded-lg flex items-center justify-center">
                    <Calendar className="w-5 h-5 text-[#ec4899]" />
                  </div>
                  <span className="text-gray-300 text-sm">Events</span>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                <a
                  href={process.env.NEXT_PUBLIC_PLAY_STORE_URL || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 bg-[#6366f1] text-white rounded-xl font-medium hover:bg-[#4f46e5] transition shadow-lg shadow-[#6366f1]/25"
                >
                  <Download className="w-5 h-5" />
                  Google Play
                </a>
                <a
                  href={process.env.NEXT_PUBLIC_APP_STORE_URL || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-3 px-6 py-3 bg-white/10 text-white border border-white/20 rounded-xl font-medium hover:bg-white/20 transition"
                >
                  <Download className="w-5 h-5" />
                  App Store
                </a>
              </div>
              <p className="text-sm text-gray-400 mt-6 flex items-center gap-2">
                <span className="w-2 h-2 bg-[#10b981] rounded-full animate-pulse" />
                Powered by EduDash Pro
              </p>
            </div>

            {/* Phone Mockup - EduDash Pro Screenshot */}
            <div className="flex justify-center mt-8 md:mt-0">
              <div className="relative">
                {/* Glow effect */}
                <div className="absolute -inset-8 bg-[#6366f1]/20 rounded-full blur-3xl" />
                
                {/* Phone frame with actual screenshot */}
                <div className="relative bg-gray-800 rounded-[2.5rem] md:rounded-[3rem] p-1.5 md:p-2 shadow-2xl border border-gray-700">
                  <div className="rounded-[2rem] md:rounded-[2.5rem] overflow-hidden">
                    <Image 
                      src="/images/edudash-app-screenshot.png" 
                      alt="EduDash Pro App - My Learning Dashboard" 
                      width={288}
                      height={600}
                      className="object-cover w-48 md:w-72"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-stone-100/80">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-soa-primary/10 rounded-full text-soa-primary text-sm font-medium mb-6">
            <Star className="w-4 h-4" />
            Ready to Join?
          </div>
          <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4">
            Start Your Journey Today
          </h2>
          <p className="text-gray-600 mb-8">
            Join the growing community of Soil of Africa members. Register now and receive
            your digital member ID card instantly.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-gradient-to-r from-soa-primary to-soa-secondary text-white rounded-xl font-semibold text-lg hover:opacity-90 transition shadow-lg shadow-soa-primary/25"
            >
              Register as New Member
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link
              href="/join"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-white text-gray-700 border-2 border-gray-200 rounded-xl font-semibold text-lg hover:border-soa-primary hover:text-soa-primary transition"
            >
              Join with Invite Code
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
