import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  PhoneCall,
  MapPin,
  Battery,
  Wifi,
  Navigation,
  CheckCircle2,
  AlertTriangle,
  ShieldCheck,
  ArrowLeft,
  QrCode,
  Download,
  Copy,
  User,
  FileCheck,
  KeyRound,
  ExternalLink,
  Check,
  X,
  Smartphone,
  LogOut,
  RefreshCw,
  Radio,
  Clock,
  Shield,
  MessageSquare,
  Calendar,
  Map,
  Plus,
  Bell,
  Volume2,
  VolumeX,
  Phone,
  ChevronUp,
  Globe,
  Compass,
  AlertCircle,
  Send,
  Hotel,
  Bot,
  Loader2,
  Edit3,
  Search,
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { Language, TouristProfile, ItineraryItem, ChatMessage, BroadcastAlert, GeoFenceZone, SosStepState } from '../types';
import { i18n } from '../data/i18n';
import { POLICE_STATIONS, INITIAL_TOURISTS, INITIAL_BROADCASTS, MOCK_GEOFENCE_ZONES } from '../data/mockData';
import { ActualGoogleMap } from './ActualGoogleMap';
import { CrowdHeatmap } from './CrowdHeatmap';
import { getSOSLocation, getLiveLocation } from '../lib/location';
import { queueSOSRecord, saveLastKnownLocation } from '../lib/db';
import { submitSOSOnline, syncQueuedSOS, sendLocationPingAPI } from '../lib/api';


interface TouristPortalProps {
  language: Language;
  onLanguageChange?: (lang: Language) => void;
  onTriggerSos: (touristName: string, locationStr: string) => void;
  onReturnToGateway: () => void;
  onRegisterTourist?: (tourist: TouristProfile) => void;
  existingTourists?: TouristProfile[];
}

export const TouristPortal: React.FC<TouristPortalProps> = ({
  language,
  onLanguageChange,
  onTriggerSos,
  onReturnToGateway,
  onRegisterTourist,
  existingTourists = INITIAL_TOURISTS
}) => {
  const t = i18n[language];

  // Auth & Session States
  const [authTab, setAuthTab] = useState<'signin' | 'signup'>('signin');
  const [authenticatedUser, setAuthenticatedUser] = useState<TouristProfile | null>(null);
  const [locationConsent, setLocationConsent] = useState<'granted' | 'declined' | null>(null);

  // Active Dashboard Tab
  const [activeTab, setActiveTab] = useState<'overview' | 'itinerary' | 'heatmap' | 'route_finder'>('overview');

  // Modals & Drawers
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [showDigitalPassModal, setShowDigitalPassModal] = useState(false);
  const [showDigiLockerModal, setShowDigiLockerModal] = useState(false);
  const [showContactsDrawer, setShowContactsDrawer] = useState(false);
  const [showAddItineraryModal, setShowAddItineraryModal] = useState(false);

  // Real-time Geofenced Broadcast Alert Modal State
  const [activeBroadcastModal, setActiveBroadcastModal] = useState<BroadcastAlert | null>(null);

  // Sign Up Form States
  const [fullName, setFullName] = useState('Elena Rostova');
  const [phone, setPhone] = useState('+91 98765 43210');
  const [email, setEmail] = useState('elena.rostova@traveler.org');
  const [emergencyContactName, setEmergencyContactName] = useState('Carlos Rostova');
  const [emergencyRelation, setEmergencyRelation] = useState('Father');
  const [emergencyContactPhone, setEmergencyContactPhone] = useState('+91 98765 00000');

  // DigiLocker States
  const [digiLockerVerified, setDigiLockerVerified] = useState(false);
  const [digiLockerLoading, setDigiLockerLoading] = useState(false);
  const [digiLockerStep, setDigiLockerStep] = useState<'connect' | 'loading' | 'fetched'>('connect');

  // Sign In Form States
  const [signinTouristId, setSigninTouristId] = useState('TR-88219');
  const [signinPhone, setSigninPhone] = useState('+34 612 884 902');

  // OTP Modal States
  const [otpValue, setOtpValue] = useState('654321');
  const [otpError, setOtpError] = useState('');
  const [otpPendingAction, setOtpPendingAction] = useState<'signup' | 'signin'>('signup');

  // Copy / Download Feedback Toasts
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Emergency SOS Panic Trigger State
  const [sosActive, setSosActive] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [batteryLevel] = useState(84);
  const [currentAddress, setCurrentAddress] = useState('Solang Valley North Trail, Kullu, Himachal Pradesh');
  const [lat, setLat] = useState(32.2432);
  const [lng, setLng] = useState(77.1892);
  const [sirenPlaying, setSirenPlaying] = useState(false);
  const [locationAcquiring, setLocationAcquiring] = useState(false);
  const [locationFeedbackMessage, setLocationFeedbackMessage] = useState<string | null>(null);
  const [mapSearchQuery, setMapSearchQuery] = useState('');

  // Integrated Multi-Step SOS Flow States
  const [sosStep, setSosStep] = useState<SosStepState>('ready');
  const [sosSendingProgress, setSosSendingProgress] = useState(0);
  const [incidentRef, setIncidentRef] = useState<string | null>(null);
  const [sosErrorMessage, setSosErrorMessage] = useState<string | null>(null);

  // Integrated Geo-Fence States
  const [activeGeoFenceZone, setActiveGeoFenceZone] = useState<GeoFenceZone>(MOCK_GEOFENCE_ZONES[0]); // Solang Valley (Unsafe)

  const handleStartSosConfirmation = () => {
    setSosStep('confirming');
  };

  const handleExecuteSosSend = async (forceError = false) => {
    setSosStep('sending');
    setSosSendingProgress(15);
    setSosErrorMessage(null);

    try {
      // 1. Resolve Location
      const loc = await getSOSLocation();
      setSosSendingProgress(40);

      // 2. Build local SOS record
      const localRecord = {
        local_sos_id: crypto.randomUUID(),
        tourist_id: authenticatedUser?.id || 'TR-88219',
        triggered_at: new Date().toISOString(),
        latitude: loc.latitude,
        longitude: loc.longitude,
        accuracy: loc.accuracy,
        location_source: loc.location_source,
        description: `Emergency SOS Alert (${loc.location_source})`,
        severity: 'HIGH',
        status: 'QUEUED_OFFLINE'
      };

      // 3. Save to IndexedDB
      await queueSOSRecord(localRecord);
      setSosSendingProgress(60);

      if (forceError) {
        throw new Error('Network signal drop detected in Solang valley sector. Local relay timeout.');
      }

      // 4. Try online transmission
      if (navigator.onLine) {
        setSosSendingProgress(85);
        try {
          const res = await submitSOSOnline(localRecord);
          setSosSendingProgress(100);
          setSosStep('success');
          setIncidentRef(res.incident_id || res.sos_id || `INC-${Math.floor(1000 + Math.random() * 9000)}`);
          setSosActive(true);
          onTriggerSos(authenticatedUser?.name || 'Elena Rostova', `${loc.latitude?.toFixed(4) || lat.toFixed(4)}, ${loc.longitude?.toFixed(4) || lng.toFixed(4)} (${activeGeoFenceZone.name})`);
        } catch (err: any) {
          console.warn("Online transmission failed, record queued:", err);
          setSosSendingProgress(100);
          setSosStep('success');
          setIncidentRef('QUEUED-OFFLINE');
          setSosActive(true);
          onTriggerSos(authenticatedUser?.name || 'Elena Rostova', `${loc.latitude?.toFixed(4) || lat.toFixed(4)}, ${loc.longitude?.toFixed(4) || lng.toFixed(4)} (Queued Offline)`);
        }
      } else {
        setSosSendingProgress(100);
        setSosStep('success');
        setIncidentRef('QUEUED-OFFLINE');
        setSosActive(true);
        onTriggerSos(authenticatedUser?.name || 'Elena Rostova', `${loc.latitude?.toFixed(4) || lat.toFixed(4)}, ${loc.longitude?.toFixed(4) || lng.toFixed(4)} (Queued Offline)`);
      }
    } catch (err: any) {
      setSosStep('error');
      setSosErrorMessage(err.message || 'Failed to trigger SOS');
    }
  };

  const handleResetSosFlow = () => {
    setSosStep('ready');
    setSosActive(false);
    setSirenPlaying(false);
    setIncidentRef(null);
    setSosErrorMessage(null);
    setSosSendingProgress(0);
  };


  // Floating Chatbot Widget States
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      sender: 'bot',
      text: 'Namaste! I am Suraksha AI Safety Assistant. How can I assist with your safety, route advice, or emergency info in Himachal Pradesh today?',
      timestamp: 'Just now',
      quickActions: [
        'Is Solang Valley safe right now?',
        'Emergency hotlines in Manali',
        'Altitude sickness tips',
        'Nearest hospital'
      ]
    }
  ]);

  // Itinerary Planner Items State
  const [itinerary, setItinerary] = useState<ItineraryItem[]>([
    {
      id: 'itin-1',
      destination: 'Solang Valley Adventure & Ski Resort',
      date: '2026-08-12',
      hotel: 'Solang Resort & Spa, Manali',
      activities: 'Trekking, Ropeway, Paragliding',
      safetyStatus: 'Safe Corridor',
      coordinates: { lat: 32.2432, lng: 77.1892 }
    },
    {
      id: 'itin-2',
      destination: 'Atal Tunnel North Portal & Sissu Valley',
      date: '2026-08-13',
      hotel: 'Sissu Alpine Retreat',
      activities: 'Scenic mountain drive, Waterfall visit',
      safetyStatus: 'Weather Advisory',
      coordinates: { lat: 32.3582, lng: 77.1625 }
    },
    {
      id: 'itin-3',
      destination: 'Manikaran Sahib & Kasol Valley',
      date: '2026-08-14',
      hotel: 'Kasol Riverside Lodge',
      activities: 'Hot springs, Local pilgrimage, Parvati Valley',
      safetyStatus: 'Safe Corridor',
      coordinates: { lat: 32.0272, lng: 77.3488 }
    }
  ]);

  // New Itinerary Form State
  const [newDest, setNewDest] = useState('');
  const [newDate, setNewDate] = useState('2026-08-15');
  const [newHotel, setNewHotel] = useState('');
  const [newActivities, setNewActivities] = useState('');

  // Modify Itinerary Form State
  const [showEditItineraryModal, setShowEditItineraryModal] = useState(false);
  const [editingItineraryItem, setEditingItineraryItem] = useState<ItineraryItem | null>(null);
  const [editDest, setEditDest] = useState('');
  const [editDate, setEditDate] = useState('2026-08-15');
  const [editHotel, setEditHotel] = useState('');
  const [editActivities, setEditActivities] = useState('');
  const [itineraryToast, setItineraryToast] = useState<string | null>(null);

  // Add destination to Itinerary from Crowd Heatmap recommendation
  const handleAddItineraryDestination = (destName: string) => {
    const newItem: ItineraryItem = {
      id: `itin-${Date.now()}`,
      destination: destName,
      date: '2026-08-16',
      hotel: 'Verified Safe Hotel / Guesthouse',
      activities: 'Scenic sightseeing, low crowd density area',
      safetyStatus: 'Safe Corridor',
      coordinates: { lat: 32.2432, lng: 77.1892 }
    };
    setItinerary((prev) => [...prev, newItem]);
  };

  // Heatmap Filter State
  const [heatmapFilter, setHeatmapFilter] = useState<'all' | 'high' | 'safe' | 'advisory'>('all');

  // Route Finder States
  const [routeOrigin, setRouteOrigin] = useState('Manali Town');
  const [routeDest, setRouteDest] = useState('Sissu / Lahaul Valley');
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);

  // SOS Countdown timer & Online Sync Event
  useEffect(() => {
    let timer: any = null;
    if (countdown !== null && countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => (prev !== null && prev > 1 ? prev - 1 : 0));
      }, 1000);
    } else if (countdown === 0) {
      // Execute the real SOS send if countdown hits zero instead of doing it immediately.
      handleExecuteSosSend(false);
      setCountdown(null);
      setSirenPlaying(true);
    }

    const handleOnline = () => {
      console.log('Network connected. Triggering auto-sync...');
      syncQueuedSOS();
    };
    window.addEventListener('online', handleOnline);
    if (navigator.onLine) {
      syncQueuedSOS();
    }

    return () => {
      clearInterval(timer);
      window.removeEventListener('online', handleOnline);
    };
  }, [countdown, currentAddress, onTriggerSos, authenticatedUser, lat, lng, activeGeoFenceZone.name]);

  // DigiLocker Connect Simulation
  const handleConnectDigiLocker = () => {
    setDigiLockerLoading(true);
    setDigiLockerStep('loading');
    setTimeout(() => {
      setDigiLockerLoading(false);
      setDigiLockerStep('fetched');
    }, 1500);
  };

  const handleConfirmDigiLocker = () => {
    setDigiLockerVerified(true);
    setShowDigiLockerModal(false);
  };

  // Submit Sign Up Form
  const handleSignUpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setOtpPendingAction('signup');
    setOtpError('');
    setShowOtpModal(true);
  };

  // Submit Sign In Form
  const handleSignInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!signinTouristId.trim() || !signinPhone.trim()) {
      alert('Please provide both Tourist ID and Registered Phone Number.');
      return;
    }
    setOtpPendingAction('signin');
    setOtpError('');
    setShowOtpModal(true);
  };

  // Verify OTP
  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpValue.trim().length < 4) {
      setOtpError('Please enter a valid 6-digit OTP code.');
      return;
    }

    setShowOtpModal(false);

    if (otpPendingAction === 'signup') {
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const newTouristId = `TR-2026-${randomSuffix}`;

      const newProfile: TouristProfile = {
        id: newTouristId,
        name: fullName || 'Elena Rostova',
        nationality: 'India',
        passportHash: digiLockerVerified ? 'Aadhaar XXXX-XXXX-4912' : 'PASSPORT-VERIFIED',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        phone: phone || '+91 98765 43210',
        emergencyContact: `${emergencyContactName || 'Carlos Rostova'} (${emergencyRelation || 'Father'})`,
        emergencyRelation: emergencyRelation || 'Father',
        hotel: 'Solang Resort & Spa, Manali',
        currentLocation: {
          lat: 32.2432,
          lng: 77.1892,
          address: currentAddress
        },
        batteryLevel: 88,
        safetyStatus: 'Safe',
        lastSeenTime: 'Just now',
        digitalBandId: `BAND-${randomSuffix}`,
        pastSOSHistory: [],
        email: email,
        digiLockerVerified: digiLockerVerified,
        locationConsent: 'granted'
      };

      setAuthenticatedUser(newProfile);
      setLocationConsent('granted');
      if (onRegisterTourist) {
        onRegisterTourist(newProfile);
      }

      setShowDigitalPassModal(true);

    } else {
      const found = existingTourists.find(
        (t) => t.id.toLowerCase() === signinTouristId.trim().toLowerCase()
      );

      const userProfile: TouristProfile = found || {
        id: signinTouristId.trim().toUpperCase(),
        name: 'Elena Rostova',
        nationality: 'Spain',
        passportHash: 'ESP-9874****',
        photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
        phone: signinPhone,
        emergencyContact: '+34 612 001 223 (Father - Carlos)',
        emergencyRelation: 'Father',
        hotel: 'The Grand Himalayan Resort, Old Manali',
        currentLocation: {
          lat: 32.2432,
          lng: 77.1892,
          address: currentAddress
        },
        batteryLevel: 84,
        safetyStatus: 'Safe',
        lastSeenTime: 'Just now',
        digitalBandId: 'BAND-3301',
        pastSOSHistory: []
      };

      setAuthenticatedUser(userProfile);
      setShowConsentModal(true);
    }
  };

  const handlePassModalProceed = () => {
    setShowDigitalPassModal(false);
    setShowConsentModal(true);
  };

  const handleGrantConsent = async () => {
    setLocationAcquiring(true);
    setLocationConsent('granted');

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const userLat = position.coords.latitude;
          const userLng = position.coords.longitude;
          const userAccuracy = position.coords.accuracy;
          setLat(userLat);
          setLng(userLng);
          const liveAddr = `Live GPS (${userLat.toFixed(4)}, ${userLng.toFixed(4)}) - Monitored Safe Zone`;
          setCurrentAddress(liveAddr);

          const updatedUser: TouristProfile = authenticatedUser
            ? {
                ...authenticatedUser,
                locationConsent: 'granted',
                currentLocation: {
                  lat: userLat,
                  lng: userLng,
                  address: liveAddr
                }
              }
            : {
                id: 'TR-88219',
                name: 'Elena Rostova',
                nationality: 'India',
                passportHash: 'ESP-9874****',
                photoUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300',
                phone: '+34 612 884 902',
                emergencyContact: '+34 612 001 223 (Father - Carlos)',
                emergencyRelation: 'Father',
                hotel: 'The Grand Himalayan Resort, Old Manali',
                currentLocation: {
                  lat: userLat,
                  lng: userLng,
                  address: liveAddr
                },
                batteryLevel: 88,
                safetyStatus: 'Safe',
                lastSeenTime: 'Just now',
                digitalBandId: 'BAND-3301',
                pastSOSHistory: [],
                locationConsent: 'granted'
              };

          setAuthenticatedUser(updatedUser);

          try {
            await saveLastKnownLocation({
              latitude: userLat,
              longitude: userLng,
              accuracy: userAccuracy,
              timestamp: new Date().toISOString(),
              location_source: 'live'
            });
            await sendLocationPingAPI({
              tourist_id: updatedUser.id,
              latitude: userLat,
              longitude: userLng,
              location_source: 'live'
            });
          } catch (e) {
            console.warn('Telemetry ping sync notice:', e);
          }

          setLocationAcquiring(false);
          setShowConsentModal(false);
          setLocationFeedbackMessage('🟢 Live GPS Location Access Enabled & Telemetry Connected');
          setTimeout(() => setLocationFeedbackMessage(null), 5000);
        },
        (err) => {
          console.warn('Browser geolocation access not allowed or timed out. Fallback to default coordinates:', err);
          if (authenticatedUser) {
            setAuthenticatedUser({ ...authenticatedUser, locationConsent: 'granted' });
          }
          setLocationAcquiring(false);
          setShowConsentModal(false);
          setLocationFeedbackMessage('🟢 GPS Location Tracking Enabled (Default Manali Region Active)');
          setTimeout(() => setLocationFeedbackMessage(null), 5000);
        },
        { enableHighAccuracy: true, timeout: 7000 }
      );
    } else {
      if (authenticatedUser) {
        setAuthenticatedUser({ ...authenticatedUser, locationConsent: 'granted' });
      }
      setLocationAcquiring(false);
      setShowConsentModal(false);
      setLocationFeedbackMessage('🟢 GPS Location Tracking Enabled');
      setTimeout(() => setLocationFeedbackMessage(null), 5000);
    }
  };

  const handleDeclineConsent = () => {
    setLocationConsent('declined');
    if (authenticatedUser) {
      setAuthenticatedUser({ ...authenticatedUser, locationConsent: 'declined' });
    }
    setShowConsentModal(false);
    setLocationFeedbackMessage('⚠️ Location Telemetry Declined. Standard SOS Mode Active.');
    setTimeout(() => setLocationFeedbackMessage(null), 5000);
  };

  const handleCopyTouristId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2500);
  };

  const handleDownloadPass = () => {
    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const handleSignOut = () => {
    setAuthenticatedUser(null);
    setLocationConsent(null);
    setSosActive(false);
  };

  // Open Edit/Modify Itinerary Modal
  const handleOpenEditItinerary = (item: ItineraryItem) => {
    setEditingItineraryItem(item);
    setEditDest(item.destination);
    setEditDate(item.date);
    setEditHotel(item.hotel || '');
    setEditActivities(item.activities || '');
    setShowEditItineraryModal(true);
  };

  // Save Modified Itinerary Item
  const handleSaveItineraryModification = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItineraryItem || !editDest.trim()) return;

    // AI Safety Check Simulation based on modified destination name
    let status: 'Safe Corridor' | 'Weather Advisory' | 'High Risk Zone' = 'Safe Corridor';
    if (
      editDest.toLowerCase().includes('rohtang') ||
      editDest.toLowerCase().includes('pass') ||
      editDest.toLowerCase().includes('glacier')
    ) {
      status = 'High Risk Zone';
    } else if (
      editDest.toLowerCase().includes('tunnel') ||
      editDest.toLowerCase().includes('sissu') ||
      editDest.toLowerCase().includes('river') ||
      editDest.toLowerCase().includes('kasol')
    ) {
      status = 'Weather Advisory';
    }

    const updated = itinerary.map((item) => {
      if (item.id === editingItineraryItem.id) {
        return {
          ...item,
          destination: editDest,
          date: editDate,
          hotel: editHotel || 'Verified Safe Hotel / Homestay',
          activities: editActivities || 'Local Sightseeing & Trekking',
          safetyStatus: status
        };
      }
      return item;
    });

    setItinerary(updated);
    setShowEditItineraryModal(false);
    setEditingItineraryItem(null);
    setItineraryToast(`✓ Itinerary destination "${editDest}" updated. AI Safety: ${status}`);
    setTimeout(() => setItineraryToast(null), 4500);
  };

  // Add Item to Itinerary
  const handleAddItinerary = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDest.trim()) return;

    // AI Safety Check Simulation based on destination name
    let status: 'Safe Corridor' | 'Weather Advisory' | 'High Risk Zone' = 'Safe Corridor';
    if (newDest.toLowerCase().includes('rohtang') || newDest.toLowerCase().includes('pass') || newDest.toLowerCase().includes('glacier')) {
      status = 'High Risk Zone';
    } else if (newDest.toLowerCase().includes('tunnel') || newDest.toLowerCase().includes('sissu') || newDest.toLowerCase().includes('river')) {
      status = 'Weather Advisory';
    }

    const newItem: ItineraryItem = {
      id: `itin-${Date.now()}`,
      destination: newDest,
      date: newDate,
      hotel: newHotel || 'Booked Homestay / Hotel',
      activities: newActivities || 'Sightseeing & Local Travel',
      safetyStatus: status
    };

    setItinerary([newItem, ...itinerary]);
    setNewDest('');
    setNewHotel('');
    setNewActivities('');
    setShowAddItineraryModal(false);
    setItineraryToast(`✓ Added "${newDest}" to Itinerary`);
    setTimeout(() => setItineraryToast(null), 4000);
  };

  // Delete Itinerary Item
  const handleDeleteItinerary = (id: string) => {
    setItinerary(itinerary.filter((item) => item.id !== id));
  };

  // Chatbot Send Message Handler
  const handleSendMessage = (textToSend?: string) => {
    const text = textToSend || chatInput;
    if (!text.trim()) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!textToSend) setChatInput('');

    // AI Bot Smart Response
    setTimeout(() => {
      let botAnswer = '';
      const lower = text.toLowerCase();

      if (lower.includes('solang') || lower.includes('safe')) {
        botAnswer = '🟢 Solang Valley is currently classified as a SAFE CORRIDOR with active Police Patrol Unit 4 on standby. Weather is clear (18°C), but avoid venturing near unmonitored river beds after 5 PM.';
      } else if (lower.includes('emergency') || lower.includes('hotline') || lower.includes('number')) {
        botAnswer = '🚨 Himachal Emergency Numbers:\n• Police Control: 100 / 112\n• Medical Ambulance: 108\n• Tourist Helpline: 1363\n• Mountain Rescue Squad: 1800-180-1122';
      } else if (lower.includes('altitude') || lower.includes('sickness') || lower.includes('tips')) {
        botAnswer = '⛰️ High-Altitude Safety Guidelines:\n1. Stay hydrated (min 3L water/day).\n2. Avoid strenuous exertion above 3,000 meters for the first 24 hrs.\n3. Keep Emergency Oxygen kit handy if visiting Rohtang Pass (3,978m).';
      } else if (lower.includes('hospital') || lower.includes('medical') || lower.includes('doctor')) {
        botAnswer = '🏥 Nearest Medical Facility:\nManali District Civil Hospital, Mall Road (3.2 km from your GPS location). Contact: +91 1902 252222.';
      } else {
        botAnswer = `I have logged your safety query regarding "${text}". According to the Suraksha Setu Civil Defense Feed, your current zone (Solang Valley) is normal. If you feel unsafe at any time, tap the red SOS button to alert Himachal Police instantly!`;
      }

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: botAnswer,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages((prev) => [...prev, botMsg]);
    }, 700);
  };

  // Simulate Live Broadcast Push Alert
  const handleTriggerSimulatedAlert = () => {
    const sampleAlert: BroadcastAlert = {
      id: `brd-${Date.now()}`,
      senderBadge: 'HP-DISASTER-CELL-01',
      region: 'Kullu & Solang Sector',
      radiusKm: 15,
      titleEn: '⚠️ CRITICAL WEATHER & AVALANCHE ADVISORY',
      titleHi: '⚠️ गंभीर मौसम एवं हिमस्खलन चेतावनी',
      bodyEn: 'Heavy snowfall and black ice predicted near Atal Tunnel and Rohtang Pass after 3:30 PM. High-altitude tourists are advised to return to hotel base camps before sunset.',
      bodyHi: 'दोपहर 3:30 बजे के बाद अटल टनल और रोहतांग दर्रे के पास भारी बर्फबारी की चेतावनी। पर्यटकों को सूर्यास्त से पहले होटल बेस कैंप लौटने की सलाह दी जाती है।',
      severity: 'Critical',
      timestamp: 'Just now',
      recipientCount: 1420,
      deliveredCount: 1420,
      status: 'Active'
    };

    setActiveBroadcastModal(sampleAlert);
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-slate-50 text-slate-900 p-3 sm:p-5 w-full max-w-none flex flex-col justify-between relative pb-24">
      
      {/* GLOBAL TOP HEADER FOR TOURIST PORTAL */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm mb-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3 w-full sm:w-auto">
          {/* TOP LEFT PROFILE BUTTON (If Authenticated) */}
          {authenticatedUser && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="px-3 py-2 bg-[#1B2A4A] hover:bg-[#071933] text-white text-xs font-black rounded-2xl border-2 border-[#E8935C]/50 shadow-md transition flex items-center gap-2 cursor-pointer flex-shrink-0"
              title="Click to view full Tourist Profile"
            >
              <img
                src={authenticatedUser.photoUrl}
                alt={authenticatedUser.name}
                className="w-8 h-8 rounded-xl border-2 border-[#2F4538] object-cover flex-shrink-0"
              />
              <div className="text-left hidden sm:block">
                <div className="text-[10px] font-extrabold text-[#E8935C] uppercase">My Profile</div>
                <div className="text-[11px] text-white font-bold truncate max-w-[110px]">{authenticatedUser.name}</div>
              </div>
              <User className="w-4 h-4 text-[#E8935C] sm:hidden" />
            </button>
          )}

          <div className="w-10 h-10 rounded-2xl bg-emerald-50 border border-[#2F4538] flex items-center justify-center text-[#2F4538] flex-shrink-0 shadow-sm">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-[#1B2A4A]">
                {t.touristPortalTitle}
              </h2>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#2F4538] font-mono text-[10px] font-black border border-emerald-200">
                OFFICIAL MOBILE
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium">
              Suraksha Setu • Government of India Tourist Safety App
            </p>
          </div>
        </div>

        {/* User Info & Controls Header Bar */}
        <div className="flex items-center space-x-2.5 w-full sm:w-auto justify-end flex-wrap gap-y-2">
          
          {/* Quick Profile Button on Right (Mobile fallback) */}
          {authenticatedUser && (
            <button
              onClick={() => setShowProfileModal(true)}
              className="sm:hidden px-3 py-2 bg-[#1B2A4A] text-white text-xs font-black rounded-xl border border-slate-700 transition flex items-center gap-1.5"
            >
              <User className="w-4 h-4 text-[#E8935C]" />
              <span>Profile</span>
            </button>
          )}
          
          {/* Gateway Return Button */}
          <button
            onClick={onReturnToGateway}
            className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold rounded-xl border border-slate-300 transition flex items-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4 text-slate-600" />
            <span>Gateway</span>
          </button>

          {/* Logout Button (If authenticated) */}
          {authenticatedUser && (
            <button
              onClick={handleSignOut}
              className="px-3 py-2 bg-red-50 hover:bg-red-100 text-red-800 text-xs font-bold rounded-xl border border-red-200 transition flex items-center gap-1.5"
            >
              <LogOut className="w-4 h-4 text-red-600" />
              <span>Logout</span>
            </button>
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* CONDITION 1: UNAUTHENTICATED - ONBOARDING & AUTHENTICATION */}
      {/* ========================================================= */}
      {!authenticatedUser ? (
        <div className="bg-white border-2 border-slate-200 rounded-3xl p-6 sm:p-8 shadow-lg">
          
          {/* Header Description */}
          <div className="text-center max-w-lg mx-auto mb-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-300 text-[#2F4538] text-xs font-bold mb-3">
              <Shield className="w-3.5 h-3.5" />
              <span>Official Tourist Onboarding & e-KYC</span>
            </div>
            <h3 className="text-2xl sm:text-3xl font-black text-[#1B2A4A]">
              {authTab === 'signup' ? t.signUpTitle : t.signInTitle}
            </h3>
            <p className="mt-2 text-xs sm:text-sm text-slate-600 font-medium leading-relaxed">
              {authTab === 'signup' ? t.signUpSub : t.signInSub}
            </p>
          </div>

          {/* AUTH CHOICE TABS */}
          <div className="flex rounded-xl bg-slate-100 p-1.5 border border-slate-200 max-w-md mx-auto mb-8">
            <button
              type="button"
              onClick={() => setAuthTab('signin')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                authTab === 'signin'
                  ? 'bg-white text-[#1B2A4A] shadow-md border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <KeyRound className="w-4 h-4 text-[#E8935C]" />
              <span>{t.authSignInTab}</span>
            </button>

            <button
              type="button"
              onClick={() => setAuthTab('signup')}
              className={`flex-1 py-2.5 px-4 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-2 ${
                authTab === 'signup'
                  ? 'bg-white text-[#1B2A4A] shadow-md border border-slate-200'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <User className="w-4 h-4 text-[#2F4538]" />
              <span>{t.authSignUpTab}</span>
            </button>
          </div>

          {/* TAB 1: SIGN IN FORM */}
          {authTab === 'signin' ? (
            <form onSubmit={handleSignInSubmit} className="space-y-5 max-w-md mx-auto text-left">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Existing Tourist ID <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={signinTouristId}
                  onChange={(e) => setSigninTouristId(e.target.value)}
                  placeholder="TR-88219 or TR-2026-8942"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 font-mono text-sm uppercase focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E8935C]"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Registered Mobile Phone Number <span className="text-red-500">*</span>
                </label>
                <input
                  type="tel"
                  required
                  value={signinPhone}
                  onChange={(e) => setSigninPhone(e.target.value)}
                  placeholder="+34 612 884 902"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#E8935C]"
                />
              </div>

              <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-900 font-medium">
                💡 <strong>Demo Quick Sign-In:</strong> Pre-filled with demo registered tourist ID (<code>TR-88219</code>).
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#1B2A4A] hover:bg-[#071933] text-white font-black text-sm transition shadow-lg flex items-center justify-center gap-2"
              >
                <KeyRound className="w-5 h-5 text-[#E8935C]" />
                <span>Send OTP & Activate Trip</span>
              </button>
            </form>
          ) : (
            /* TAB 2: SIGN UP FORM */
            <form onSubmit={handleSignUpSubmit} className="space-y-5">
              
              {/* DigiLocker Section */}
              <div className="p-4 bg-emerald-50/80 rounded-2xl border-2 border-emerald-300/80 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 rounded-xl bg-white border border-emerald-300 flex items-center justify-center text-[#2F4538] shadow-sm flex-shrink-0">
                    <FileCheck className="w-6 h-6 text-[#2F4538]" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900">
                        Government DigiLocker e-KYC Integration
                      </span>
                      {digiLockerVerified && (
                        <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold flex items-center gap-1">
                          <Check className="w-3 h-3" /> VERIFIED
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-slate-600 font-medium mt-0.5">
                      Skip manual uploads. Auto-retrieve Aadhaar / Passport verified credentials & photo.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowDigiLockerModal(true)}
                  className={`px-4 py-2.5 rounded-xl text-xs font-extrabold transition shadow flex items-center gap-2 whitespace-nowrap ${
                    digiLockerVerified
                      ? 'bg-emerald-100 text-emerald-900 border border-emerald-300 hover:bg-emerald-200'
                      : 'bg-[#2F4538] hover:bg-emerald-800 text-white'
                  }`}
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>{digiLockerVerified ? 'DigiLocker Verified ✅' : t.connectDigiLockerBtn}</span>
                </button>
              </div>

              {/* User Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-left">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {t.fullNameLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Elena Rostova"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {t.phoneLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {t.emailLabel}
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="elena.r@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {t.emergencyContactLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    placeholder="Carlos Rostova"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {t.emergencyRelationLabel}
                  </label>
                  <select
                    value={emergencyRelation}
                    onChange={(e) => setEmergencyRelation(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                  >
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Spouse">Spouse</option>
                    <option value="Sibling">Sibling</option>
                    <option value="Friend">Friend</option>
                    <option value="Relative">Relative</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    {t.emergencyPhoneLabel} <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    placeholder="+91 98765 00000"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                  />
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-4">
                <button
                  type="submit"
                  className="w-full py-3.5 rounded-xl bg-[#1B2A4A] hover:bg-[#071933] text-white font-black text-sm transition shadow-lg flex items-center justify-center gap-2"
                >
                  <Smartphone className="w-5 h-5 text-[#E8935C]" />
                  <span>Proceed to Mobile OTP Verification</span>
                </button>
              </div>

            </form>
          )}

        </div>
      ) : (
        /* ========================================================= */
        /* CONDITION 2: AUTHENTICATED - MAIN TOURIST DASHBOARD */
        /* ========================================================= */
        <div className="space-y-5 text-left">

          {/* Location / Telemetry Feedback Toast */}
          {locationFeedbackMessage && (
            <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-[#2F4538] text-[#2F4538] text-xs font-black flex items-center justify-between shadow-md animate-fade-in">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-[#2F4538] flex-shrink-0" />
                <span>{locationFeedbackMessage}</span>
              </div>
              <button onClick={() => setLocationFeedbackMessage(null)} className="text-emerald-800 hover:text-emerald-950 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* Itinerary Update Toast */}
          {itineraryToast && (
            <div className="p-3.5 rounded-2xl bg-blue-50 border-2 border-blue-500 text-blue-900 text-xs font-black flex items-center justify-between shadow-md animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-blue-600 flex-shrink-0" />
                <span>{itineraryToast}</span>
              </div>
              <button onClick={() => setItineraryToast(null)} className="text-blue-700 hover:text-blue-950 font-bold p-1">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* MAIN GRID DASHBOARD CONTAINER MATCHING DIAGRAM */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
            
            {/* LEFT COLUMN (Cols 1 - 5) */}
            <div className="lg:col-span-5 space-y-5">
              
              {/* BOX 1 TOP LEFT: TELEMETRY BAR & EMERGENCY SOS BUTTON */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 text-left">
                
                {/* Emergency SOS Panic Button Center Area */}
                <div className="py-2 flex flex-col items-center justify-center text-center">
                  
                  {/* STEP: ACTIVE EMERGENCY OR SUCCESS STATE */}
                  {(sosStep === 'active' || sosStep === 'success' || sosActive) ? (
                    <div className="w-full bg-red-50 border-2 border-[#D32F2F] rounded-2xl p-4 shadow-xs space-y-3 animate-pulse">
                      <div className="w-12 h-12 rounded-full bg-[#D32F2F] mx-auto flex items-center justify-center text-white shadow-md">
                        <ShieldAlert className="w-7 h-7" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-base font-black text-red-900 uppercase tracking-wider">
                          {t.sosActiveNotice}
                        </h3>
                        {incidentRef && (
                          <div className="inline-block px-2.5 py-0.5 rounded-full bg-red-200 text-red-950 font-black text-[10px] tracking-wider">
                            INCIDENT REF #{incidentRef}
                          </div>
                        )}
                      </div>
                      <p className="text-[11px] text-red-800 font-bold">
                        GPS Telemetry ({lat.toFixed(4)}, {lng.toFixed(4)}) broadcasting to Police Command Station.
                      </p>
                      <div className="p-2.5 bg-white/80 rounded-xl border border-red-200 text-left text-[11px] text-slate-700 space-y-1">
                        <div className="font-extrabold text-red-900 flex items-center justify-between">
                          <span>Responder Status:</span>
                          <span className="text-emerald-700 font-black">EN ROUTE (ETA ~4 mins)</span>
                        </div>
                        <div className="text-[10px] text-slate-500">
                          Dispatched Unit: Himachal PCR Unit 2 (Vashisht Patrol)
                        </div>
                      </div>
                      <div className="pt-1 flex justify-center gap-2">
                        <button
                          onClick={() => setSirenPlaying(!sirenPlaying)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                            sirenPlaying ? 'bg-red-600 text-white' : 'bg-slate-200 text-slate-800'
                          }`}
                        >
                          {sirenPlaying ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
                          <span>{sirenPlaying ? 'Siren Active' : 'Mute'}</span>
                        </button>
                        <button
                          onClick={handleResetSosFlow}
                          className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-lg shadow-xs"
                        >
                          Reset SOS
                        </button>
                      </div>
                    </div>

                  ) : sosStep === 'confirming' ? (
                    /* STEP: CONFIRMATION MODAL STATE */
                    <div className="w-full bg-amber-50 border-2 border-amber-400 rounded-2xl p-4 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500 mx-auto flex items-center justify-center text-slate-950 font-black shadow-sm">
                        <AlertTriangle className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-black text-amber-950 uppercase tracking-wide">
                        Confirm Emergency SOS Distress Signal?
                      </h3>
                      <p className="text-[11px] text-amber-900 font-medium">
                        This will transmit your live coordinates ({lat.toFixed(4)}, {lng.toFixed(4)}) and identity details directly to the Himachal Police Control Room.
                      </p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center pt-2">
                        <button
                          onClick={() => handleExecuteSosSend(false)}
                          className="px-4 py-2 bg-[#D32F2F] hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center justify-center gap-1.5"
                        >
                          <ShieldAlert className="w-4 h-4" />
                          <span>Yes, Broadcast SOS</span>
                        </button>
                        <button
                          onClick={() => handleExecuteSosSend(true)}
                          className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 text-[10px] font-bold rounded-xl transition"
                          title="Test error fallback state"
                        >
                          Simulate Network Drop Error
                        </button>
                        <button
                          onClick={() => setSosStep('ready')}
                          className="px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                  ) : sosStep === 'sending' ? (
                    /* STEP: SENDING / LOADING STATE */
                    <div className="w-full bg-slate-900 border-2 border-blue-500 text-white rounded-2xl p-5 text-center space-y-4 shadow-lg">
                      <div className="flex justify-center">
                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin" />
                      </div>
                      <div className="space-y-1">
                        <h3 className="text-sm font-black uppercase tracking-wider text-blue-200">
                          Transmitting Encrypted Distress Beacon...
                        </h3>
                        <p className="text-[11px] text-slate-300 font-medium">
                          Connecting to Himachal Pradesh Police Emergency Network
                        </p>
                      </div>

                      {/* Progress Bar */}
                      <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700">
                        <div
                          className="bg-blue-500 h-2.5 rounded-full transition-all duration-300 ease-out"
                          style={{ width: `${sosSendingProgress}%` }}
                        ></div>
                      </div>

                      <div className="text-[10px] font-mono text-slate-400 flex items-center justify-between">
                        <span>GPS Lock: 32.2432, 77.1892</span>
                        <span>{sosSendingProgress}%</span>
                      </div>
                    </div>

                  ) : sosStep === 'error' ? (
                    /* STEP: ERROR STATE */
                    <div className="w-full bg-red-50 border-2 border-red-500 rounded-2xl p-4 text-center space-y-3">
                      <div className="w-10 h-10 rounded-full bg-red-600 mx-auto flex items-center justify-center text-white shadow-sm">
                        <X className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-black text-red-900 uppercase tracking-wide">
                        SOS Transmission Failure
                      </h3>
                      <p className="text-[11px] text-red-800 font-bold">
                        {sosErrorMessage || 'Network signal timeout. Could not establish band relay.'}
                      </p>
                      <div className="flex justify-center gap-2 pt-1">
                        <button
                          onClick={() => handleExecuteSosSend(false)}
                          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-black rounded-xl shadow-md transition flex items-center gap-1.5"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Retry Broadcast</span>
                        </button>
                        <button
                          onClick={() => setSosStep('ready')}
                          className="px-3 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>

                  ) : countdown !== null ? (
                    <div className="w-full bg-amber-50 border-2 border-[#E8935C] rounded-2xl p-5 text-center space-y-3">
                      <div className="text-5xl font-black text-[#E8935C] animate-bounce">
                        {countdown}
                      </div>
                      <p className="text-xs font-bold text-amber-900">
                        Broadcasting distress beacon in {countdown}s...
                      </p>
                      <button
                        onClick={() => setCountdown(null)}
                        className="px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-xl shadow-xs"
                      >
                        Cancel SOS
                      </button>
                    </div>

                  ) : (
                    /* STEP: READY DEFAULT STATE */
                    <div className="flex flex-col items-center">
                      <button
                        onClick={handleStartSosConfirmation}
                        className="relative group w-44 h-44 sm:w-48 sm:h-48 rounded-full bg-gradient-to-br from-[#D32F2F] via-red-600 to-red-700 border-4 border-red-300 text-white font-black shadow-2xl shadow-red-500/40 hover:scale-105 active:scale-95 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                      >
                        <div className="absolute inset-0 rounded-full border-4 border-red-500/30 animate-ping pointer-events-none"></div>
                        <ShieldAlert className="w-12 h-12 text-white group-hover:scale-110 transition-transform" />
                        <span className="text-lg sm:text-xl font-black tracking-widest uppercase">EMERGENCY SOS</span>
                        <span className="text-[9px] text-red-100 font-bold uppercase tracking-wider">TAP TO BROADCAST</span>
                      </button>

                      <p className="mt-3 text-[11px] text-slate-500 font-medium max-w-xs text-center">
                        Tap button to initiate guided distress signal & live location dispatch to nearest PCR unit.
                      </p>
                    </div>
                  )}
                </div>

              </div>

              {/* BOX 2 BOTTOM LEFT: GOOGLE MAPS FOR DIRECTIONS, LOCATION & GEO-FENCE */}
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 text-left">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <div className="flex items-center space-x-2">
                    <Navigation className="w-4 h-4 text-blue-600" />
                    <h3 className="text-xs font-black text-[#1B2A4A] uppercase tracking-wider">
                      Google Maps Directions & Geo-Fence
                    </h3>
                  </div>
                  <span className="px-2 py-0.5 rounded bg-blue-50 text-blue-800 text-[10px] font-black border border-blue-200">
                    LIVE GOOGLE MAP
                  </span>
                </div>

                {/* Geo-Fence Safety Zone Selector & Alert Banner */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-[10px] font-bold uppercase text-slate-500">Geo-Fence Safety Zone:</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase border ${
                      activeGeoFenceZone.riskLevel === 'Unsafe' ? 'bg-red-100 text-red-800 border-red-300' :
                      activeGeoFenceZone.riskLevel === 'Caution' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-emerald-100 text-emerald-800 border-emerald-300'
                    }`}>
                      {activeGeoFenceZone.riskLevel} STATE
                    </span>
                  </div>

                  {/* Zone Buttons */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {MOCK_GEOFENCE_ZONES.map((zone) => (
                      <button
                        key={zone.id}
                        onClick={() => {
                          setActiveGeoFenceZone(zone);
                          setMapSearchQuery('');
                          setRouteDest(zone.name);
                        }}
                        className={`px-2 py-2 rounded-xl text-[10px] font-extrabold border transition text-center truncate cursor-pointer ${
                          activeGeoFenceZone.id === zone.id
                            ? zone.riskLevel === 'Unsafe' ? 'bg-red-600 text-white border-red-700 shadow-sm ring-2 ring-red-400' :
                              zone.riskLevel === 'Caution' ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-sm ring-2 ring-amber-300' :
                              'bg-emerald-600 text-white border-emerald-700 shadow-sm ring-2 ring-emerald-400'
                            : 'bg-slate-50 hover:bg-slate-100 text-slate-700 border-slate-200'
                        }`}
                      >
                        {zone.name.split(' ')[0]} ({zone.riskLevel})
                      </button>
                    ))}
                  </div>

                  {/* Active GeoFence Warning Display */}
                  {activeGeoFenceZone.riskLevel === 'Unsafe' ? (
                    <div className="p-2.5 rounded-xl bg-red-50 border border-red-200 text-red-900 text-[11px] font-medium flex items-start gap-2">
                      <ShieldAlert className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5 animate-pulse" />
                      <div>
                        <div className="font-extrabold text-red-950 uppercase text-[10px]">
                          ⚠️ GEO-FENCE WARNING: UNSAFE / RESTRICTED ZONE
                        </div>
                        <div>{activeGeoFenceZone.description}</div>
                      </div>
                    </div>
                  ) : activeGeoFenceZone.riskLevel === 'Caution' ? (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-medium flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold text-amber-950 uppercase text-[10px]">
                          ⚡ GEO-FENCE CAUTION: MODERATE RISK ZONE
                        </div>
                        <div>{activeGeoFenceZone.description}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-[11px] font-medium flex items-start gap-2">
                      <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <div className="font-extrabold text-emerald-950 uppercase text-[10px]">
                          🛡️ GEO-FENCE SAFE: MONITORED SAFE CORRIDOR
                        </div>
                        <div>{activeGeoFenceZone.description}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Search & Route Controls */}
                <div className="space-y-3 pt-1">
                  
                  {/* Single Location Search Input */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase">
                      Search Map Place / Landmark:
                    </label>
                    <div className="flex gap-1.5">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          value={mapSearchQuery}
                          onChange={(e) => setMapSearchQuery(e.target.value)}
                          placeholder="Search e.g. Hadimba Temple, Rohtang, Kasol..."
                          className="w-full pl-8 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                        />
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
                      </div>
                      {mapSearchQuery && (
                        <button
                          onClick={() => setMapSearchQuery('')}
                          className="px-2.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition"
                          title="Clear Search"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Route Directions: Origin ➔ Destination */}
                  <div className="space-y-1">
                    <label className="block text-[10px] font-extrabold text-slate-600 uppercase">
                      Directions (Origin ➔ Destination):
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <input
                        type="text"
                        value={routeOrigin}
                        onChange={(e) => setRouteOrigin(e.target.value)}
                        placeholder="Starting Origin (e.g. Manali Town)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={routeDest}
                        onChange={(e) => {
                          setRouteDest(e.target.value);
                          setMapSearchQuery('');
                        }}
                        placeholder="Target Destination (e.g. Solang Valley)"
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-semibold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>

                  {/* Quick Preset Location Chips */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    <span className="text-[10px] font-bold text-slate-400 self-center mr-1">Quick:</span>
                    {[
                      'Solang Valley',
                      'Rohtang Pass',
                      'Old Manali',
                      'Hadimba Temple',
                      'Atal Tunnel',
                      'Kasol Market',
                      'Sissu Valley'
                    ].map((place) => (
                      <button
                        key={place}
                        onClick={() => {
                          setMapSearchQuery(place);
                          setRouteDest(place);
                        }}
                        className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition ${
                          mapSearchQuery === place || routeDest === place
                            ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                        }`}
                      >
                        {place}
                      </button>
                    ))}
                  </div>

                  {/* Actual Google Map Component with Geofence Zones & Large Height */}
                  <ActualGoogleMap
                    center={activeGeoFenceZone.center}
                    zoom={13}
                    origin={routeOrigin}
                    destination={routeDest}
                    searchQuery={mapSearchQuery}
                    height="460px"
                    geofenceZones={MOCK_GEOFENCE_ZONES}
                    activeZoneId={activeGeoFenceZone.id}
                    markers={[
                      { id: 'user-loc', lat: lat, lng: lng, title: 'My GPS Location', type: 'user' },
                      { id: 'police-pcr', lat: 32.248, lng: 77.185, title: 'Police PCR Unit 2', type: 'police' },
                      { id: 'dest-hotel', lat: 32.316, lng: 77.157, title: routeDest || 'Solang Valley', type: 'hotel' }
                    ]}
                  />

                  <div className="flex items-center justify-between text-[11px] text-slate-600 bg-slate-50 p-2.5 rounded-xl border border-slate-200 font-semibold">
                    <span>Active Zone: <strong className="text-slate-900">{activeGeoFenceZone.name}</strong></span>
                    <span className="text-[#2F4538] font-black flex items-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Himachal Police Monitored</span>
                    </span>
                  </div>
                </div>
              </div>


            </div>

            {/* RIGHT COLUMN (Cols 6 - 12): ITINERARY PLANNER & SAFETY HEATMAP */}
            <div className="lg:col-span-7 space-y-5">
              
              <div className="bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm space-y-4 text-left">
                
                {/* RIGHT BOX MODULE SWITCHER TABS */}
                <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 gap-1">
                  <button
                    onClick={() => setActiveTab('itinerary')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      activeTab === 'itinerary'
                        ? 'bg-[#1B2A4A] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5 text-[#2F4538]" />
                    <span>Itinerary Planner</span>
                  </button>

                  <button
                    onClick={() => setActiveTab('heatmap')}
                    className={`flex-1 py-2 px-3 rounded-lg text-xs font-black transition flex items-center justify-center gap-1.5 ${
                      activeTab === 'heatmap'
                        ? 'bg-[#1B2A4A] text-white shadow-xs'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    <Map className="w-3.5 h-3.5 text-red-500" />
                    <span>Safety Heatmap</span>
                  </button>
                </div>

                {/* TAB CONTENT 1: ITINERARY PLANNER */}
                {(activeTab === 'itinerary' || activeTab === 'overview') && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                      <div>
                        <h3 className="text-sm font-black text-[#1B2A4A] flex items-center gap-1.5">
                          <Calendar className="w-4 h-4 text-[#2F4538]" />
                          <span>Interactive Itinerary & Hazard Evaluation</span>
                        </h3>
                        <p className="text-[11px] text-slate-500 font-medium">
                          Manage destinations and stays evaluated against real-time hazard alerts.
                        </p>
                      </div>

                      <button
                        onClick={() => setShowAddItineraryModal(true)}
                        className="px-3 py-1.5 bg-[#1B2A4A] hover:bg-[#071933] text-white text-xs font-extrabold rounded-xl shadow-xs transition flex items-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#E8935C]" />
                        <span>Add</span>
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1">
                      {itinerary.map((item, idx) => (
                        <div
                          key={item.id}
                          className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition shadow-2xs space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-[#1B2A4A] text-white text-[10px] font-black flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <h4 className="text-xs font-black text-slate-900">{item.destination}</h4>
                            </div>

                            <div className="flex items-center gap-1.5">
                              {item.safetyStatus === 'Safe Corridor' && (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-[#2F4538] border border-emerald-300 text-[9px] font-black flex items-center gap-1">
                                  <ShieldCheck className="w-3 h-3 text-[#2F4538]" /> Safe Corridor
                                </span>
                              )}
                              {item.safetyStatus === 'Weather Advisory' && (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[9px] font-black flex items-center gap-1">
                                  <AlertTriangle className="w-3 h-3 text-amber-600" /> Weather Advisory
                                </span>
                              )}
                              {item.safetyStatus === 'High Risk Zone' && (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[9px] font-black flex items-center gap-1">
                                  <ShieldAlert className="w-3 h-3 text-red-600" /> High Risk Pass
                                </span>
                              )}
                              <button
                                onClick={() => handleOpenEditItinerary(item)}
                                className="px-2 py-0.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[10px] font-extrabold transition flex items-center gap-1"
                                title="Modify Destination & Stay"
                              >
                                <Edit3 className="w-3 h-3" />
                                <span>Modify</span>
                              </button>
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-600 font-medium flex flex-wrap gap-x-3 gap-y-1">
                            <span>Date: <strong>{item.date}</strong></span>
                            <span>•</span>
                            <span>Hotel: <strong>{item.hotel}</strong></span>
                          </div>

                          <p className="text-[11px] text-slate-500 italic">
                            Activities: {item.activities}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* TAB CONTENT 2: SAFETY HEATMAP */}
                {activeTab === 'heatmap' && (
                  <CrowdHeatmap onAddItineraryDestination={handleAddItineraryDestination} />
                )}

              </div>

            </div>

            {/* BOTTOM ROW: NEARBY SAFE HAVENS & POLICE POSTS (FULL WIDTH) */}
            <div className="lg:col-span-12 pt-2">
              <div className="w-full bg-white border-2 border-slate-200 rounded-2xl p-4 shadow-sm text-left space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                  <h4 className="text-xs font-black text-[#2F4538] uppercase tracking-wider flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-[#2F4538]" />
                    <span>Nearby Safe Havens & Police Posts</span>
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">24/7 Verified Safe Hubs</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                  {POLICE_STATIONS.map((st) => (
                    <div key={st.id} className="p-3 bg-slate-50 hover:bg-slate-100 transition border border-slate-200 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900">{st.name}</div>
                        <div className="text-[11px] text-slate-600 font-medium">{st.location.address}</div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-2">
                        <span className="px-2 py-0.5 rounded bg-emerald-100 text-[#2F4538] font-mono text-[10px] font-black border border-emerald-200">450m</span>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">Ph: {st.contactPhone}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>

          {/* ========================================================= */}
          {/* TAB 2: ITINERARY PLANNER */}
          {/* ========================================================= */}
          {activeTab === 'itinerary' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6 text-left">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <h3 className="text-lg font-black text-[#1B2A4A] flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-[#2F4538]" />
                    <span>Interactive Itinerary & Safety Checker</span>
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Manage trip destinations and hotel stays with AI-powered hazard evaluation.
                  </p>
                </div>

                <button
                  onClick={() => setShowAddItineraryModal(true)}
                  className="px-4 py-2.5 bg-[#1B2A4A] hover:bg-[#071933] text-white text-xs font-extrabold rounded-xl shadow transition flex items-center gap-1.5"
                >
                  <Plus className="w-4 h-4 text-[#E8935C]" />
                  <span>Add New Destination</span>
                </button>
              </div>

              {/* Itinerary Items List */}
              <div className="space-y-4">
                {itinerary.map((item, idx) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-2xl border-2 border-slate-200 bg-slate-50 hover:bg-white hover:border-slate-300 transition shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="w-6 h-6 rounded-full bg-[#1B2A4A] text-white text-[11px] font-black flex items-center justify-center">
                          {idx + 1}
                        </span>
                        <h4 className="text-sm font-black text-slate-900">{item.destination}</h4>
                        
                        {/* Status Badge */}
                        {item.safetyStatus === 'Safe Corridor' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#2F4538] border border-emerald-300 text-[10px] font-black flex items-center gap-1">
                            <ShieldCheck className="w-3 h-3 text-[#2F4538]" /> Safe Corridor
                          </span>
                        )}
                        {item.safetyStatus === 'Weather Advisory' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-black flex items-center gap-1">
                            <AlertTriangle className="w-3 h-3 text-amber-600" /> Weather Advisory
                          </span>
                        )}
                        {item.safetyStatus === 'High Risk Zone' && (
                          <span className="px-2.5 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 text-[10px] font-black flex items-center gap-1">
                            <ShieldAlert className="w-3 h-3 text-red-600" /> High Risk Pass
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-600 font-medium flex flex-wrap gap-x-4 gap-y-1 pt-1">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5 text-slate-400" /> Date: <strong>{item.date}</strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Hotel className="w-3.5 h-3.5 text-slate-400" /> Hotel: <strong>{item.hotel}</strong>
                        </span>
                      </div>

                      <p className="text-xs text-slate-500 italic pt-0.5">
                        Activities: {item.activities}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => handleOpenEditItinerary(item)}
                        className="px-3 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-black transition flex items-center gap-1.5 shadow-2xs"
                        title="Modify Itinerary Details"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                        <span>Modify Itinerary</span>
                      </button>

                      <button
                        onClick={() => handleDeleteItinerary(item.id)}
                        className="p-2 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 text-xs transition"
                        title="Delete destination"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: SAFETY HEATMAP */}
          {/* ========================================================= */}
          {activeTab === 'heatmap' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6 text-left">
              <div>
                <h3 className="text-lg font-black text-[#1B2A4A] flex items-center gap-2">
                  <Map className="w-5 h-5 text-red-500" />
                  <span>Geofenced Regional Safety Heatmap</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Real-time risk evaluation for Kullu, Manali, Lahaul & Spiti tourist corridors.
                </p>
              </div>

              {/* Heatmap Filters */}
              <div className="flex gap-2 overflow-x-auto pb-1 text-xs">
                <button
                  onClick={() => setHeatmapFilter('all')}
                  className={`px-3.5 py-1.5 rounded-xl font-extrabold transition ${
                    heatmapFilter === 'all'
                      ? 'bg-slate-900 text-white'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  All Zones (5)
                </button>
                <button
                  onClick={() => setHeatmapFilter('high')}
                  className={`px-3.5 py-1.5 rounded-xl font-extrabold transition ${
                    heatmapFilter === 'high'
                      ? 'bg-red-600 text-white'
                      : 'bg-red-50 text-red-800 border border-red-200 hover:bg-red-100'
                  }`}
                >
                  🔴 High-Risk Zones
                </button>
                <button
                  onClick={() => setHeatmapFilter('advisory')}
                  className={`px-3.5 py-1.5 rounded-xl font-extrabold transition ${
                    heatmapFilter === 'advisory'
                      ? 'bg-amber-500 text-white'
                      : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                  }`}
                >
                  🟡 Weather Advisories
                </button>
                <button
                  onClick={() => setHeatmapFilter('safe')}
                  className={`px-3.5 py-1.5 rounded-xl font-extrabold transition ${
                    heatmapFilter === 'safe'
                      ? 'bg-[#2F4538] text-white'
                      : 'bg-emerald-50 text-emerald-900 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  🟢 Safe Corridors
                </button>
              </div>

              {/* Visual Simulated Map Grid */}
              <div className="relative h-64 sm:h-80 rounded-2xl bg-slate-900 border-2 border-slate-800 overflow-hidden shadow-inner flex items-center justify-center p-4">
                {/* Simulated Topo Map Lines */}
                <div className="absolute inset-0 bg-[radial-gradient(#334155_1px,transparent_1px)] [background-size:16px_16px] opacity-40"></div>

                {/* Simulated Pins */}
                <div className="relative w-full h-full">
                  
                  {/* Pin 1: Rohtang Pass (High Risk) */}
                  {(heatmapFilter === 'all' || heatmapFilter === 'high') && (
                    <div className="absolute top-[18%] left-[65%] flex items-center gap-1.5 group cursor-pointer">
                      <span className="w-5 h-5 rounded-full bg-red-600 border-2 border-white text-white font-bold text-[9px] flex items-center justify-center animate-ping"></span>
                      <span className="w-5 h-5 rounded-full bg-red-600 border-2 border-white text-white font-bold text-[9px] flex items-center justify-center shadow-lg">!</span>
                      <div className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-1 rounded border border-red-500 shadow">
                        Rohtang Pass (Avalanche Warning)
                      </div>
                    </div>
                  )}

                  {/* Pin 2: Solang Valley (Safe) */}
                  {(heatmapFilter === 'all' || heatmapFilter === 'safe') && (
                    <div className="absolute top-[45%] left-[30%] flex items-center gap-1.5 group cursor-pointer">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white text-white font-bold text-[9px] flex items-center justify-center shadow-lg">✓</span>
                      <div className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-1 rounded border border-emerald-500 shadow">
                        Solang Valley (Patrol Active)
                      </div>
                    </div>
                  )}

                  {/* Pin 3: Atal Tunnel North (Advisory) */}
                  {(heatmapFilter === 'all' || heatmapFilter === 'advisory') && (
                    <div className="absolute top-[28%] left-[45%] flex items-center gap-1.5 group cursor-pointer">
                      <span className="w-5 h-5 rounded-full bg-amber-500 border-2 border-white text-white font-bold text-[9px] flex items-center justify-center shadow-lg">!</span>
                      <div className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-1 rounded border border-amber-500 shadow">
                        Atal Tunnel (Black Ice Caution)
                      </div>
                    </div>
                  )}

                  {/* Pin 4: Mall Road Manali (Safe) */}
                  {(heatmapFilter === 'all' || heatmapFilter === 'safe') && (
                    <div className="absolute top-[70%] left-[25%] flex items-center gap-1.5 group cursor-pointer">
                      <span className="w-5 h-5 rounded-full bg-emerald-500 border-2 border-white text-white font-bold text-[9px] flex items-center justify-center shadow-lg">✓</span>
                      <div className="bg-slate-900/90 text-white text-[10px] font-black px-2 py-1 rounded border border-emerald-500 shadow">
                        Mall Road Base (Civil HQ)
                      </div>
                    </div>
                  )}
                </div>

                <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-700 text-[10px] text-slate-300 font-mono">
                  Coordinates: 32.2432° N, 77.1892° E • Zoom Level: Sector 4
                </div>
              </div>

              {/* Detailed Hazard Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                    <span className="text-xs font-black text-red-900 uppercase">Rohtang Pass Sector (3,978m)</span>
                  </div>
                  <p className="text-xs text-red-800 font-medium">
                    High avalanche probability above Marhi. Travel prohibited past 3:00 PM without special mountain permit.
                  </p>
                </div>

                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl">
                  <div className="flex items-center gap-2 mb-1">
                    <ShieldCheck className="w-4 h-4 text-[#2F4538]" />
                    <span className="text-xs font-black text-emerald-900 uppercase">Solang-Manali Highway Corridor</span>
                  </div>
                  <p className="text-xs text-emerald-800 font-medium">
                    Continuous police patrol every 15 mins. SOS response time: under 6 minutes.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: ROUTE FINDER MAP */}
          {/* ========================================================= */}
          {activeTab === 'route_finder' && (
            <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm space-y-6 text-left">
              <div>
                <h3 className="text-lg font-black text-[#1B2A4A] flex items-center gap-2">
                  <Navigation className="w-5 h-5 text-blue-600" />
                  <span>Interactive Safe Route Finder & Hazard Avoidance</span>
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-0.5">
                  Calculate safest mountain transit corridors with real-time landslide & black ice warnings.
                </p>
              </div>

              {/* Route Search Controls */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Starting Origin
                  </label>
                  <select
                    value={routeOrigin}
                    onChange={(e) => setRouteOrigin(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Manali Town">Manali Town Center</option>
                    <option value="Solang Valley">Solang Valley Base</option>
                    <option value="Kullu Airport">Kullu Bhuntar Airport</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 mb-1">
                    Target Destination
                  </label>
                  <select
                    value={routeDest}
                    onChange={(e) => setRouteDest(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Sissu / Lahaul Valley">Sissu / Lahaul Valley (via Atal Tunnel)</option>
                    <option value="Kasol / Parvati Valley">Kasol / Parvati Valley</option>
                    <option value="Dharamshala / Kangra">Dharamshala / Kangra Valley</option>
                  </select>
                </div>
              </div>

              {/* Route Result Card */}
              <div className="space-y-4">
                <div className="p-5 rounded-2xl bg-blue-50/80 border-2 border-blue-300 space-y-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-blue-200 pb-3">
                    <div>
                      <span className="px-2.5 py-0.5 rounded bg-blue-600 text-white text-[10px] font-black uppercase">
                        RECOMMENDED SAFE CORRIDOR
                      </span>
                      <h4 className="text-base font-black text-slate-900 mt-1">
                        {routeOrigin} ➔ {routeDest}
                      </h4>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-black text-[#1B2A4A]">Distance: 28.4 km</div>
                      <div className="text-xs text-blue-800 font-bold">Est. Travel Time: 45 mins</div>
                    </div>
                  </div>

                  {/* Route Safety Milestones */}
                  <div className="space-y-2 text-xs">
                    <div className="font-extrabold text-slate-800 uppercase tracking-wider text-[11px]">
                      Turn-by-Turn Police & Emergency Milestones:
                    </div>

                    <div className="flex items-center space-x-3 p-2.5 bg-white rounded-xl border border-blue-200">
                      <ShieldCheck className="w-4 h-4 text-[#2F4538] flex-shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900">Km 0.0 — Manali Police Post Checkpoint</div>
                        <div className="text-[11px] text-slate-600">Verification & e-Pass Scanner station</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-2.5 bg-white rounded-xl border border-blue-200">
                      <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900">Km 14.2 — Solang Nullah Bypass (Black Ice Warning)</div>
                        <div className="text-[11px] text-amber-800">Drive at max 30 km/h due to morning frost on asphalt</div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-3 p-2.5 bg-white rounded-xl border border-blue-200">
                      <ShieldCheck className="w-4 h-4 text-blue-600 flex-shrink-0" />
                      <div>
                        <div className="font-bold text-slate-900">Km 28.4 — Atal Tunnel South Portal PCR Van Unit 2</div>
                        <div className="text-[11px] text-slate-600">24/7 Patrol Unit stationed with Medical First Aid</div>
                      </div>
                    </div>
                  </div>

                  {/* Avoided Hazard Warning */}
                  <div className="p-3 bg-red-100 rounded-xl border border-red-300 text-xs text-red-900 font-medium">
                    ⚠️ <strong>Hazard Avoided:</strong> Old Rohtang Pass road has been routed around due to active rockfall warning at Marhi curve.
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      )}

      {/* ========================================================= */}
      {/* FLOATING EMERGENCY CONTACTS QUICK DRAWER BUTTON */}
      {/* ========================================================= */}
      {authenticatedUser && (
        <div className="fixed bottom-4 left-4 z-40">
          <button
            onClick={() => setShowContactsDrawer(!showContactsDrawer)}
            className="px-4 py-3 rounded-2xl bg-[#1B2A4A] text-white text-xs font-black shadow-2xl border-2 border-[#E8935C] hover:bg-[#071933] transition flex items-center gap-2"
          >
            <Phone className="w-4 h-4 text-[#E8935C] animate-pulse" />
            <span>Emergency Hotlines</span>
            <ChevronUp className={`w-4 h-4 transition-transform ${showContactsDrawer ? 'rotate-180' : ''}`} />
          </button>
        </div>
      )}

      {/* EMERGENCY CONTACTS SLIDE-UP DRAWER */}
      {showContactsDrawer && (
        <div className="fixed bottom-20 left-4 right-4 sm:left-6 sm:right-auto sm:w-96 z-40 bg-white border-2 border-[#1B2A4A] rounded-3xl p-5 shadow-2xl space-y-4 text-left animate-fade-in">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <h4 className="text-sm font-black text-[#1B2A4A] flex items-center gap-2">
              <PhoneCall className="w-4 h-4 text-red-600" />
              <span>Government Emergency Hotlines</span>
            </h4>
            <button onClick={() => setShowContactsDrawer(false)} className="p-1 rounded hover:bg-slate-100">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs font-bold">
            <a href="tel:112" className="p-2.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl flex items-center space-x-2 text-red-900 transition">
              <span className="w-6 h-6 rounded bg-red-600 text-white font-black flex items-center justify-center text-[10px]">112</span>
              <span>National Emergency</span>
            </a>
            <a href="tel:100" className="p-2.5 bg-blue-50 hover:bg-blue-100 border border-blue-200 rounded-xl flex items-center space-x-2 text-blue-900 transition">
              <span className="w-6 h-6 rounded bg-blue-600 text-white font-black flex items-center justify-center text-[10px]">100</span>
              <span>Police Control</span>
            </a>
            <a href="tel:108" className="p-2.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl flex items-center space-x-2 text-emerald-900 transition">
              <span className="w-6 h-6 rounded bg-emerald-600 text-white font-black flex items-center justify-center text-[10px]">108</span>
              <span>Ambulance</span>
            </a>
            <a href="tel:1363" className="p-2.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl flex items-center space-x-2 text-amber-900 transition">
              <span className="w-6 h-6 rounded bg-[#E8935C] text-white font-black flex items-center justify-center text-[10px]">1363</span>
              <span>Tourist Helpline</span>
            </a>
            <a href="tel:1091" className="p-2.5 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-xl flex items-center space-x-2 text-purple-900 transition">
              <span className="w-6 h-6 rounded bg-purple-600 text-white font-black flex items-center justify-center text-[10px]">1091</span>
              <span>Women Helpline</span>
            </a>
            <a href="tel:1070" className="p-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-xl flex items-center space-x-2 text-slate-900 transition">
              <span className="w-6 h-6 rounded bg-slate-800 text-white font-black flex items-center justify-center text-[10px]">1070</span>
              <span>Disaster Control</span>
            </a>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* FLOATING AI SAFETY ASSISTANT CHATBOT WIDGET */}
      {/* ========================================================= */}
      {authenticatedUser && (
        <div className="fixed bottom-4 right-4 z-40">
          {!chatOpen ? (
            <button
              onClick={() => setChatOpen(true)}
              className="p-4 rounded-full bg-[#2F4538] text-white shadow-2xl hover:bg-emerald-800 transition flex items-center gap-2 border-2 border-white cursor-pointer"
            >
              <MessageSquare className="w-6 h-6 text-white" />
              <span className="hidden sm:inline text-xs font-black">AI Safety Assistant</span>
            </button>
          ) : (
            <div className="w-80 sm:w-96 bg-white border-2 border-[#2F4538] rounded-3xl shadow-2xl overflow-hidden flex flex-col h-96 text-left animate-fade-in">
              
              {/* Chat Header */}
              <div className="bg-[#2F4538] text-white p-3.5 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-white">
                    <ShieldCheck className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h4 className="text-xs font-black">Suraksha AI Assistant</h4>
                    <p className="text-[10px] text-emerald-100">Live Travel Safety Query Engine</p>
                  </div>
                </div>

                <button onClick={() => setChatOpen(false)} className="p-1 rounded hover:bg-white/10 text-white">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Chat Messages Body */}
              <div className="flex-1 p-3 overflow-y-auto space-y-3 bg-slate-50 text-xs">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[85%] p-3 rounded-2xl shadow-sm leading-relaxed whitespace-pre-line ${
                        msg.sender === 'user'
                          ? 'bg-[#1B2A4A] text-white rounded-tr-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.text}
                    </div>

                    <span className="text-[9px] text-slate-400 mt-0.5 px-1 font-mono">
                      {msg.timestamp}
                    </span>

                    {/* Quick Action Chips */}
                    {msg.quickActions && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {msg.quickActions.map((qa, i) => (
                          <button
                            key={i}
                            onClick={() => handleSendMessage(qa)}
                            className="text-[10px] bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold px-2 py-1 rounded-lg hover:bg-emerald-200 transition"
                          >
                            {qa}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Chat Input Bar */}
              <div className="p-2 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Ask AI safety tip, weather, or routes..."
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-100 text-slate-900 text-xs font-medium focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#2F4538]"
                />
                <button
                  onClick={() => handleSendMessage()}
                  className="p-2.5 rounded-xl bg-[#2F4538] hover:bg-emerald-800 text-white transition"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>

            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: REAL-TIME BROADCAST ALERT POPUP LISTENER */}
      {/* ========================================================= */}
      {activeBroadcastModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-red-900/60 backdrop-blur-md animate-fade-in">
          <div className="bg-white border-4 border-red-600 rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left my-6 animate-bounce-short">
            
            <div className="w-14 h-14 rounded-2xl bg-red-100 border-2 border-red-600 flex items-center justify-center text-red-600 mb-4 mx-auto shadow-lg">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>

            <div className="text-center space-y-2">
              <span className="px-3 py-1 rounded-full bg-red-600 text-white text-[10px] font-black uppercase tracking-widest">
                GEOFENCED BROADCAST ALERT
              </span>
              <h3 className="text-lg font-black text-red-900">
                {language === 'hi' ? activeBroadcastModal.titleHi : activeBroadcastModal.titleEn}
              </h3>
              <p className="text-xs text-slate-700 font-medium leading-relaxed bg-red-50 p-3 rounded-xl border border-red-200">
                {language === 'hi' ? activeBroadcastModal.bodyHi : activeBroadcastModal.bodyEn}
              </p>
            </div>

            <div className="mt-4 text-[10px] text-slate-500 font-mono text-center">
              Source: {activeBroadcastModal.senderBadge} • Radius: {activeBroadcastModal.radiusKm} km
            </div>

            <button
              onClick={() => setActiveBroadcastModal(null)}
              className="mt-5 w-full py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-black text-xs transition shadow-lg"
            >
              Acknowledge Alert
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: ADD ITINERARY ITEM */}
      {/* ========================================================= */}
      {showAddItineraryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-[#1B2A4A] rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left">
            <button
              onClick={() => setShowAddItineraryModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-[#1B2A4A] mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5 text-[#E8935C]" />
              <span>Add Destination to Itinerary</span>
            </h3>

            <form onSubmit={handleAddItinerary} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Destination Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={newDest}
                  onChange={(e) => setNewDest(e.target.value)}
                  placeholder="e.g. Rohtang Glacier Pass or Dharamshala"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Travel Date
                </label>
                <input
                  type="date"
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Hotel / Accommodation
                </label>
                <input
                  type="text"
                  value={newHotel}
                  onChange={(e) => setNewHotel(e.target.value)}
                  placeholder="e.g. Grand Himalayan Lodge"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Activities & Travel Notes
                </label>
                <input
                  type="text"
                  value={newActivities}
                  onChange={(e) => setNewActivities(e.target.value)}
                  placeholder="e.g. Hiking, Cable car ride"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  className="w-full py-3 rounded-xl bg-[#1B2A4A] hover:bg-[#071933] text-white font-black text-xs shadow-md cursor-pointer"
                >
                  Save & AI Safety Check
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: MODIFY / EDIT ITINERARY ITEM */}
      {/* ========================================================= */}
      {showEditItineraryModal && editingItineraryItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-[#1B2A4A] rounded-3xl max-w-md w-full p-6 shadow-2xl relative text-left">
            <button
              onClick={() => {
                setShowEditItineraryModal(false);
                setEditingItineraryItem(null);
              }}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <h3 className="text-lg font-black text-[#1B2A4A] mb-1 flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-[#E8935C]" />
              <span>Modify Itinerary Plan</span>
            </h3>
            <p className="text-xs text-slate-500 font-medium mb-4">
              Update destination details, accommodation, and re-evaluate hazard corridors.
            </p>

            <form onSubmit={handleSaveItineraryModification} className="space-y-4">
              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Destination Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editDest}
                  onChange={(e) => setEditDest(e.target.value)}
                  placeholder="e.g. Rohtang Glacier Pass or Kasol"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Travel Date
                </label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Hotel / Accommodation Stay
                </label>
                <input
                  type="text"
                  value={editHotel}
                  onChange={(e) => setEditHotel(e.target.value)}
                  placeholder="e.g. Grand Himalayan Lodge"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  Activities & Safety Notes
                </label>
                <input
                  type="text"
                  value={editActivities}
                  onChange={(e) => setEditActivities(e.target.value)}
                  placeholder="e.g. Hiking, Cable car ride, local market"
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-slate-900 text-xs font-bold focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditItineraryModal(false);
                    setEditingItineraryItem(null);
                  }}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-3 rounded-xl bg-[#1B2A4A] hover:bg-[#071933] text-white font-black text-xs shadow-md transition cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Check className="w-4 h-4 text-[#E8935C]" />
                  <span>Update & Re-verify</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 1: DIGILOCKER E-KYC CONNECT MODAL */}
      {showDigiLockerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-[#2F4538] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-left">
            <button
              onClick={() => setShowDigiLockerModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-[#2F4538] flex items-center justify-center text-[#2F4538] shadow-sm">
                <FileCheck className="w-7 h-7 text-[#2F4538]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">
                  DigiLocker Identity OAuth
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Government of India National e-Governance Division (NeGD)
                </p>
              </div>
            </div>

            {digiLockerStep === 'connect' && (
              <div className="space-y-4">
                <p className="text-xs text-slate-600 leading-relaxed font-medium">
                  By clicking below, you grant Suraksha Setu one-time OAuth consent to retrieve your verified e-KYC credentials.
                </p>

                <button
                  onClick={handleConnectDigiLocker}
                  className="w-full py-3.5 rounded-xl bg-[#2F4538] hover:bg-emerald-800 text-white font-black text-sm transition shadow-lg flex items-center justify-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span>Authenticate & Fetch DigiLocker Records</span>
                </button>
              </div>
            )}

            {digiLockerStep === 'loading' && (
              <div className="py-12 text-center space-y-4">
                <RefreshCw className="w-10 h-10 text-[#2F4538] animate-spin mx-auto" />
                <p className="text-sm font-bold text-slate-800">
                  Connecting to Government DigiLocker Identity Vault...
                </p>
              </div>
            )}

            {digiLockerStep === 'fetched' && (
              <div className="space-y-5 animate-fade-in">
                <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-300 flex items-center space-x-4">
                  <img
                    src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=300"
                    alt="Verified Photo"
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#2F4538]"
                  />
                  <div>
                    <div className="px-2 py-0.5 rounded bg-[#2F4538] text-white text-[10px] font-black inline-block mb-1">
                      DIGILOCKER VERIFIED E-KYC
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">{fullName || 'Elena Rostova'}</div>
                    <div className="text-xs text-slate-600 font-mono">Aadhaar No: XXXX-XXXX-4912</div>
                  </div>
                </div>

                <button
                  onClick={handleConfirmDigiLocker}
                  className="w-full py-3.5 rounded-xl bg-[#1B2A4A] hover:bg-[#071933] text-white font-black text-sm transition shadow-lg"
                >
                  Attach Verified DigiLocker Badge
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODAL 2: OTP MODAL */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border-2 border-[#1B2A4A] rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl relative text-left">
            <button
              onClick={() => setShowOtpModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-[#E8935C] flex items-center justify-center text-[#1B2A4A]">
                <Smartphone className="w-7 h-7 text-[#1B2A4A]" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900">{t.otpModalTitle}</h3>
                <p className="text-xs text-slate-500 font-medium">
                  {t.otpModalSub} <strong className="text-slate-900">{otpPendingAction === 'signup' ? phone : signinPhone}</strong>
                </p>
              </div>
            </div>

            <form onSubmit={handleVerifyOtp} className="space-y-5">
              {otpError && (
                <div className="p-3 bg-red-50 border border-red-300 text-red-800 text-xs rounded-xl font-bold">
                  {otpError}
                </div>
              )}

              <div>
                <label className="block text-xs font-extrabold text-slate-700 mb-1">
                  6-Digit Verification Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value)}
                  placeholder="654321"
                  className="w-full px-4 py-3 rounded-xl bg-slate-50 border border-slate-300 text-center font-mono text-2xl tracking-[0.4em] font-black focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#2F4538]"
                />
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-[#1B2A4A] hover:bg-[#071933] text-white font-black text-sm transition shadow-lg flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-5 h-5 text-[#E8935C]" />
                <span>{t.verifyOtpBtn}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: DIGITAL PASS MODAL */}
      {showDigitalPassModal && authenticatedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white border-2 border-[#2F4538] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-left my-8">
            <button
              onClick={() => setShowDigitalPassModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-slate-200 pb-4 mb-5 text-center">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-[#2F4538] text-[11px] font-black uppercase mb-2">
                <ShieldCheck className="w-4 h-4" />
                <span>Suraksha Setu • Government Official Pass</span>
              </div>
              <h3 className="text-xl font-black text-[#1B2A4A]">
                Digital Tourist Safety Pass
              </h3>
            </div>

            <div className="p-5 bg-gradient-to-br from-slate-900 via-[#1B2A4A] to-slate-900 text-white rounded-2xl shadow-xl relative overflow-hidden border-2 border-[#E8935C]/50">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center space-x-3">
                  <img
                    src={authenticatedUser.photoUrl}
                    alt={authenticatedUser.name}
                    className="w-16 h-16 rounded-2xl object-cover border-2 border-[#E8935C]"
                  />
                  <div>
                    <div className="text-xs text-[#E8935C] font-bold uppercase tracking-wider">Verified Traveler</div>
                    <div className="text-lg font-black text-white">{authenticatedUser.name}</div>
                    <div className="text-xs text-slate-300 font-mono mt-0.5">{authenticatedUser.phone}</div>
                  </div>
                </div>

                <div className="bg-white p-2 rounded-xl text-slate-900 flex flex-col items-center flex-shrink-0 shadow">
                  <QrCode className="w-12 h-12 text-[#1B2A4A]" />
                  <span className="text-[8px] font-mono font-bold mt-1 text-slate-600">SCAN FOR POLICE</span>
                </div>
              </div>

              <div className="mt-5 p-3 bg-white/10 backdrop-blur rounded-xl border border-white/20 flex items-center justify-between">
                <div>
                  <div className="text-[10px] text-slate-300 font-bold uppercase">Official Tourist ID</div>
                  <div className="text-xl font-mono font-black text-[#E8935C] tracking-wider">{authenticatedUser.id}</div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopyTouristId(authenticatedUser.id)}
                  className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copySuccess ? 'Copied!' : 'Copy ID'}</span>
                </button>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {downloadSuccess && (
                <div className="p-2.5 bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold rounded-xl text-center">
                  ✅ Digital Pass PDF downloaded to your device!
                </div>
              )}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleDownloadPass}
                  className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-900 font-extrabold text-xs transition border border-slate-300 flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4 text-[#1B2A4A]" />
                  <span>Download Pass</span>
                </button>

                <button
                  type="button"
                  onClick={handlePassModalProceed}
                  className="flex-1 py-3 rounded-xl bg-[#2F4538] hover:bg-emerald-800 text-white font-black text-xs transition shadow-md flex items-center justify-center gap-2"
                >
                  <span>Activate Trip & Consent</span>
                  <ArrowLeft className="w-4 h-4 rotate-180 text-[#E8935C]" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: MANDATORY CONSENT MODAL */}
      {showConsentModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white border-4 border-[#2F4538] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-left my-6">
            <div className="w-14 h-14 rounded-2xl bg-emerald-50 border-2 border-[#2F4538] flex items-center justify-center text-[#2F4538] mb-5 shadow-md">
              <Navigation className="w-8 h-8 text-[#2F4538] animate-pulse" />
            </div>

            <div className="space-y-3 mb-6">
              <span className="px-3 py-1 rounded-full bg-emerald-100 text-[#2F4538] text-[10px] font-black uppercase">
                {t.consentModalSub}
              </span>
              <h3 className="text-xl font-black text-slate-900 leading-tight">
                {t.consentModalTitle}
              </h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-200">
                {t.consentModalDesc}
              </p>
            </div>

            <div className="space-y-3">
              <button
                type="button"
                disabled={locationAcquiring}
                onClick={handleGrantConsent}
                className="w-full py-4 rounded-2xl bg-[#2F4538] hover:bg-emerald-800 text-white font-black text-sm transition shadow-xl flex items-center justify-center gap-2 cursor-pointer disabled:opacity-75"
              >
                {locationAcquiring ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                    <span>Acquiring Live GPS Location...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-5 h-5 text-[#E8935C]" />
                    <span>{t.consentEnableBtn}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={locationAcquiring}
                onClick={handleDeclineConsent}
                className="w-full py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition border border-slate-300 cursor-pointer"
              >
                {t.consentDeclineBtn}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: TOURIST PROFILE MODAL */}
      {showProfileModal && authenticatedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white border-2 border-[#1B2A4A] rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl relative text-left my-8 space-y-5">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-slate-100 text-slate-500 font-bold transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3 pb-4 border-b border-slate-200">
              <img
                src={authenticatedUser.photoUrl}
                alt={authenticatedUser.name}
                className="w-14 h-14 rounded-2xl object-cover border-2 border-[#2F4538] shadow-md flex-shrink-0"
              />
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-xl font-black text-slate-900">
                    {authenticatedUser.name}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-[#2F4538] border border-emerald-300 font-mono text-[10px] font-black">
                    {authenticatedUser.id}
                  </span>
                </div>
                <div className="text-xs text-slate-500 font-medium mt-0.5">{authenticatedUser.phone}</div>
                {authenticatedUser.digiLockerVerified && (
                  <span className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold border border-blue-200">
                    <ShieldCheck className="w-3 h-3 text-blue-600" /> DigiLocker e-KYC Verified
                  </span>
                )}
              </div>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase">Digital Band ID</span>
                <div className="font-mono font-black text-slate-900 text-sm mt-0.5">{authenticatedUser.digitalBandId}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase">Nationality / Origin</span>
                <div className="font-bold text-slate-900 text-xs mt-0.5">{authenticatedUser.nationality}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase">Emergency Contact</span>
                <div className="font-bold text-slate-900 text-xs mt-0.5">{authenticatedUser.emergencyContact}</div>
              </div>
              <div>
                <span className="text-[10px] font-extrabold text-slate-500 uppercase">Trip Status</span>
                <div className="font-bold text-slate-900 text-xs mt-0.5">Active Verified Tour</div>
              </div>
            </div>

            {/* GPS Telemetry Consent Status */}
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <div className="text-[10px] font-extrabold text-slate-500 uppercase">Location & Safety Telemetry</div>
              <div className="flex items-center justify-between">
                {locationConsent === 'granted' ? (
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-[#2F4538] border border-emerald-300 text-xs font-extrabold flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5 text-[#2F4538] animate-pulse" />
                    <span>GPS Telemetry ACTIVE</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-900 border border-amber-300 text-xs font-extrabold flex items-center gap-1.5">
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>Location Access DECLINED</span>
                  </span>
                )}
                <button
                  onClick={() => {
                    setShowProfileModal(false);
                    setShowConsentModal(true);
                  }}
                  className="text-xs font-black text-blue-700 hover:underline"
                >
                  Configure
                </button>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-2.5 pt-2">
              <button
                onClick={() => {
                  setShowProfileModal(false);
                  setShowDigitalPassModal(true);
                }}
                className="w-full py-3 px-4 bg-[#1B2A4A] hover:bg-[#071933] text-white font-extrabold text-xs rounded-xl shadow transition flex items-center justify-center gap-2"
              >
                <QrCode className="w-4 h-4 text-[#E8935C]" />
                <span>View Digital Safety Pass & QR Code</span>
              </button>

              <button
                onClick={handleTriggerSimulatedAlert}
                className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 text-amber-900 font-extrabold text-xs rounded-xl border border-amber-300 transition flex items-center justify-center gap-2"
              >
                <Bell className="w-4 h-4 text-[#E8935C] animate-bounce" />
                <span>Test Broadcast Alert Simulation</span>
              </button>

              <button
                onClick={() => {
                  setShowProfileModal(false);
                  handleSignOut();
                }}
                className="w-full py-2.5 px-4 bg-red-50 hover:bg-red-100 text-red-800 font-bold text-xs rounded-xl border border-red-200 transition flex items-center gap-2 justify-center"
              >
                <LogOut className="w-4 h-4 text-red-600" />
                <span>Sign Out Account</span>
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
