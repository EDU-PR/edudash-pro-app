'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const merchandiseImages = [
  {
    src: '/images/combo.png',
    alt: 'SOA Official Merchandise - Combo Pack',
  },
  {
    src: '/images/combo1.png',
    alt: 'SOA Official Merchandise - Variant 1',
  },
];

export default function MerchandiseSlider() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Auto-play slider
  useEffect(() => {
    if (!isAutoPlaying) return;
    
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % merchandiseImages.length);
    }, 4000);
    
    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const goToPrevious = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev - 1 + merchandiseImages.length) % merchandiseImages.length);
  };

  const goToNext = () => {
    setIsAutoPlaying(false);
    setCurrentIndex((prev) => (prev + 1) % merchandiseImages.length);
  };

  const goToSlide = (index: number) => {
    setIsAutoPlaying(false);
    setCurrentIndex(index);
  };

  return (
    <div className="mt-12 max-w-4xl mx-auto">
      <div className="relative rounded-2xl overflow-hidden shadow-xl group">
        {/* Image Container */}
        <div className="relative w-full aspect-[4/3] bg-gradient-to-br from-amber-50 to-amber-100">
          {merchandiseImages.map((image, index) => (
            <div
              key={image.src}
              className={`absolute inset-0 transition-opacity duration-500 ${
                index === currentIndex ? 'opacity-100' : 'opacity-0'
              }`}
            >
              <Image
                src={image.src}
                alt={image.alt}
                fill
                className="object-contain"
                priority={index === 0}
              />
            </div>
          ))}
        </div>

        {/* Navigation Arrows */}
        <button
          onClick={goToPrevious}
          className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Previous image"
        >
          <ChevronLeft className="w-6 h-6 text-gray-800" />
        </button>
        <button
          onClick={goToNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Next image"
        >
          <ChevronRight className="w-6 h-6 text-gray-800" />
        </button>

        {/* Dots Indicator */}
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 flex gap-2">
          {merchandiseImages.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentIndex
                  ? 'bg-white w-6'
                  : 'bg-white/50 hover:bg-white/75'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>

        {/* Overlay Content */}
        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-white text-center sm:text-left">
              <h3 className="text-xl font-bold">Official SOA Merchandise</h3>
              <p className="text-white/80 text-sm">Show your pride with our exclusive collection</p>
            </div>
            <Link
              href="/order"
              className="inline-flex items-center gap-2 px-6 py-3 bg-soa-gold text-white rounded-xl font-semibold hover:bg-amber-500 transition whitespace-nowrap"
            >
              Order Now
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
