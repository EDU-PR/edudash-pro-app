'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { Header, Footer } from '@/components';
import { FadeIn, SlideIn, ScaleIn, StaggerChildren } from '@/components/animations';
import {
  ShoppingBag,
  Package,
  Truck,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Minus,
  Plus,
  MessageCircle,
} from 'lucide-react';

// Product data with multiple images for each variant
const products = [
  {
    id: 'combo',
    name: 'SOA Combo Pack',
    description: 'Official T-Shirt + Cap bundle - Best Value!',
    price: 300,
    images: ['/images/combo.png', '/images/combo1.png'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    popular: true,
  },
  {
    id: 'tshirt',
    name: 'SOA T-Shirt',
    description: 'Official branded T-Shirt with SOA logo',
    price: 200,
    images: ['/images/combo1.png', '/images/combo.png'],
    sizes: ['S', 'M', 'L', 'XL', 'XXL'],
    popular: false,
  },
  {
    id: 'cap',
    name: 'SOA Cap',
    description: 'Official branded Cap with embroidered logo',
    price: 150,
    images: ['/images/combo.png', '/images/combo1.png'],
    sizes: ['One Size'],
    popular: false,
  },
];

interface OrderItem {
  productId: string;
  size: string;
  quantity: number;
}

// Product image slider state
interface ProductImageState {
  [productId: string]: number;
}

export default function OrderPage() {
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<Record<string, string>>({});
  const [productImageIndex, setProductImageIndex] = useState<ProductImageState>({});
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    province: '',
    postalCode: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const addToOrder = (productId: string) => {
    const size = selectedSizes[productId] || products.find(p => p.id === productId)?.sizes[0] || '';
    const existingItem = orderItems.find(item => item.productId === productId && item.size === size);
    
    if (existingItem) {
      setOrderItems(orderItems.map(item => 
        item.productId === productId && item.size === size
          ? { ...item, quantity: item.quantity + 1 }
          : item
      ));
    } else {
      setOrderItems([...orderItems, { productId, size, quantity: 1 }]);
    }
  };

  const updateQuantity = (productId: string, size: string, delta: number) => {
    setOrderItems(orderItems.map(item => {
      if (item.productId === productId && item.size === size) {
        const newQuantity = item.quantity + delta;
        return newQuantity > 0 ? { ...item, quantity: newQuantity } : item;
      }
      return item;
    }).filter(item => item.quantity > 0));
  };

  const removeItem = (productId: string, size: string) => {
    setOrderItems(orderItems.filter(item => !(item.productId === productId && item.size === size)));
  };

  const getOrderTotal = () => {
    return orderItems.reduce((total, item) => {
      const product = products.find(p => p.id === item.productId);
      return total + (product?.price || 0) * item.quantity;
    }, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (orderItems.length === 0) return;

    setIsSubmitting(true);

    // Build WhatsApp message
    const orderDetails = orderItems.map(item => {
      const product = products.find(p => p.id === item.productId);
      return `- ${product?.name} (${item.size}) x${item.quantity} = R${(product?.price || 0) * item.quantity}`;
    }).join('\n');

    const message = `🛒 *New SOA Merchandise Order*

*Customer Details:*
Name: ${formData.fullName}
Email: ${formData.email}
Phone: ${formData.phone}

*Delivery Address:*
${formData.address}
${formData.city}, ${formData.province}
${formData.postalCode}

*Order Items:*
${orderDetails}

*Total: R${getOrderTotal()}*

${formData.notes ? `Notes: ${formData.notes}` : ''}`;

    // Open WhatsApp with order
    const whatsappUrl = `https://wa.me/27762233981?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

  if (isSubmitted) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="pt-24 pb-16">
          <div className="max-w-2xl mx-auto px-4 text-center">
            <ScaleIn>
              <div className="bg-white rounded-2xl shadow-lg p-8">
                <motion.div 
                  className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.2 }}
                >
                  <CheckCircle2 className="w-8 h-8 text-green-600" />
                </motion.div>
                <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Submitted!</h1>
              <p className="text-gray-600 mb-6">
                Your order has been sent via WhatsApp. Our team will contact you shortly to confirm your order and arrange payment.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-soa-primary text-white rounded-xl font-semibold hover:bg-soa-dark transition"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Home
                </Link>
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setOrderItems([]);
                    setFormData({
                      fullName: '',
                      email: '',
                      phone: '',
                      address: '',
                      city: '',
                      province: '',
                      postalCode: '',
                      notes: '',
                    });
                  }}
                  className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-xl font-semibold hover:bg-gray-200 transition"
                >
                  Place Another Order
                </button>
              </div>
              </div>
            </ScaleIn>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />

      {/* Hero */}
      <section className="pt-24 pb-8 bg-gradient-to-br from-soa-primary to-soa-dark text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 text-white/80 hover:text-white mb-4 transition">
            <ChevronLeft className="w-4 h-4" />
            Back to Home
          </Link>
          <FadeIn>
            <div className="flex items-center gap-3 mb-2">
              <ShoppingBag className="w-8 h-8" />
              <h1 className="text-3xl sm:text-4xl font-bold">Order Merchandise</h1>
            </div>
          </FadeIn>
          <SlideIn direction="up" delay={0.1}>
            <p className="text-lg text-white/80">
              Get your official Soil of Africa merchandise delivered to your door
            </p>
          </SlideIn>
        </div>
      </section>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* Products */}
          <div className="lg:col-span-2 space-y-6">
            <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5 text-soa-primary" />
              Available Products
            </h2>

            <div className="grid sm:grid-cols-2 gap-6">
              {products.map((product, index) => {
                const currentImageIndex = productImageIndex[product.id] || 0;
                const currentImage = product.images[currentImageIndex];
                
                return (
                  <motion.div 
                    key={product.id} 
                    className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ y: -5 }}
                  >
                    {/* Popular Badge */}
                    {product.popular && (
                      <div className="absolute top-3 left-3 z-10 px-2 py-1 bg-soa-gold text-white text-xs font-bold rounded-full">
                        BEST VALUE
                      </div>
                    )}
                    
                    {/* Image Slider */}
                    <div className="aspect-video relative bg-gray-100 group">
                      <Image
                        src={currentImage}
                        alt={product.name}
                        fill
                        className="object-cover"
                      />
                      
                      {/* Image Navigation Arrows */}
                      {product.images.length > 1 && (
                        <>
                          <button
                            onClick={() => setProductImageIndex({
                              ...productImageIndex,
                              [product.id]: (currentImageIndex - 1 + product.images.length) % product.images.length
                            })}
                            className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronLeft className="w-4 h-4 text-gray-800" />
                          </button>
                          <button
                            onClick={() => setProductImageIndex({
                              ...productImageIndex,
                              [product.id]: (currentImageIndex + 1) % product.images.length
                            })}
                            className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-white/90 hover:bg-white rounded-full flex items-center justify-center shadow opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <ChevronRight className="w-4 h-4 text-gray-800" />
                          </button>
                          
                          {/* Image Dots */}
                          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                            {product.images.map((_, index) => (
                              <button
                                key={index}
                                onClick={() => setProductImageIndex({ ...productImageIndex, [product.id]: index })}
                                className={`w-2 h-2 rounded-full transition-all ${
                                  index === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'
                                }`}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    
                    <div className="p-4">
                      <h3 className="font-bold text-gray-900">{product.name}</h3>
                      <p className="text-sm text-gray-600 mb-2">{product.description}</p>
                      <p className="text-lg font-bold text-soa-primary mb-3">R{product.price}</p>
                    
                    {/* Size Selector */}
                    <div className="mb-3">
                      <label className="text-xs text-gray-500 mb-1 block">Size</label>
                      <div className="flex flex-wrap gap-2">
                        {product.sizes.map((size) => (
                          <button
                            key={size}
                            onClick={() => setSelectedSizes({ ...selectedSizes, [product.id]: size })}
                            className={`px-3 py-1 text-sm rounded-lg border transition ${
                              (selectedSizes[product.id] || product.sizes[0]) === size
                                ? 'bg-soa-primary text-white border-soa-primary'
                                : 'bg-white text-gray-700 border-gray-200 hover:border-soa-primary'
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                    </div>

                    <button
                      onClick={() => addToOrder(product.id)}
                      className="w-full py-2 bg-soa-gold text-white rounded-lg font-semibold hover:bg-amber-500 transition"
                    >
                      Add to Order
                    </button>
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Delivery Info */}
            <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <Truck className="w-5 h-5 text-blue-600 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-900">Delivery Information</h4>
                  <p className="text-sm text-blue-700">
                    Orders are delivered nationwide. Delivery fees will be calculated based on your location and confirmed via WhatsApp.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Order Summary & Form */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 sticky top-24">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Your Order</h2>

              {orderItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Your order is empty</p>
                  <p className="text-sm">Add items to get started</p>
                </div>
              ) : (
                <>
                  {/* Order Items */}
                  <div className="space-y-3 mb-4">
                    {orderItems.map((item) => {
                      const product = products.find(p => p.id === item.productId);
                      return (
                        <div key={`${item.productId}-${item.size}`} className="flex items-center justify-between gap-3 py-2 border-b border-gray-100">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-gray-900 truncate">{product?.name}</p>
                            <p className="text-xs text-gray-500">Size: {item.size}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => updateQuantity(item.productId, item.size, -1)}
                              className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                            <button
                              onClick={() => updateQuantity(item.productId, item.size, 1)}
                              className="w-6 h-6 rounded bg-gray-100 flex items-center justify-center hover:bg-gray-200"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>
                          <p className="font-semibold text-gray-900 w-16 text-right">
                            R{(product?.price || 0) * item.quantity}
                          </p>
                        </div>
                      );
                    })}
                  </div>

                  {/* Total */}
                  <div className="flex justify-between items-center py-3 border-t border-gray-200 mb-6">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-xl font-bold text-soa-primary">R{getOrderTotal()}</span>
                  </div>

                  {/* Order Form */}
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Full Name *</label>
                      <input
                        type="text"
                        required
                        value={formData.fullName}
                        onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                      <input
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                      <input
                        type="tel"
                        required
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Street Address *</label>
                      <input
                        type="text"
                        required
                        value={formData.address}
                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                        <input
                          type="text"
                          required
                          value={formData.city}
                          onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
                        <select
                          required
                          value={formData.province}
                          onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                        >
                          <option value="">Select</option>
                          <option value="Gauteng">Gauteng</option>
                          <option value="Western Cape">Western Cape</option>
                          <option value="KwaZulu-Natal">KwaZulu-Natal</option>
                          <option value="Eastern Cape">Eastern Cape</option>
                          <option value="Free State">Free State</option>
                          <option value="Limpopo">Limpopo</option>
                          <option value="Mpumalanga">Mpumalanga</option>
                          <option value="North West">North West</option>
                          <option value="Northern Cape">Northern Cape</option>
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Postal Code *</label>
                      <input
                        type="text"
                        required
                        value={formData.postalCode}
                        onChange={(e) => setFormData({ ...formData, postalCode: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Order Notes (Optional)</label>
                      <textarea
                        rows={2}
                        value={formData.notes}
                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Any special instructions..."
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-soa-primary focus:border-transparent"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting || orderItems.length === 0}
                      className="w-full py-3 bg-soa-primary text-white rounded-xl font-semibold hover:bg-soa-dark transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                      <MessageCircle className="w-5 h-5" />
                      {isSubmitting ? 'Sending...' : 'Complete Order via WhatsApp'}
                    </button>

                    <p className="text-xs text-gray-500 text-center">
                      Your order will be sent via WhatsApp. Payment details will be provided after confirmation.
                    </p>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  );
}
