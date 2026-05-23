'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '@/lib/api/extended.api';
import PageHeader from '@/components/shared/PageHeader';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { 
  Volume2, 
  Send, 
  Users, 
  MessageSquare, 
  Building2, 
  MapPin, 
  Megaphone,
  CheckCircle,
  HelpCircle
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AnnouncementsPage() {
  const [targetType, setTargetType] = useState('all');
  const [selectedPlan, setSelectedPlan] = useState('starter');
  const [selectedStatus, setSelectedStatus] = useState('active');
  const [targetCity, setTargetCity] = useState('');
  const [selectedLabs, setSelectedLabs] = useState([]);
  const [channels, setChannels] = useState(['inapp']);
  const [message, setMessage] = useState('');
  const [isSending, setIsSending] = useState(false);

  // Queries
  const { data: labsData, isLoading: isLabsLoading } = useQuery({
    queryKey: ['labsListForAnnouncements'],
    queryFn: () => adminApi.getLabs({ limit: 100 }),
  });
  const labs = labsData?.labs || [];

  // Mutations
  const sendAnnouncementMutation = useMutation({
    mutationFn: adminApi.sendAnnouncement,
    onSuccess: (data) => {
      toast.success(`Announcement dispatched successfully to ${data.sent} laboratory owners!`);
      setMessage('');
      setSelectedLabs([]);
      setIsSending(false);
    },
    onError: (err) => {
      toast.error(err?.response?.data?.message || 'Failed to dispatch announcement');
      setIsSending(false);
    }
  });

  const handleChannelToggle = (channel) => {
    if (channels.includes(channel)) {
      if (channels.length > 1) {
        setChannels(channels.filter(c => c !== channel));
      } else {
        toast.warning('At least one delivery channel is required.');
      }
    } else {
      setChannels([...channels, channel]);
    }
  };

  const handleLabToggle = (labId) => {
    if (selectedLabs.includes(labId)) {
      setSelectedLabs(selectedLabs.filter(id => id !== labId));
    } else {
      setSelectedLabs([...selectedLabs, labId]);
    }
  };

  const calculateTargetCount = () => {
    if (!labs || labs.length === 0) return 0;

    let targetCount = 0;
    if (targetType === 'all') {
      targetCount = labs.filter(l => l.isActive && !l.isSuspended).length;
    } else if (targetType === 'plan') {
      targetCount = labs.filter(l => l.isActive && !l.isSuspended && l.plan === selectedPlan).length;
    } else if (targetType === 'status') {
      targetCount = labs.filter(l => l.isActive && !l.isSuspended && l.billing?.status === selectedStatus).length;
    } else if (targetType === 'city') {
      targetCount = labs.filter(l => 
        l.isActive && 
        !l.isSuspended && 
        l.address?.city && 
        l.address.city.toLowerCase().includes(targetCity.toLowerCase())
      ).length;
    } else if (targetType === 'specific') {
      targetCount = selectedLabs.length;
    }

    return targetCount;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!message || message.trim() === '') {
      toast.error('Announcement message cannot be empty');
      return;
    }

    const targetCount = calculateTargetCount();
    if (targetCount === 0) {
      toast.error('No laboratories found matching target criteria');
      return;
    }

    // Build target payload
    let target = { type: targetType };
    if (targetType === 'plan') {
      target.plan = selectedPlan;
    } else if (targetType === 'status') {
      target.status = selectedStatus;
    } else if (targetType === 'city') {
      if (!targetCity || targetCity.trim() === '') {
        toast.error('City name is required');
        return;
      }
      target.city = targetCity;
    } else if (targetType === 'specific') {
      if (selectedLabs.length === 0) {
        toast.error('Please select at least one laboratory');
        return;
      }
      target.labIds = selectedLabs;
    }

    setIsSending(true);
    sendAnnouncementMutation.mutate({
      target,
      channel: channels,
      message: message.trim()
    });
  };

  const targetCount = calculateTargetCount();

  return (
    <div className="space-y-6 font-satoshi max-w-4xl mx-auto">
      <PageHeader 
        title="Send Announcements" 
        subtitle="Broadcast emergency server updates, system alerts, or billing announcements to your clients."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Composer */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 md:col-span-2 shadow-sm space-y-5">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Megaphone className="w-5 h-5 text-emerald-deep" />
            <h3 className="font-bold text-neutral-800 text-base">Announcement Composer</h3>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Target Audience type */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-neutral-700">Target Audience</Label>
              <Select value={targetType} onValueChange={(val) => { setTargetType(val); setSelectedLabs([]); }}>
                <SelectTrigger className="rounded-xl border-neutral-200 text-[#1E1E1E]">
                  <SelectValue placeholder="Select Target Audience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Broadcast to All Active Labs</SelectItem>
                  <SelectItem value="plan">Filter by Subscription Plan</SelectItem>
                  <SelectItem value="status">Filter by Billing Status</SelectItem>
                  <SelectItem value="city">Filter by Location / City</SelectItem>
                  <SelectItem value="specific">Select Specific Laboratories</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Target Criteria input dynamic panels */}
            {targetType === 'plan' && (
              <div className="space-y-1.5 p-4 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <Label htmlFor="planSelect" className="text-xs font-semibold text-neutral-600">Select Plan Tier</Label>
                <Select value={selectedPlan} onValueChange={setSelectedPlan}>
                  <SelectTrigger id="planSelect" className="rounded-xl border-neutral-200 text-[#1E1E1E] bg-white mt-1">
                    <SelectValue placeholder="Select Plan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="starter">Starter Plan</SelectItem>
                    <SelectItem value="growth">Growth Plan</SelectItem>
                    <SelectItem value="pro">Pro Plan</SelectItem>
                    <SelectItem value="custom">Custom Plan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === 'status' && (
              <div className="space-y-1.5 p-4 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <Label htmlFor="statusSelect" className="text-xs font-semibold text-neutral-600">Select Billing Status</Label>
                <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                  <SelectTrigger id="statusSelect" className="rounded-xl border-neutral-200 text-[#1E1E1E] bg-white mt-1">
                    <SelectValue placeholder="Select Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active Subscription</SelectItem>
                    <SelectItem value="trial">Trial Period</SelectItem>
                    <SelectItem value="grace">Grace Period</SelectItem>
                    <SelectItem value="suspended">Suspended</SelectItem>
                    <SelectItem value="expired">Expired</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {targetType === 'city' && (
              <div className="space-y-1.5 p-4 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <Label htmlFor="cityInput" className="text-xs font-semibold text-neutral-600">Target City</Label>
                <Input
                  id="cityInput"
                  required
                  placeholder="e.g. Mumbai"
                  value={targetCity}
                  onChange={(e) => setTargetCity(e.target.value)}
                  className="rounded-xl border-neutral-200 text-[#1E1E1E] bg-white mt-1"
                />
              </div>
            )}

            {targetType === 'specific' && (
              <div className="space-y-1.5 p-4 rounded-xl bg-neutral-50/50 border border-neutral-100">
                <Label className="text-xs font-semibold text-neutral-600 block mb-2">Select Target Laboratories</Label>
                <div className="border border-neutral-200 rounded-xl max-h-[160px] overflow-y-auto p-3 space-y-2 bg-white">
                  {isLabsLoading ? (
                    <p className="text-xs text-neutral-400 text-center py-4">Loading labs...</p>
                  ) : labs.length === 0 ? (
                    <p className="text-xs text-neutral-400 text-center py-4">No active laboratories found</p>
                  ) : (
                    labs.filter(l => l.isActive && !l.isSuspended).map((lab) => (
                      <div key={lab._id} className="flex items-center gap-3 text-xs">
                        <input 
                          type="checkbox"
                          id={`lab-${lab._id}`}
                          checked={selectedLabs.includes(lab._id)}
                          onChange={() => handleLabToggle(lab._id)}
                          className="rounded border-neutral-300 accent-emerald-deep w-4 h-4 cursor-pointer"
                        />
                        <label htmlFor={`lab-${lab._id}`} className="font-semibold text-neutral-700 cursor-pointer select-none">
                          {lab.name} <span className="font-normal text-neutral-400">({lab.address?.city || 'N/A'})</span>
                        </label>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Channels Selection */}
            <div className="space-y-2">
              <Label className="text-sm font-medium text-neutral-700">Delivery Channels</Label>
              <div className="grid grid-cols-2 gap-4">
                {/* In-app channel */}
                <button
                  type="button"
                  onClick={() => handleChannelToggle('inapp')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all",
                    channels.includes('inapp') 
                      ? "border-emerald-deep bg-emerald-50/20 text-[#1E1E1E] font-semibold" 
                      : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-500"
                  )}
                >
                  <Megaphone className="w-5 h-5" />
                  <span className="text-xs">In-App Alert Drawer</span>
                </button>

                {/* WhatsApp channel */}
                <button
                  type="button"
                  onClick={() => handleChannelToggle('whatsapp')}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3.5 rounded-xl border text-center transition-all",
                    channels.includes('whatsapp') 
                      ? "border-emerald-deep bg-emerald-50/20 text-[#1E1E1E] font-semibold" 
                      : "border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-500"
                  )}
                >
                  <MessageSquare className="w-5 h-5" />
                  <span className="text-xs">WhatsApp Push Notification</span>
                </button>
              </div>
            </div>

            {/* Announcement Message */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <Label htmlFor="announcementMsg" className="text-sm font-medium text-neutral-700">Broadcast Message</Label>
                <span className="text-[10px] text-neutral-400">{message.length}/1000 chars</span>
              </div>
              <Textarea
                id="announcementMsg"
                required
                maxLength={1000}
                placeholder="Write your announcement details here..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                className="rounded-xl border-neutral-200 text-[#1E1E1E]"
              />
            </div>

            <Button
              type="submit"
              disabled={isSending}
              className="w-full bg-[#0F3D3E] hover:bg-[#0a2e2f] text-white rounded-xl py-3 flex items-center justify-center gap-2 font-semibold"
            >
              <Send className="w-4 h-4" />
              {isSending ? 'Dispatching...' : 'Dispatch Announcement'}
            </Button>
          </form>
        </div>

        {/* Audience Summary Card */}
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-sm h-fit space-y-4">
          <div className="flex items-center gap-2 border-b border-neutral-100 pb-3">
            <Users className="w-5 h-5 text-emerald-deep" />
            <h3 className="font-bold text-neutral-800 text-base">Audience Summary</h3>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-neutral-500">Target Type</span>
              <Badge className="capitalize text-[10px] bg-neutral-100 text-neutral-800 border border-neutral-200">
                {targetType === 'all' ? 'All Active Labs' : targetType}
              </Badge>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-xs text-neutral-500">Selected Channels</span>
              <span className="text-xs font-semibold capitalize text-[#1E1E1E]">
                {channels.join(', ')}
              </span>
            </div>

            <div className="flex items-center justify-between border-t border-neutral-100 pt-3">
              <span className="text-xs text-neutral-500">Deliverable Count</span>
              <div className="flex items-center gap-1.5 font-bold text-emerald-700 text-sm">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                {targetCount} {targetCount === 1 ? 'lab' : 'labs'}
              </div>
            </div>

            <div className="bg-neutral-50 rounded-xl p-3 border border-neutral-100 text-[10px] text-neutral-500 space-y-1.5">
              <h4 className="font-semibold text-neutral-700 flex items-center gap-1">
                <HelpCircle className="w-3.5 h-3.5" />
                What happens next?
              </h4>
              <p>
                In-app notifications are published immediately. WhatsApp messages are dispatched in parallel to the registered laboratory owner's phone number.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
