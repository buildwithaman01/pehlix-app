'use client';

import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useParams, useRouter } from 'next/navigation';
import { publicApi } from '@/lib/api/public.api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { MapPin, Phone, Search, Plus, Trash2, Calendar, Clock, CheckCircle2, FlaskConical, Stethoscope, ChevronRight, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PublicBookingPage() {
  const { labSlug } = useParams();

  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState([]);
  
  // Form State
  const [collectionType, setCollectionType] = useState('walk_in'); // walk_in or home_collection
  const [scheduledDate, setScheduledDate] = useState(new Date().toISOString().split('T')[0]);
  const [timeSlot, setTimeSlot] = useState('');
  const [patientData, setPatientData] = useState({ firstName: '', lastName: '', phone: '', age: '', gender: '' });
  const [address, setAddress] = useState({ street: '', city: '', state: '', pincode: '' });
  
  const [isSuccess, setIsSuccess] = useState(false);
  const [bookingResult, setBookingResult] = useState(null);

  // Fetch Lab Details
  const { data: labInfo, isLoading, error } = useQuery({
    queryKey: ['publicLab', labSlug],
    queryFn: () => publicApi.getLabProfile(labSlug),
    enabled: !!labSlug,
    retry: false
  });

  // Submit Booking
  const { mutate: createBooking, isPending } = useMutation({
    mutationFn: publicApi.createBooking,
    onSuccess: (data) => {
      setBookingResult(data);
      setIsSuccess(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create booking');
    }
  });

  if (isLoading) return (
    <div className="flex items-center justify-center min-h-screen bg-neutral-50">
      <Loader2 className="w-10 h-10 animate-spin text-emerald-500" />
    </div>
  );

  if (error || !labInfo) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-neutral-50 text-center p-4">
      <FlaskConical className="w-16 h-16 text-neutral-300 mb-4" />
      <h1 className="text-2xl font-bold text-neutral-800">Lab Not Found</h1>
      <p className="text-neutral-500 mt-2 max-w-md">We couldn&apos;t find the laboratory profile you&apos;re looking for. Please check the URL and try again.</p>
    </div>
  );

  const { lab, catalog } = labInfo;
  const isHomeCollectionEnabled = lab.planConfig?.modules?.homeCollections;

  // Filter Catalog
  const allItems = [...(catalog.tests || []), ...(catalog.packages || [])];
  const searchResults = allItems.filter(item => 
    item?.name?.toLowerCase()?.includes(searchQuery.toLowerCase()) || 
    (item?.code && item?.code?.toLowerCase()?.includes(searchQuery.toLowerCase()))
  ).slice(0, 5); // show top 5 results

  const addToCart = (item) => {
    if (!cart.some(i => i._id === item._id)) {
      setCart([...cart, item]);
      setSearchQuery('');
    } else {
      toast.info(`${item.name} is already in your cart`);
    }
  };

  const removeFromCart = (itemId) => {
    setCart(cart.filter(i => i._id !== itemId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.discountPrice || item.price || 0), 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (cart.length === 0) return toast.error('Please select at least one test');
    if (!patientData.firstName || !patientData.phone) return toast.error('Please provide name and phone');
    if (patientData.phone.length !== 10) return toast.error('Valid 10-digit phone number is required');
    if (collectionType === 'walk_in' && (!scheduledDate || !timeSlot)) return toast.error('Please select date and time for Walk-in');
    if (collectionType === 'home_collection' && !address.street) return toast.error('Please provide street address for home collection');

    createBooking({
      labId: lab._id,
      patientData,
      collectionType,
      tests: cart.map(t => ({ testId: t._id })),
      address: collectionType === 'home_collection' ? address : undefined,
      scheduledDate,
      timeSlot
    });
  };

  // SUCCESS STATE
  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16">
        <Card className="text-center p-8 border-emerald-100 shadow-xl shadow-emerald-500/5">
          <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-3xl font-bold text-neutral-900 mb-2">Booking Confirmed!</h1>
          <p className="text-neutral-500 mb-8">
            Your booking at <strong>{lab.name}</strong> has been successfully registered. You will receive a WhatsApp confirmation shortly.
          </p>
          
          <div className="bg-neutral-50 rounded-2xl p-6 text-left mb-8 border border-neutral-100">
            <div className="grid grid-cols-2 gap-y-4">
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Patient Name</p>
                <p className="font-medium text-neutral-900">{bookingResult?.patient?.name}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Visit ID</p>
                <p className="font-medium text-neutral-900">{bookingResult?.visitCode}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Type</p>
                <p className="font-medium text-neutral-900 capitalize">{bookingResult?.collectionType.replace('_', ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-neutral-500 uppercase tracking-wider font-semibold">Total Amount</p>
                <p className="font-bold text-emerald-600">₹{bookingResult?.totalAmount}</p>
              </div>
            </div>
          </div>

          <Button onClick={() => window.location.reload()} className="w-full h-12 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl">
            Book Another Test
          </Button>
        </Card>
      </div>
    );
  }

  // BOOKING FORM STATE
  return (
    <div className="max-w-3xl mx-auto pb-24">
      {/* 1. Header */}
      <header className="bg-white border-b border-neutral-200 px-4 py-6 text-center sticky top-0 z-10 shadow-sm">
        {lab.logoUrl ? (
          <img src={lab.logoUrl} alt={lab.name} className="h-12 mx-auto mb-3 object-contain" />
        ) : (
          <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Stethoscope className="w-6 h-6" />
          </div>
        )}
        <h1 className="text-xl font-bold text-neutral-900">{lab.name}</h1>
        <div className="flex items-center justify-center gap-4 text-sm text-neutral-500 mt-2">
          {lab.address && (
            <span className="flex items-center">
              <MapPin className="w-3.5 h-3.5 mr-1" /> 
              {[lab.address.street, lab.address.city, lab.address.state, lab.address.pincode].filter(Boolean).join(', ')}
            </span>
          )}
          {lab.phone && (
            <span className="flex items-center"><Phone className="w-3.5 h-3.5 mr-1" /> {lab.phone}</span>
          )}
        </div>
      </header>

      <form onSubmit={handleSubmit} className="px-4 mt-8 space-y-8">
        
        {/* 2. Test Selection */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center mr-2">1</span>
            Select Tests
          </h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" />
            <Input 
              placeholder="Search tests e.g., CBC, Thyroid Profile..." 
              className="pl-10 h-14 bg-white border-neutral-200 rounded-2xl text-base shadow-sm"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-lg border border-neutral-100 overflow-hidden z-20">
                {searchResults.map(item => (
                  <div 
                    key={item._id} 
                    className="p-4 hover:bg-neutral-50 border-b border-neutral-50 cursor-pointer flex justify-between items-center transition-colors"
                    onClick={() => addToCart(item)}
                  >
                    <div>
                      <h4 className="font-semibold text-neutral-900">{item.name}</h4>
                      <p className="text-xs text-neutral-500">{item.category || 'General'} • Report in {item.turnaroundTime || 24} hrs</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-bold text-emerald-600">₹{item.discountPrice || item.price}</p>
                        {item.discountPrice && <p className="text-[10px] text-neutral-400 line-through">₹{item.price}</p>}
                      </div>
                      <Plus className="w-5 h-5 text-emerald-600" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Cart */}
          {cart.length > 0 && (
            <Card className="bg-emerald-50/50 border-emerald-100 rounded-2xl">
              <CardContent className="p-4">
                <div className="space-y-3">
                  {cart.map(item => (
                    <div key={item._id} className="flex justify-between items-center bg-white p-3 rounded-xl border border-emerald-100/50 shadow-sm">
                      <span className="font-medium text-neutral-800">{item.name}</span>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-neutral-900">₹{item.discountPrice || item.price}</span>
                        <button type="button" onClick={() => removeFromCart(item._id)} className="text-red-400 hover:text-red-600 p-1">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-3 border-t border-emerald-200/50 px-2">
                    <span className="font-semibold text-neutral-700">Total Amount</span>
                    <span className="text-xl font-bold text-emerald-600">₹{totalAmount}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </section>

        {/* 3. Collection Type */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center mr-2">2</span>
            How would you like to give your sample?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div 
              onClick={() => setCollectionType('walk_in')}
              className={cn("border-2 rounded-2xl p-4 cursor-pointer transition-all relative", collectionType === 'walk_in' ? 'border-emerald-500 bg-emerald-50/30' : 'border-neutral-200 bg-white')}
            >
              <input type="radio" name="collectionType" value="walk_in" checked={collectionType === 'walk_in'} onChange={() => {}} className="sr-only" id="walk_in" />
              <Label htmlFor="walk_in" className="cursor-pointer flex flex-col gap-2">
                <span className="font-bold text-neutral-900 text-base flex items-center">
                  <span className={cn("w-4 h-4 rounded-full border flex items-center justify-center mr-3", collectionType === 'walk_in' ? 'border-emerald-500' : 'border-neutral-300')}>
                    {collectionType === 'walk_in' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                  </span>
                  Visit Lab (Walk-in)
                </span>
                <span className="text-sm text-neutral-500 font-normal ml-7">Visit our laboratory directly to give your sample.</span>
              </Label>
            </div>
            
            {isHomeCollectionEnabled && (
              <div 
                onClick={() => setCollectionType('home_collection')}
                className={cn("border-2 rounded-2xl p-4 cursor-pointer transition-all relative", collectionType === 'home_collection' ? 'border-emerald-500 bg-emerald-50/30' : 'border-neutral-200 bg-white')}
              >
                <input type="radio" name="collectionType" value="home_collection" checked={collectionType === 'home_collection'} onChange={() => {}} className="sr-only" id="home_collection" />
                <Label htmlFor="home_collection" className="cursor-pointer flex flex-col gap-2">
                  <span className="font-bold text-neutral-900 text-base flex items-center">
                    <span className={cn("w-4 h-4 rounded-full border flex items-center justify-center mr-3", collectionType === 'home_collection' ? 'border-emerald-500' : 'border-neutral-300')}>
                      {collectionType === 'home_collection' && <span className="w-2 h-2 rounded-full bg-emerald-500" />}
                    </span>
                    Home Collection
                  </span>
                  <span className="text-sm text-neutral-500 font-normal ml-7">Our expert phlebotomist will visit your home safely.</span>
                </Label>
              </div>
            )}
          </div>

          {/* Date & Time Selection */}
          <div className="grid grid-cols-2 gap-4 mt-4 p-4 bg-white rounded-2xl border border-neutral-200 shadow-sm">
            <div className="space-y-2">
              <Label className="text-neutral-600 text-xs uppercase tracking-wider">Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
                <Input 
                  type="date" 
                  className="pl-9 h-12 rounded-xl"
                  value={scheduledDate}
                  min={new Date().toISOString().split('T')[0]}
                  onChange={(e) => setScheduledDate(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-neutral-600 text-xs uppercase tracking-wider">Time Slot</Label>
              <Select value={timeSlot} onValueChange={setTimeSlot} required>
                <SelectTrigger className="h-12 rounded-xl">
                  <Clock className="w-4 h-4 mr-2 text-neutral-400" />
                  <SelectValue placeholder="Select Time" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7-9am">7:00 AM - 9:00 AM</SelectItem>
                  <SelectItem value="9-11am">9:00 AM - 11:00 AM</SelectItem>
                  <SelectItem value="11am-1pm">11:00 AM - 1:00 PM</SelectItem>
                  <SelectItem value="2-4pm">2:00 PM - 4:00 PM</SelectItem>
                  <SelectItem value="4-6pm">4:00 PM - 6:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </section>

        {/* 4. Patient Details */}
        <section className="space-y-4">
          <h2 className="text-lg font-bold text-neutral-900 flex items-center">
            <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 text-xs flex items-center justify-center mr-2">3</span>
            Patient Details
          </h2>
          <div className="bg-white p-5 rounded-2xl border border-neutral-200 shadow-sm space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>First Name *</Label>
                <Input 
                  className="h-12 rounded-xl bg-neutral-50"
                  value={patientData.firstName}
                  onChange={(e) => setPatientData({...patientData, firstName: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input 
                  className="h-12 rounded-xl bg-neutral-50"
                  value={patientData.lastName}
                  onChange={(e) => setPatientData({...patientData, lastName: e.target.value})}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mobile Number * (For WhatsApp Reports)</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500 font-medium">+91</span>
                <Input 
                  type="tel"
                  maxLength={10}
                  className="pl-12 h-12 rounded-xl bg-neutral-50"
                  value={patientData.phone}
                  onChange={(e) => setPatientData({...patientData, phone: e.target.value.replace(/\D/g, '')})}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Age *</Label>
                <Input 
                  type="number"
                  className="h-12 rounded-xl bg-neutral-50"
                  value={patientData.age}
                  onChange={(e) => setPatientData({...patientData, age: e.target.value})}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Gender *</Label>
                <Select value={patientData.gender} onValueChange={(val) => setPatientData({...patientData, gender: val})} required>
                  <SelectTrigger className="h-12 rounded-xl bg-neutral-50">
                    <SelectValue placeholder="Gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="male">Male</SelectItem>
                    <SelectItem value="female">Female</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Address field for home collection */}
            {collectionType === 'home_collection' && (
              <div className="space-y-4 pt-4 border-t border-neutral-100">
                <div className="space-y-2">
                  <Label>House/Flat No & Street Name *</Label>
                  <Input 
                    className="h-12 rounded-xl bg-neutral-50"
                    placeholder="E.g., Flat 402, Royal Apartments, MG Road"
                    value={address.street}
                    onChange={(e) => setAddress({...address, street: e.target.value})}
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>City</Label>
                    <Input 
                      className="h-12 rounded-xl bg-neutral-50"
                      value={address.city}
                      onChange={(e) => setAddress({...address, city: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Pincode</Label>
                    <Input 
                      className="h-12 rounded-xl bg-neutral-50"
                      maxLength={6}
                      value={address.pincode}
                      onChange={(e) => setAddress({...address, pincode: e.target.value.replace(/\D/g, '')})}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 5. Submit Button */}
        <div className="pt-6 sticky bottom-4 z-20">
          <Button 
            type="submit" 
            size="lg" 
            className="w-full h-14 rounded-2xl bg-neutral-900 hover:bg-neutral-800 text-white text-lg shadow-xl shadow-neutral-900/20"
            disabled={isPending || cart.length === 0}
          >
            {isPending ? (
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ) : (
              <span className="flex items-center justify-between w-full px-2">
                <span>Confirm Booking</span>
                <span className="flex items-center font-bold">₹{totalAmount} <ChevronRight className="w-5 h-5 ml-2" /></span>
              </span>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
