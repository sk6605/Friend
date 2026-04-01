'use client';

import { useState, useEffect, useCallback } from 'react';
import FileManagerView from '@/app/components/FileManagerView';
import { COUNTRIES } from '@/app/lib/locations';
import NotificationSettings from './NotificationSettings';
import { getAllPersonas, type PersonaKey } from '@/app/lib/ai/personaPrompts';

const PERSONAS = getAllPersonas();

interface SettingsModalProps {
  userId: string;
  profilePicture?: string | null;
  onClose: () => void;
  onProfileUpdate?: () => void;
}

type SettingsView = 'menu' | 'personalization' | 'security' | 'email' | 'language' | 'avatar' | 'location' | 'dataControl' | 'notifications' | 'persona' | 'files';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'zh', label: '中文 (Chinese)', flag: '🇨🇳' },
  { code: 'es', label: 'Español (Spanish)', flag: '🇪🇸' },
  { code: 'ja', label: '日本語 (Japanese)', flag: '🇯🇵' },
  { code: 'ko', label: '한국어 (Korean)', flag: '🇰🇷' },
  { code: 'ms', label: 'Bahasa Melayu (Malay)', flag: '🇲🇾' },
];

export default function SettingsModal({ userId, profilePicture, onClose, onProfileUpdate }: SettingsModalProps) {
  const [view, setView] = useState<SettingsView>('menu');
  const [newEmail, setNewEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Language state
  const [currentLang, setCurrentLang] = useState('en');
  const [selectedLang, setSelectedLang] = useState('en');

  // Avatar state
  const [avatarUrl, setAvatarUrl] = useState<string | null>(profilePicture ?? null);
  const [avatarUploading, setAvatarUploading] = useState(false);

  // Location & schedule state
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [departureTime, setDepartureTime] = useState('');

  // Data control state
  const [dataControl, setDataControl] = useState(true);

  // Persona state
  const [currentPersona, setCurrentPersona] = useState<PersonaKey>('default');
  const [selectedPersona, setSelectedPersona] = useState<PersonaKey>('default');
  const [dataControlSaving, setDataControlSaving] = useState(false);

  // Derived: cities for selected country
  const selectedCountryData = COUNTRIES.find(c => c.code === country);
  const availableCities = selectedCountryData?.cities || [];

  // Fetch current user data on mount
  useEffect(() => {
    fetch(`/api/users/${userId}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data?.language) {
          setCurrentLang(data.language);
          setSelectedLang(data.language);
        }
        if (data?.country) setCountry(data.country);
        if (data?.city) setCity(data.city);
        if (data?.departureTime) setDepartureTime(data.departureTime);
        if (typeof data?.dataControl === 'boolean') setDataControl(data.dataControl);
        if (data?.persona) {
          setCurrentPersona(data.persona);
          setSelectedPersona(data.persona);
        }
      })
      .catch(() => { });
  }, [userId]);

  const resetForm = () => {
    setNewEmail('');
    setError('');
    setSuccess('');
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!newEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/users/${userId}/email`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newEmail }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to change email');
        return;
      }

      setSuccess('Email changed successfully');
      resetForm();
      setTimeout(() => setView('menu'), 1500);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeLanguage = async () => {
    if (selectedLang === currentLang) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ language: selectedLang }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update language');
        return;
      }

      setCurrentLang(selectedLang);
      setSuccess('Language updated! New chats will use this language.');
      setTimeout(() => {
        setView('menu');
        setSuccess('');
        // Reload to apply language change across the app
        window.location.reload();
      }, 1500);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePersona = async () => {
    if (selectedPersona === currentPersona) return;

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ persona: selectedPersona }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update personality');
        return;
      }

      setCurrentPersona(selectedPersona);
      setSuccess('Personality updated! Your AI will now respond with this style.');
      onProfileUpdate?.(); // Trigger user info refresh so avatar changes immediately
      setTimeout(() => {
        setView('menu');
        setSuccess('');
      }, 1500);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');
    setAvatarUploading(true);

    try {
      const formData = new FormData();
      formData.append('avatar', file);

      const res = await fetch(`/api/users/${userId}/avatar`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to upload avatar');
        return;
      }

      setAvatarUrl(data.url);
      setSuccess('Profile picture updated!');
      onProfileUpdate?.();
    } catch {
      setError('Something went wrong');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleAvatarDelete = async () => {
    setError('');
    setSuccess('');
    setAvatarUploading(true);

    try {
      const res = await fetch(`/api/users/${userId}/avatar`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to remove avatar');
        return;
      }

      setAvatarUrl(null);
      setSuccess('Profile picture removed');
      onProfileUpdate?.();
    } catch {
      setError('Something went wrong');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleSaveLocation = async () => {
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const body: Record<string, string> = {};
      if (country) body.country = country;
      if (city) body.city = city;
      if (departureTime) body.departureTime = departureTime;

      if (!country && !city) {
        setError('Please select a country and city');
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to save');
        return;
      }

      setSuccess('Settings saved!');
      setTimeout(() => { setView('menu'); setSuccess(''); }, 1500);
    } catch {
      setError('Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleDataControl = async (newValue: boolean) => {
    setDataControlSaving(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataControl: newValue }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to update');
        return;
      }

      setDataControl(newValue);
      setSuccess(newValue ? 'Data sharing enabled' : 'Data sharing disabled');
      setTimeout(() => setSuccess(''), 2000);
    } catch {
      setError('Something went wrong');
    } finally {
      setDataControlSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div role="dialog" aria-modal="true" aria-label="Settings" className="relative w-full max-w-md mx-4 bg-[#faf7f2] dark:bg-[#1e1b2e] rounded-2xl shadow-2xl border border-purple-100 dark:border-purple-800/40 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-purple-50 dark:border-purple-800/30">
          <div className="flex items-center gap-2">
            {view !== 'menu' && (
              <button
                onClick={() => {
                  // Sub-views go back to their parent category, categories go to menu
                  const personalizationViews = ['avatar', 'language', 'persona', 'location', 'files'];
                  const securityViews = ['email', 'dataControl', 'notifications'];
                  if (personalizationViews.includes(view)) {
                    setView('personalization');
                  } else if (securityViews.includes(view)) {
                    setView('security');
                  } else {
                    setView('menu');
                  }
                  resetForm(); setError(''); setSuccess('');
                }}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors mr-1"
                aria-label="Back"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            )}
            <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              {view === 'menu' && 'Settings'}
              {view === 'personalization' && 'Personalization'}
              {view === 'security' && 'Security & Privacy'}
              {view === 'avatar' && 'Profile Picture'}
              {view === 'email' && 'Change Email'}
              {view === 'language' && 'AI Language'}
              {view === 'location' && 'Location & Schedule'}
              {view === 'dataControl' && 'Data Control'}
              {view === 'notifications' && 'Notifications'}
              {view === 'persona' && 'AI Personality'}
              {view === 'files' && 'My Files'}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close settings"
            className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Menu view */}
          {view === 'menu' && (
            <div className="space-y-3">
              {/* Personalization category */}
              <button
                onClick={() => setView('personalization')}
                className="
                  w-full flex items-center gap-4 px-5 py-4 rounded-2xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50/80 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                  group
                "
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-base">Personalization</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Profile, language, AI personality & location</div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Security & Privacy category */}
              <button
                onClick={() => setView('security')}
                className="
                  w-full flex items-center gap-4 px-5 py-4 rounded-2xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50/80 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                  group
                "
              >
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shrink-0 shadow-sm">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-base">Security & Privacy</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Email, data control & notifications</div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 group-hover:text-emerald-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Personalization sub-menu */}
          {view === 'personalization' && (
            <div className="space-y-2">
              <button
                onClick={() => { setView('avatar'); resetForm(); setError(''); setSuccess(''); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt="Avatar" className="w-8 h-8 rounded-full object-cover border border-purple-300" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/40 flex items-center justify-center">
                    <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
                <div>
                  <div className="font-medium">Profile Picture</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {avatarUrl ? 'Change or remove your photo' : 'Add a profile photo'}
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => { setView('language'); resetForm(); setError(''); setSuccess(''); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364C11.176 10.658 7.69 15.08 3 17.502m9.334-12.138c.896.061 1.785.147 2.666.257m-4.589 8.495a18.023 18.023 0 01-3.827-5.802" />
                </svg>
                <div>
                  <div className="font-medium">AI Language</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    Currently: {LANGUAGES.find(l => l.code === currentLang)?.label || currentLang}
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => { setView('persona'); resetForm(); setError(''); setSuccess(''); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <span className="text-lg w-5 text-center">{PERSONAS.find(p => p.key === currentPersona)?.emoji || '😊'}</span>
                <div>
                  <div className="font-medium">AI Personality</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    Currently: {PERSONAS.find(p => p.key === currentPersona)?.name || 'Balanced Lumi'}
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => { setView('location'); resetForm(); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                </svg>
                <div>
                  <div className="font-medium">Location & Schedule</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {city ? `${COUNTRIES.find(c => c.code === country)?.flag || ''} ${city}` : 'Set your location'}{departureTime ? ` · Leave at ${departureTime}` : ''}
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => { setView('files'); resetForm(); setError(''); setSuccess(''); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <svg className="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.25 12.75V12A2.25 2.25 0 014.5 9.75h15A2.25 2.25 0 0121.75 12v.75m-8.69-6.44l-2.12-2.12a1.5 1.5 0 00-1.061-.44H4.5A2.25 2.25 0 002.25 6v12a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9a2.25 2.25 0 00-2.25-2.25h-5.379a1.5 1.5 0 01-1.06-.44z" />
                </svg>
                <div>
                  <div className="font-medium">My Files</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">View & manage uploaded files</div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          )}

          {/* Security & Privacy sub-menu */}
          {view === 'security' && (
            <div className="space-y-2">
              <button
                onClick={() => { setView('email'); resetForm(); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
                <div>
                  <div className="font-medium">Change Email</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Update your login email address</div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => { setView('dataControl'); resetForm(); setError(''); setSuccess(''); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
                <div>
                  <div className="font-medium">Data Control</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {dataControl ? 'Sharing enabled — AI learns from chats' : 'Sharing disabled — no data used'}
                  </div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              <button
                onClick={() => { setView('notifications'); resetForm(); setError(''); setSuccess(''); }}
                className="
                  w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                  text-left text-sm text-neutral-700 dark:text-neutral-200
                  hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                  border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                "
              >
                <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                </svg>
                <div>
                  <div className="font-medium">Notifications</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Push notifications & reminders</div>
                </div>
                <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>

              {/* Legal links */}
              <div className="pt-2 mt-2 border-t border-neutral-100 dark:border-neutral-800 space-y-2">
                <a
                  href="/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                    text-left text-sm text-neutral-700 dark:text-neutral-200
                    hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                    border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                  "
                >
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                  </svg>
                  <div>
                    <div className="font-medium">Privacy Policy</div>
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">How we handle your data</div>
                  </div>
                  <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>

                <a
                  href="/terms"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="
                    w-full flex items-center gap-3 px-4 py-3.5 rounded-xl
                    text-left text-sm text-neutral-700 dark:text-neutral-200
                    hover:bg-purple-50 dark:hover:bg-white/5 transition-all duration-200
                    border border-neutral-100 dark:border-neutral-700 hover:border-purple-200 dark:hover:border-purple-700/50
                  "
                >
                  <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
                  </svg>
                  <div>
                    <div className="font-medium">Terms of Service</div>
                    <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">Platform rules & disclaimers</div>
                  </div>
                  <svg className="w-4 h-4 text-neutral-300 dark:text-neutral-600 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>
            </div>
          )}

          {/* Language selector view */}
          {view === 'language' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Choose the language the AI will use for all responses.
              </p>

              <div className="space-y-1.5">
                {LANGUAGES.map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => setSelectedLang(lang.code)}
                    className={`
                      w-full flex items-center gap-3 px-4 py-3 rounded-xl
                      text-left text-sm transition-all duration-200
                      border
                      ${selectedLang === lang.code
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600 text-purple-700 dark:text-purple-300'
                        : 'border-neutral-100 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-white/5 hover:border-neutral-200 dark:hover:border-neutral-600'
                      }
                    `}
                  >
                    <span className="text-lg">{lang.flag}</span>
                    <span className="font-medium">{lang.label}</span>
                    {selectedLang === lang.code && (
                      <svg className="w-4 h-4 text-purple-500 ml-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                ))}
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</div>}
              {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">{success}</div>}

              <button
                onClick={handleChangeLanguage}
                disabled={loading || selectedLang === currentLang}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
              >
                {loading ? 'Saving...' : selectedLang === currentLang ? 'No changes' : 'Save Language'}
              </button>
            </div>
          )}

          {/* Location & Schedule view */}
          {view === 'location' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Select your location for weather alerts and set your departure time for umbrella reminders.
              </p>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Country</label>
                <select
                  title="Select country"
                  value={country}
                  onChange={(e) => {
                    setCountry(e.target.value);
                    setCity(''); // reset city when country changes
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-[#2a2440] border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all appearance-none cursor-pointer"
                >
                  <option value="">Select country...</option>
                  {COUNTRIES.map(c => (
                    <option key={c.code} value={c.code} className="bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100">
                      {c.flag} {c.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">City / Region</label>
                <select
                  title="Select city"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  disabled={!country}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-[#2a2440] border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all appearance-none cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <option value="">{country ? 'Select city...' : 'Select a country first'}</option>
                  {availableCities.map(c => (
                    <option key={c} value={c} className="bg-white dark:bg-[#2a2440] text-neutral-800 dark:text-neutral-100">
                      {c}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Used for weather queries and rain alerts
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">Departure Time</label>
                <input
                  title="Select departure time"
                  type="time"
                  value={departureTime}
                  onChange={(e) => setDepartureTime(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-[#2a2440] border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all dark:scheme-dark"
                />
                <p className="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                  Rain alerts will be sent 15 minutes before this time (default: 7:30 AM)
                </p>
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</div>}
              {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">{success}</div>}

              <button
                onClick={handleSaveLocation}
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
              >
                {loading ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          )}

          {/* Avatar upload view */}
          {view === 'avatar' && (
            <div className="space-y-5">
              {/* Current avatar preview */}
              <div className="flex flex-col items-center gap-3">
                {avatarUrl ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={avatarUrl}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-purple-200 dark:border-purple-700 shadow-lg"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full bg-purple-100 dark:bg-purple-900/40 border-4 border-purple-200 dark:border-purple-700 flex items-center justify-center shadow-lg">
                    <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </div>
                )}
                <p className="text-xs text-neutral-400 dark:text-neutral-500">
                  PNG, JPG, WebP, or GIF. Max 5MB.
                </p>
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</div>}
              {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">{success}</div>}

              {/* Upload button */}
              <label className="block">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  onChange={handleAvatarUpload}
                  disabled={avatarUploading}
                  className="hidden"
                />
                <div className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 cursor-pointer hover:shadow-md active:scale-[0.98] text-center">
                  {avatarUploading ? 'Uploading...' : avatarUrl ? 'Change Photo' : 'Upload Photo'}
                </div>
              </label>

              {/* Remove button */}
              {avatarUrl && (
                <button
                  onClick={handleAvatarDelete}
                  disabled={avatarUploading}
                  className="w-full py-2.5 rounded-xl text-sm font-medium text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-all duration-200 disabled:opacity-50 border border-red-200 dark:border-red-800/40"
                >
                  Remove Photo
                </button>
              )}
            </div>
          )}

          {/* Data Control view */}
          {view === 'dataControl' && (
            <div className="space-y-4">
              {/* Toggle */}
              <div className="flex items-center justify-between px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-white/5">
                <div className="flex-1 mr-4">
                  <div className="text-sm font-medium text-neutral-800 dark:text-neutral-100">Allow AI Improvement</div>
                  <div className="text-xs text-neutral-400 dark:text-neutral-500 mt-0.5">
                    {dataControl ? 'AI learns from your chats daily' : 'No data used for improvement'}
                  </div>
                </div>
                <button
                  onClick={() => handleToggleDataControl(!dataControl)}
                  disabled={dataControlSaving}
                  className={`
                    relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                    transition-colors duration-200 ease-in-out focus:outline-none
                    disabled:opacity-50 disabled:cursor-not-allowed
                    ${dataControl ? 'bg-purple-600' : 'bg-neutral-300 dark:bg-neutral-600'}
                  `}
                  type="button"
                  role="switch"
                  aria-checked={dataControl}
                  aria-label="Toggle data control"
                >
                  <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform duration-200 ease-in-out ${dataControl ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Details — conditionally show enabled/disabled info */}
              <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 overflow-hidden">
                <ul className="px-4 py-2.5 space-y-2 text-xs text-neutral-600 dark:text-neutral-300">
                  {dataControl ? (
                    <>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span>Daily midnight analysis builds your AI profile</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span>Remembers preferences, interests & style</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        <span>Mood tracking & daily insights generated</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-purple-500 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>
                        <span>Unsafe & extreme content auto-filtered</span>
                      </li>
                    </>
                  ) : (
                    <>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        <span>No conversations used for improvement</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        <span>No daily analysis or mood tracking</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <svg className="w-3.5 h-3.5 text-neutral-400 mt-0.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        <span>AI memory won&apos;t update with new info</span>
                      </li>
                    </>
                  )}
                </ul>
              </div>

              {/* Safety notice */}
              <div className="px-3 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
                <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                  <strong>Safety:</strong> If a safety concern is detected (risk level 2+), data may still be retained to ensure your wellbeing.
                </p>
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</div>}
              {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">{success}</div>}
            </div>
          )}

          {/* Notifications view */}
          {view === 'notifications' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Manage push notifications for daily greetings and schedule reminders.
              </p>
              <NotificationSettings userId={userId} />
            </div>
          )}

          {/* Persona selector view */}
          {view === 'persona' && (
            <div className="space-y-4">
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                Choose how your AI friend talks and behaves.
              </p>

              <div className="space-y-2">
                {PERSONAS.map(p => (
                  <button
                    key={p.key}
                    onClick={() => setSelectedPersona(p.key)}
                    className={`
                      w-full text-left px-4 py-3.5 rounded-xl transition-all duration-200 border
                      ${selectedPersona === p.key
                        ? 'bg-purple-50 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600'
                        : 'border-neutral-100 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-white/5 hover:border-neutral-200 dark:hover:border-neutral-600'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-2xl mt-0.5">{p.emoji}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm font-semibold ${selectedPersona === p.key
                            ? 'text-purple-700 dark:text-purple-300'
                            : 'text-neutral-700 dark:text-neutral-200'
                            }`}>{p.name}</span>
                          {selectedPersona === p.key && (
                            <svg className="w-4 h-4 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{p.description}</p>
                        <p className="text-xs text-purple-400 dark:text-purple-500 mt-1.5 italic">{p.previewQuote}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</div>}
              {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">{success}</div>}

              <button
                onClick={handleChangePersona}
                disabled={loading || selectedPersona === currentPersona}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
              >
                {loading ? 'Saving...' : selectedPersona === currentPersona ? 'No changes' : 'Save Personality'}
              </button>
            </div>
          )}

          {/* Change email form */}
          {view === 'email' && (
            <form onSubmit={handleChangeEmail} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1.5">New Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-xl text-sm bg-neutral-50 dark:bg-white/5 border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 dark:focus:ring-purple-900/30 transition-all"
                />
              </div>

              {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-4 py-2 rounded-xl">{error}</div>}
              {success && <div className="text-sm text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-4 py-2 rounded-xl">{success}</div>}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl text-sm font-semibold text-white bg-purple-600 hover:bg-purple-700 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-md active:scale-[0.98]"
              >
                {loading ? 'Updating...' : 'Update Email'}
              </button>
            </form>
          )}

          {/* File Management view */}
          {view === 'files' && (
            <FileManagerView userId={userId} />
          )}
        </div>
      </div>
    </div>
  );
}
