'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Header, Footer } from '@/components';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Send,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Users,
  Building2,
  HelpCircle,
  Youtube,
  Instagram,
  Facebook,
  Twitter,
} from 'lucide-react';

// Contact reasons
const contactReasons = [
  { id: 'membership', name: 'Membership Inquiry', icon: Users },
  { id: 'programs', name: 'Skills Programs', icon: Building2 },
  { id: 'media', name: 'Media & Press', icon: MessageCircle },
  { id: 'other', name: 'General Inquiry', icon: HelpCircle },
];

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    reason: '',
    message: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission - In production, this would send to an API
    await new Promise(resolve => setTimeout(resolve, 1500));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-soa-primary to-soa-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-4xl sm:text-5xl font-bold mb-4">
            Get In Touch
          </h1>
          <p className="text-lg text-gray-300 max-w-2xl mx-auto">
            Have questions about membership, programs, or want to get involved? 
            We'd love to hear from you.
          </p>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-3 gap-12">
            {/* Contact Information */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-2xl shadow-sm p-8 sticky top-24">
                <h2 className="text-2xl font-bold text-gray-900 mb-6">Contact Information</h2>

                <div className="space-y-6">
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                      <MapPin className="w-6 h-6 text-soa-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Address</h4>
                      <p className="text-gray-600 text-sm mt-1">
                        679 Tanya Street<br />
                        Moreleta Park<br />
                        Pretoria, 0044
                      </p>
                      <a
                        href="https://maps.google.com/?q=679+Tanya+Street,+Moreleta+Park,+Pretoria"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-soa-primary text-sm hover:underline mt-1 inline-block"
                      >
                        Get Directions →
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                      <Phone className="w-6 h-6 text-soa-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Phone</h4>
                      <a href="tel:+27128845118" className="text-gray-600 text-sm block hover:text-soa-primary">
                        +27 12 884-5118
                      </a>
                      <a href="tel:+27762233981" className="text-gray-600 text-sm block hover:text-soa-primary">
                        +27 76 223-3981
                      </a>
                    </div>
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-soa-light rounded-xl flex items-center justify-center shrink-0">
                      <Mail className="w-6 h-6 text-soa-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-gray-900">Email</h4>
                      <a href="mailto:info@soilofafrica.org" className="text-gray-600 text-sm hover:text-soa-primary">
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
                      <p className="text-gray-600 text-sm">
                        Mon - Fri: 8:00 AM - 5:00 PM<br />
                        Sat: 9:00 AM - 1:00 PM
                      </p>
                    </div>
                  </div>
                </div>

                {/* Social Links */}
                <div className="mt-8 pt-6 border-t border-gray-100">
                  <h4 className="font-semibold text-gray-900 mb-4">Follow Us</h4>
                  <div className="flex items-center gap-3">
                    <a href="https://www.facebook.com/61575839187032" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center text-blue-600 hover:bg-blue-200 transition">
                      <Facebook className="w-5 h-5" />
                    </a>
                    <a href="https://x.com/soilofafricasa" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-700 hover:bg-gray-200 transition">
                      <Twitter className="w-5 h-5" />
                    </a>
                    <a href="https://www.youtube.com/@soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center text-red-600 hover:bg-red-200 transition">
                      <Youtube className="w-5 h-5" />
                    </a>
                    <a href="https://www.instagram.com/soilofafrica" target="_blank" rel="noopener noreferrer" className="w-10 h-10 bg-pink-100 rounded-lg flex items-center justify-center text-pink-600 hover:bg-pink-200 transition">
                      <Instagram className="w-5 h-5" />
                    </a>
                  </div>
                </div>

                {/* WhatsApp CTA */}
                <a
                  href="https://wa.me/27762233981"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 w-full inline-flex items-center justify-center gap-2 px-6 py-3 bg-soa-gold text-white rounded-xl font-medium hover:bg-soa-primary transition"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  Chat on WhatsApp
                </a>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <div className="bg-white rounded-2xl shadow-sm p-8">
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-soa-light rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle2 className="w-8 h-8 text-soa-primary" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">Message Sent!</h3>
                    <p className="text-gray-600 mb-6">
                      Thank you for reaching out. We'll get back to you within 24-48 hours.
                    </p>
                    <button
                      onClick={() => {
                        setIsSubmitted(false);
                        setFormData({ name: '', email: '', phone: '', reason: '', message: '' });
                      }}
                      className="text-soa-primary font-medium hover:underline"
                    >
                      Send another message
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">Send Us a Message</h2>
                    <p className="text-gray-600 mb-8">
                      Fill out the form below and we'll get back to you as soon as possible.
                    </p>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Contact Reason */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-3">
                          What can we help you with?
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                          {contactReasons.map((reason) => (
                            <label
                              key={reason.id}
                              className={`relative flex items-center gap-3 p-4 border-2 rounded-xl cursor-pointer transition ${
                                formData.reason === reason.id
                                  ? 'border-soa-primary bg-soa-light'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="reason"
                                value={reason.id}
                                checked={formData.reason === reason.id}
                                onChange={handleChange}
                                className="sr-only"
                              />
                              <reason.icon className={`w-5 h-5 ${formData.reason === reason.id ? 'text-soa-primary' : 'text-gray-400'}`} />
                              <span className={`text-sm font-medium ${formData.reason === reason.id ? 'text-soa-primary' : 'text-gray-700'}`}>
                                {reason.name}
                              </span>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Name & Email */}
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            value={formData.name}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent transition"
                            placeholder="Your full name"
                          />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            value={formData.email}
                            onChange={handleChange}
                            required
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent transition"
                            placeholder="your@email.com"
                          />
                        </div>
                      </div>

                      {/* Phone */}
                      <div>
                        <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-2">
                          Phone Number (Optional)
                        </label>
                        <input
                          type="tel"
                          id="phone"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent transition"
                          placeholder="+27 XX XXX XXXX"
                        />
                      </div>

                      {/* Message */}
                      <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                          Your Message *
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          value={formData.message}
                          onChange={handleChange}
                          required
                          rows={5}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-soa-primary focus:border-transparent transition resize-none"
                          placeholder="Tell us how we can help..."
                        />
                      </div>

                      {/* Submit Button */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full inline-flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-soa-primary to-soa-secondary text-white rounded-xl font-semibold hover:opacity-90 transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-5 h-5" />
                            Send Message
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Map Section */}
      <section className="pb-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-gray-200 rounded-2xl overflow-hidden h-[400px] flex items-center justify-center">
            <div className="text-center">
              <MapPin className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">679 Tanya Street, Moreleta Park</p>
              <p className="text-gray-500 text-sm">Pretoria, 0044</p>
              <a
                href="https://maps.google.com/?q=679+Tanya+Street,+Moreleta+Park,+Pretoria"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-4 px-4 py-2 bg-soa-primary text-white rounded-lg hover:bg-soa-dark transition"
              >
                <MapPin className="w-4 h-4" />
                Open in Google Maps
              </a>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
