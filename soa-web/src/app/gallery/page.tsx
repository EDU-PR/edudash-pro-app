'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Header, Footer } from '@/components';
import { FadeIn, SlideIn, ScaleIn } from '@/components/animations';
import {
  X,
  ChevronLeft,
  ChevronRight,
  Download,
  Share2,
  ZoomIn,
  Calendar,
  MapPin,
  Filter,
} from 'lucide-react';

// Gallery categories
const categories = [
  { id: 'all', name: 'All Photos' },
  { id: 'events', name: 'Events & Marches' },
  { id: 'skills', name: 'Skills Training' },
  { id: 'youth', name: 'Youth Chapter' },
  { id: 'community', name: 'Community Outreach' },
  { id: 'leadership', name: 'Leadership' },
];

interface GalleryImage {
  id: string;
  src: string;
  title: string;
  description: string;
  category: string;
  date: string;
  location: string;
}

// Sample gallery images - In production, these would come from Supabase storage
const galleryImages: GalleryImage[] = [
  {
    id: '1',
    src: '/gallery/march-mamelodi.jpg',
    title: 'Mamelodi Employment March',
    description: 'SOA members marching for employment rights at N4 Gateway industrial park',
    category: 'events',
    date: '2025-07-28',
    location: 'Mamelodi, Pretoria',
  },
  {
    id: '2',
    src: '/gallery/skills-centre-launch.jpg',
    title: 'Skills Centre Grand Opening',
    description: 'Official launch of the Mamelodi Skills Development Centre',
    category: 'skills',
    date: '2025-06-15',
    location: 'Mamelodi Skills Centre',
  },
  {
    id: '3',
    src: '/gallery/president-address.jpg',
    title: 'President Address',
    description: 'SOA President addressing members at the annual gathering',
    category: 'leadership',
    date: '2025-05-20',
    location: 'Pretoria',
  },
  {
    id: '4',
    src: '/gallery/youth-training.jpg',
    title: 'Youth Leadership Workshop',
    description: 'Young leaders participating in community development training',
    category: 'youth',
    date: '2025-07-10',
    location: 'Johannesburg',
  },
  {
    id: '5',
    src: '/gallery/agriculture-training.jpg',
    title: 'Agricultural Training Program',
    description: 'Hands-on farming skills training for sustainable food production',
    category: 'skills',
    date: '2025-06-22',
    location: 'Mamelodi',
  },
  {
    id: '6',
    src: '/gallery/community-meeting.jpg',
    title: 'Community Town Hall',
    description: 'Residents discussing service delivery challenges with SOA coordinators',
    category: 'community',
    date: '2025-07-05',
    location: 'Soshanguve',
  },
  {
    id: '7',
    src: '/gallery/ict-training.jpg',
    title: 'ICT Skills Development',
    description: 'Computer literacy and digital skills training session',
    category: 'skills',
    date: '2025-06-30',
    location: 'Mamelodi Skills Centre',
  },
  {
    id: '8',
    src: '/gallery/poultry-farming.jpg',
    title: 'Poultry Farming Program',
    description: 'Learners gaining practical experience in poultry management',
    category: 'skills',
    date: '2025-07-01',
    location: 'Pretoria North',
  },
  {
    id: '9',
    src: '/gallery/youth-outreach.jpg',
    title: 'Youth Chapter Outreach',
    description: 'Youth members engaging with local schools about opportunities',
    category: 'youth',
    date: '2025-07-18',
    location: 'Atteridgeville',
  },
  {
    id: '10',
    src: '/gallery/regional-meeting.jpg',
    title: 'Gauteng Regional Meeting',
    description: 'Regional coordinators planning provincial initiatives',
    category: 'leadership',
    date: '2025-07-12',
    location: 'Pretoria CBD',
  },
  {
    id: '11',
    src: '/gallery/certificate-ceremony.jpg',
    title: 'Skills Certificate Ceremony',
    description: 'Graduates receiving their skills certificates',
    category: 'skills',
    date: '2025-06-28',
    location: 'Mamelodi Skills Centre',
  },
  {
    id: '12',
    src: '/gallery/service-delivery-protest.jpg',
    title: 'Service Delivery Advocacy',
    description: 'Community members advocating for improved municipal services',
    category: 'events',
    date: '2025-07-22',
    location: 'Hammanskraal',
  },
];

export default function GalleryPage() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedImage, setSelectedImage] = useState<GalleryImage | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState(0);

  const filteredImages = galleryImages.filter(
    (img) => selectedCategory === 'all' || img.category === selectedCategory
  );

  const openLightbox = (image: GalleryImage, index: number) => {
    setSelectedImage(image);
    setLightboxIndex(index);
  };

  const closeLightbox = () => {
    setSelectedImage(null);
  };

  const navigateLightbox = (direction: 'prev' | 'next') => {
    const newIndex = direction === 'prev' 
      ? (lightboxIndex - 1 + filteredImages.length) % filteredImages.length
      : (lightboxIndex + 1) % filteredImages.length;
    setLightboxIndex(newIndex);
    setSelectedImage(filteredImages[newIndex]);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-12 bg-gradient-to-br from-soa-dark to-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <FadeIn>
            <h1 className="text-4xl sm:text-5xl font-bold mb-4">
              SOA Gallery
            </h1>
          </FadeIn>
          <SlideIn direction="up" delay={0.2}>
            <p className="text-lg text-gray-300 max-w-2xl mx-auto">
              Capturing moments of transformation, empowerment, and community across South Africa
            </p>
          </SlideIn>
        </div>
      </section>

      {/* Category Filter */}
      <section className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-wrap gap-2 justify-center">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === category.id
                    ? 'bg-soa-primary text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Gallery Grid */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {filteredImages.length === 0 ? (
            <div className="text-center py-20">
              <Filter className="w-12 h-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No photos found</h3>
              <p className="text-gray-500">Try selecting a different category</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredImages.map((image, index) => (
                <motion.button
                  key={image.id}
                  onClick={() => openLightbox(image, index)}
                  className="relative aspect-square bg-gray-200 rounded-xl overflow-hidden group"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  whileHover={{ scale: 1.03, zIndex: 10 }}
                  layout
                >
                  {/* Placeholder gradient until real images */}
                  <div className={`w-full h-full bg-gradient-to-br ${
                    index % 4 === 0 ? 'from-soa-primary to-soa-secondary' :
                    index % 4 === 1 ? 'from-blue-500 to-indigo-600' :
                    index % 4 === 2 ? 'from-amber-500 to-orange-600' :
                    'from-purple-500 to-pink-600'
                  } flex items-center justify-center`}>
                    <span className="text-white/60 text-xs text-center px-2">{image.title}</span>
                  </div>

                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <ZoomIn className="w-8 h-8 text-white" />
                  </div>

                  {/* Category Badge */}
                  <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded capitalize">
                    {image.category}
                  </div>
                </motion.button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Lightbox Modal */}
      {selectedImage && (
        <div className="fixed inset-0 z-50 bg-black/95 flex items-center justify-center">
          {/* Close Button */}
          <button
            onClick={closeLightbox}
            className="absolute top-4 right-4 w-10 h-10 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition z-10"
          >
            <X className="w-6 h-6" />
          </button>

          {/* Navigation */}
          <button
            onClick={() => navigateLightbox('prev')}
            className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition z-10"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
          <button
            onClick={() => navigateLightbox('next')}
            className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-white/20 transition z-10"
          >
            <ChevronRight className="w-6 h-6" />
          </button>

          {/* Image Content */}
          <div className="max-w-4xl w-full px-4">
            {/* Image Placeholder */}
            <div className="aspect-video bg-gradient-to-br from-soa-primary to-soa-secondary rounded-xl flex items-center justify-center mb-4">
              <span className="text-white text-xl font-medium">{selectedImage.title}</span>
            </div>

            {/* Image Info */}
            <div className="text-white">
              <h3 className="text-xl font-bold mb-2">{selectedImage.title}</h3>
              <p className="text-gray-300 mb-4">{selectedImage.description}</p>
              <div className="flex flex-wrap gap-4 text-sm text-gray-400">
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4" />
                  {new Date(selectedImage.date).toLocaleDateString('en-ZA', { 
                    year: 'numeric',
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-4 h-4" />
                  {selectedImage.location}
                </span>
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6">
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition">
                  <Download className="w-4 h-4" />
                  Download
                </button>
                <button className="inline-flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-white hover:bg-white/20 transition">
                  <Share2 className="w-4 h-4" />
                  Share
                </button>
              </div>
            </div>

            {/* Counter */}
            <div className="text-center text-gray-500 mt-4">
              {lightboxIndex + 1} / {filteredImages.length}
            </div>
          </div>
        </div>
      )}

      {/* Submit Photos CTA */}
      <section className="py-16 bg-soa-primary text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-2xl font-bold mb-4">Have Photos to Share?</h2>
          <p className="text-lg text-white/80 mb-6">
            Help us document the SOA movement. Submit your event photos and memories.
          </p>
          <Link
            href="https://wa.me/27762233981"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-soa-primary rounded-xl font-medium hover:bg-gray-100 transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Submit via WhatsApp
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
