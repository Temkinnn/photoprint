import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { CalendarSlot, MeetingItem } from '../types';
import {
  Calendar,
  Clock,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  Send,
  FileText,
  CalendarDays,
  Sparkles,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Download,
  Trash2,
  MapPin,
  Play,
  Check,
  X,
  MailCheck,
  Layers,
  LayoutGrid
} from 'lucide-react';

export const MeetingScheduleView: React.FC = () => {
  const {
    meetingDraft,
    calendarSlots,
    scheduleMeeting,
    cancelMeeting,
    fetchSlotsForDate,
    scheduledMeetings,
    setActiveTab,
    logAudit,
    showToast
  } = useApp();

  const [selectedDate, setSelectedDate] = useState<string>('2026-11-12');
  const [selectedSlotId, setSelectedSlotId] = useState<string>('');
  const [customStartTime, setCustomStartTime] = useState<string>('14:00');
  const [meetingDuration, setMeetingDuration] = useState<number>(60);
  const [location, setLocation] = useState<string>('Переговорная 1 · Главный корпус');
  const [viewMode, setViewMode] = useState<'slots' | 'timeline'>('slots');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showInviteModal, setShowInviteModal] = useState<boolean>(false);

  // Fetch / update slots whenever selectedDate changes
  useEffect(() => {
    fetchSlotsForDate(selectedDate);
  }, [selectedDate]);

  // Current active slots for the date
  const currentSlots = calendarSlots.filter((s) => s.date === selectedDate).length > 0
    ? calendarSlots.filter((s) => s.date === selectedDate)
    : calendarSlots;

  // Set default slot when slots update
  useEffect(() => {
    const firstAvailable = currentSlots.find((s) => s.isAvailable);
    if (firstAvailable) {
      setSelectedSlotId(firstAvailable.id);
      setCustomStartTime(firstAvailable.startTime);
    } else if (currentSlots[0]) {
      setSelectedSlotId(currentSlots[0].id);
      setCustomStartTime(currentSlots[0].startTime);
    }
  }, [selectedDate, calendarSlots]);

  const activeSlot = currentSlots.find((s) => s.id === selectedSlotId) || currentSlots[0];

  // Calculate meeting end time based on start time and duration
  const calculateEndTime = (start: string, durationMin: number): string => {
    const [h, m] = start.split(':').map(Number);
    if (isNaN(h) || isNaN(m)) return '15:00';
    const total = h * 60 + m + durationMin;
    const endH = Math.floor(total / 60) % 24;
    const endM = total % 60;
    return `${String(endH).padStart(2, '0')}:${String(endM).padStart(2, '0')}`;
  };

  const calculatedEndTime = activeSlot ? activeSlot.endTime : calculateEndTime(customStartTime, meetingDuration);

  // Check collision for custom start time or selected slot
  const isTimeConflicting = (): { hasConflict: boolean; reason?: string } => {
    if (activeSlot && !activeSlot.isAvailable) {
      return {
        hasConflict: true,
        reason: 'Выбранный слот занят или часть участников уже имеет совещание.'
      };
    }
    const existing = scheduledMeetings.find(
      (m) => m.date === selectedDate && m.status === 'scheduled' && m.time.includes(customStartTime)
    );
    if (existing) {
      return {
        hasConflict: true,
        reason: `В ${customStartTime} уже назначено: «${existing.title}»`
      };
    }
    return { hasConflict: false };
  };

  const collision = isTimeConflicting();

  // Date navigation helpers
  const handleDateShift = (days: number) => {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    const newDateStr = d.toISOString().split('T')[0];
    setSelectedDate(newDateStr);
  };

  // iCalendar (.ics) generator
  const downloadICS = (meeting: MeetingItem) => {
    const [startH, startM] = (meeting.time.split('-')[0] || '10:00').trim().split(':').map(Number);
    const duration = meeting.durationMinutes || 60;
    const cleanDate = meeting.date.replace(/-/g, '');
    const startTimeStr = `${cleanDate}T${String(startH).padStart(2, '0')}${String(startM).padStart(2, '0')}00`;

    const totalEndMin = startH * 60 + startM + duration;
    const endH = Math.floor(totalEndMin / 60) % 24;
    const endM = totalEndMin % 60;
    const endTimeStr = `${cleanDate}T${String(endH).padStart(2, '0')}${String(endM).padStart(2, '0')}00`;

    const icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Photoprint LLC//Meeting Assistant//RU',
      'CALSCALE:GREGORIAN',
      'METHOD:REQUEST',
      'BEGIN:VEVENT',
      `UID:${meeting.id}@photoprint.local`,
      `DTSTAMP:${cleanDate}T000000Z`,
      `DTSTART:${startTimeStr}`,
      `DTEND:${endTimeStr}`,
      `SUMMARY:${meeting.title}`,
      `DESCRIPTION:${(meeting.agenda || []).join('\\n')}`,
      `LOCATION:${location}`,
      'STATUS:CONFIRMED',
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${meeting.title.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_')}.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Календарь .ics', 'Файл приглашения выгружен для Outlook / Google Calendar', 'success');
  };

  const handleConfirmCreation = async () => {
    if (collision.hasConflict) {
      showToast('Конфликт времени', collision.reason || 'Слот занят', 'warning');
      return;
    }

    setIsSubmitting(true);
    const finalStartTime = activeSlot ? activeSlot.startTime : customStartTime;
    const finalEndTime = activeSlot ? activeSlot.endTime : calculatedEndTime;

    try {
      await scheduleMeeting({
        title: meetingDraft.topic,
        date: selectedDate,
        time: `${finalStartTime} – ${finalEndTime}`,
        durationMinutes: meetingDuration,
        participants: meetingDraft.participants,
        agenda: meetingDraft.agenda
      });

      logAudit(
        'CREATE_MEETING_CONFIRMED',
        `Встреча: ${meetingDraft.topic}`,
        'SUCCESS',
        `Пользователь подтвердил создание встречи: «${meetingDraft.topic}» на ${selectedDate} ${finalStartTime}–${finalEndTime}. Приглашения отправлены.`
      );

      setShowInviteModal(true);
      showToast(
        'Встреча зафиксирована',
        `Событие создано в календаре, участникам направлены уведомления`,
        'success'
      );
    } catch {
      showToast('Ошибка создания', 'Не удалось сохранить встречу на сервере', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelMeeting = async (meetingId: string) => {
    if (window.confirm('Вы уверены, что хотите отменить эту встречу и освободить время в календаре?')) {
      await cancelMeeting(meetingId);
    }
  };

  const handleStartMeetingNow = (meeting: MeetingItem) => {
    showToast('Переход к протоколу', `Открываем протокол для «${meeting.title}»`, 'info');
    setActiveTab('meeting_protocol');
  };

  // Timeline slots definition for 09:00 - 18:00
  const HOURS = ['09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00'];

  return (
    <div className="flex-1 flex flex-col h-full bg-[#f6f7f9] dark:bg-[#0c0d12] overflow-y-auto p-6 lg:p-8 transition-colors">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* ========================================================================= */}
        {/* HEADER                                                                    */}
        {/* ========================================================================= */}
        <div className="pb-4 border-b border-neutral-200 dark:border-[#212530] flex items-center justify-between flex-wrap gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-sky-500 ring-2 ring-sky-500/20" />
              <h1 className="text-base font-bold text-neutral-950 dark:text-white tracking-tight">
                Создание встречи в календаре
              </h1>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
              Подбор свободного времени, бронирование слота и рассылка приглашений участникам
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('meeting_prep')}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-300 bg-white dark:bg-[#161820] hover:bg-neutral-100 dark:hover:bg-[#1f232e] border border-neutral-200 dark:border-[#262a36] rounded transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Назад к подготовке</span>
            </button>
            <button
              onClick={() => setActiveTab('meeting_protocol')}
              className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded-md transition-colors shadow-sm"
            >
              <span>Перейти к протоколу и summary</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* HUMAN-IN-THE-LOOP COMPLIANCE CALLOUT                                      */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-lg bg-sky-500/[0.07] dark:bg-sky-500/[0.1] border border-sky-500/25 text-xs flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-neutral-950 dark:text-white">
              Подтверждение пользователем перед созданием события
            </div>
            <div className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
              Система анализирует тестовый календарь и предлагает свободные окна. Событие в базе данных и приглашения участникам отправляются <strong>только после вашего подтверждения</strong> кнопкой «Подтвердить создание встречи».
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN WORKSPACE: 2-COLUMN LAYOUT                                           */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: INTERACTIVE CALENDAR & VIEW (7 COLS) */}
          <div className="lg:col-span-7 space-y-4 bg-white dark:bg-[#13151b] p-5 rounded-lg border border-neutral-200 dark:border-[#212530]">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100 dark:border-[#202430] flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-500" />
                <h3 className="text-xs font-bold text-neutral-950 dark:text-white tracking-wide">
                  Тестовый календарь свободных окон
                </h3>
              </div>

              {/* View Mode Toggle */}
              <div className="flex items-center bg-neutral-100 dark:bg-[#1a1d26] p-0.5 rounded-md border border-neutral-200 dark:border-[#282d3b] text-xs">
                <button
                  onClick={() => setViewMode('slots')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                    viewMode === 'slots'
                      ? 'bg-white dark:bg-[#252a37] text-neutral-950 dark:text-white shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <LayoutGrid className="w-3 h-3" />
                  <span>Слоты</span>
                </button>
                <button
                  onClick={() => setViewMode('timeline')}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium flex items-center gap-1.5 transition-colors ${
                    viewMode === 'timeline'
                      ? 'bg-white dark:bg-[#252a37] text-neutral-950 dark:text-white shadow-sm'
                      : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900'
                  }`}
                >
                  <Layers className="w-3 h-3" />
                  <span>Шкала дня</span>
                </button>
              </div>
            </div>

            {/* Date Navigator Bar */}
            <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-neutral-50 dark:bg-[#161820] border border-neutral-200 dark:border-[#242835]">
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleDateShift(-1)}
                  title="Предыдущий день"
                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-[#202430] text-neutral-600 dark:text-neutral-300 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setSelectedDate('2026-11-12')}
                  className="px-2 py-0.5 text-xs font-semibold text-neutral-800 dark:text-neutral-200 rounded hover:bg-neutral-200 dark:hover:bg-[#202430] transition-colors"
                >
                  Сегодня
                </button>
                <button
                  onClick={() => handleDateShift(1)}
                  title="Следующий день"
                  className="p-1 rounded hover:bg-neutral-200 dark:hover:bg-[#202430] text-neutral-600 dark:text-neutral-300 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              {/* Native Date Picker */}
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => e.target.value && setSelectedDate(e.target.value)}
                  className="px-2 py-1 text-xs font-mono font-medium bg-white dark:bg-[#1a1d26] text-neutral-900 dark:text-neutral-100 border border-neutral-200 dark:border-[#2b3040] rounded focus:outline-none focus:border-sky-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Date Quick Tabs Strip */}
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                { date: '2026-11-12', day: '12 ноя', sub: 'Ср · Сегодня' },
                { date: '2026-11-13', day: '13 ноя', sub: 'Чт · Свободно' },
                { date: '2026-11-14', day: '14 ноя', sub: 'Пт · Загружен' },
                { date: '2026-11-17', day: '17 ноя', sub: 'Пн · Свободно' }
              ].map((d) => (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`p-2 rounded-md border text-center transition-all ${
                    selectedDate === d.date
                      ? 'bg-neutral-950 text-white dark:bg-white dark:text-neutral-950 border-neutral-950 dark:border-white shadow-sm'
                      : 'bg-neutral-50 dark:bg-[#171922] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-[#262b3a] hover:bg-neutral-100 dark:hover:bg-[#1e222e]'
                  }`}
                >
                  <div className="font-bold text-xs">{d.day}</div>
                  <div className={`text-[10px] mt-0.5 ${selectedDate === d.date ? 'text-neutral-300 dark:text-neutral-600' : 'text-neutral-400'}`}>
                    {d.sub}
                  </div>
                </button>
              ))}
            </div>

            {/* VIEW MODE 1: RECOMMENDED SLOTS CARDS */}
            {viewMode === 'slots' ? (
              <div className="space-y-2.5 pt-2">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                  Доступные окна на {selectedDate}:
                </div>

                {currentSlots.map((slot) => {
                  const isSelected = selectedSlotId === slot.id;
                  const isOptimal = slot.isAvailable && slot.startTime === '14:00';

                  return (
                    <div
                      key={slot.id}
                      onClick={() => {
                        setSelectedSlotId(slot.id);
                        setCustomStartTime(slot.startTime);
                      }}
                      className={`p-3.5 rounded-lg border transition-all ${
                        !slot.isAvailable
                          ? 'opacity-60 bg-neutral-50 dark:bg-[#14161d] border-neutral-200 dark:border-[#222530] cursor-pointer'
                          : isSelected
                          ? 'cursor-pointer bg-sky-50 dark:bg-sky-950/30 border-sky-500 ring-2 ring-sky-500/20'
                          : 'cursor-pointer bg-white dark:bg-[#151720] border-neutral-200 dark:border-[#262b3a] hover:border-neutral-300 dark:hover:border-[#333a4c]'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1.5 font-mono font-bold text-neutral-900 dark:text-neutral-100 text-sm">
                            <Clock className="w-3.5 h-3.5 text-neutral-400" />
                            <span>{slot.startTime} – {slot.endTime}</span>
                          </div>

                          {isOptimal && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20 text-[10px] font-semibold">
                              <Sparkles className="w-3 h-3 text-emerald-500" />
                              Оптимальное окно
                            </span>
                          )}
                        </div>

                        <span
                          className={`text-[11px] font-medium px-2 py-0.5 rounded font-mono ${
                            slot.isAvailable
                              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20'
                          }`}
                        >
                          {slot.isAvailable ? '✓ Все участники свободны' : 'Конфликт расписания'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-2 mt-2 border-t border-neutral-100 dark:border-[#1d2028]">
                        <span>
                          {slot.participantsFree.length > 0
                            ? `Свободны: ${slot.participantsFree.join(', ')}`
                            : 'Слот занят другим совещанием'}
                        </span>
                        <span className="font-mono text-[10px] text-sky-600 dark:text-sky-400">
                          {isSelected ? '● Выбран для встречи' : 'Выбрать слот'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              /* VIEW MODE 2: HOURLY DAY TIMELINE (09:00 - 18:00) */
              <div className="space-y-3 pt-2">
                <div className="text-[11px] font-semibold text-neutral-500 uppercase tracking-wider font-mono">
                  Почасовая шкала занятости на {selectedDate}:
                </div>

                <div className="space-y-1.5 border border-neutral-200 dark:border-[#222530] rounded-lg p-3 bg-neutral-50/50 dark:bg-[#12141a]">
                  {HOURS.map((hour) => {
                    const nextHour = `${String(Number(hour.split(':')[0]) + 1).padStart(2, '0')}:00`;
                    const hasMeeting = scheduledMeetings.find(
                      (m) => m.date === selectedDate && m.time.startsWith(hour)
                    );
                    const isSelectedHour = customStartTime.startsWith(hour.slice(0, 2));

                    return (
                      <div
                        key={hour}
                        onClick={() => {
                          setCustomStartTime(hour);
                          setSelectedSlotId('');
                        }}
                        className={`p-2.5 rounded-md flex items-center justify-between text-xs transition-all cursor-pointer border ${
                          hasMeeting
                            ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/40 text-rose-800 dark:text-rose-300'
                            : isSelectedHour
                            ? 'bg-sky-50 dark:bg-sky-950/40 border-sky-500 text-sky-900 dark:text-sky-200 ring-2 ring-sky-500/20 font-semibold'
                            : 'bg-white dark:bg-[#161822] border-neutral-200 dark:border-[#232734] hover:border-neutral-300 dark:hover:border-[#303648]'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="font-mono font-bold text-xs text-neutral-700 dark:text-neutral-300 w-12">
                            {hour}
                          </span>
                          <span className="text-neutral-400 text-xs">— {nextHour}</span>
                          {hasMeeting ? (
                            <span className="text-[11px] font-medium text-rose-700 dark:text-rose-300">
                              Занято: «{hasMeeting.title}»
                            </span>
                          ) : (
                            <span className="text-[11px] text-emerald-600 dark:text-emerald-400">
                              Свободное окно для участников
                            </span>
                          )}
                        </div>

                        <div>
                          {hasMeeting ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                              Занято
                            </span>
                          ) : isSelectedHour ? (
                            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-sky-100 dark:bg-sky-900/40 text-sky-700 dark:text-sky-300 font-bold">
                              ✓ Выбрано
                            </span>
                          ) : (
                            <span className="text-[10px] text-neutral-400 font-mono">
                              Свободно
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT COLUMN: CONFIRMATION CARD & EVENT PARAMETERS (5 COLS) */}
          <div className="lg:col-span-5 space-y-4 bg-white dark:bg-[#13151b] p-5 rounded-lg border border-neutral-200 dark:border-[#212530]">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-neutral-950 dark:text-white tracking-wide">
                  Карточка подтверждения встречи
                </h3>
              </div>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                  Тема совещания:
                </label>
                <div className="font-bold text-neutral-950 dark:text-white text-sm leading-snug p-2.5 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a]">
                  {meetingDraft.topic || 'Совещание (тема не указана)'}
                </div>
              </div>

              {/* Time & Duration Controls */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Дата события:
                  </label>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 p-2 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a]">
                    {selectedDate}
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                    Время встречи:
                  </label>
                  <div className="font-semibold font-mono text-neutral-900 dark:text-neutral-100 p-2 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a]">
                    {activeSlot ? activeSlot.startTime : customStartTime} – {calculatedEndTime}
                  </div>
                </div>
              </div>

              {/* Duration Pills */}
              <div>
                <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                  Продолжительность:
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[30, 45, 60, 90].map((dur) => (
                    <button
                      key={dur}
                      onClick={() => setMeetingDuration(dur)}
                      className={`py-1 rounded text-center text-xs font-mono transition-colors border ${
                        meetingDuration === dur
                          ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white font-bold'
                          : 'bg-neutral-50 dark:bg-[#171922] text-neutral-600 dark:text-neutral-300 border-neutral-200 dark:border-[#282d3b] hover:bg-neutral-100'
                      }`}
                    >
                      {dur} мин
                    </button>
                  ))}
                </div>
              </div>

              {/* Location / Meeting Room */}
              <div>
                <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                  Место проведения:
                </label>
                <div className="relative">
                  <select
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#282d3b] text-neutral-900 dark:text-neutral-100 text-xs rounded-md p-2 font-medium focus:outline-none focus:border-sky-500"
                  >
                    <option value="Переговорная 1 · Главный корпус">Переговорная 1 · Главный корпус</option>
                    <option value="Переговорная 2 · Цех постпечати">Переговорная 2 · Цех постпечати</option>
                    <option value="Корпоративный защищенный контур (ВКС)">Корпоративный защищенный контур (ВКС)</option>
                  </select>
                </div>
              </div>

              {/* Participants */}
              <div>
                <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                  Приглашенные участники ({meetingDraft.participants.length}):
                </label>
                <div className="space-y-1 p-2 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a] max-h-24 overflow-y-auto">
                  {meetingDraft.participants.length === 0 ? (
                    <div className="text-[11px] text-neutral-400 py-1">
                      Участники не выбраны. Выберите на шаге подготовки встречи.
                    </div>
                  ) : (
                    meetingDraft.participants.map((p, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-neutral-800 dark:text-neutral-200">
                        <div className="flex items-center gap-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                          <span>{p}</span>
                        </div>
                        <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-mono">Готов</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Agenda items count */}
              <div>
                <label className="text-[10px] font-mono text-neutral-400 block mb-1">
                  Проект повестки:
                </label>
                <div className="text-[11px] text-neutral-600 dark:text-neutral-300 p-2 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200 dark:border-[#262b3a] max-h-24 overflow-y-auto space-y-1">
                  {meetingDraft.agenda.length === 0 ? (
                    <div className="text-[11px] text-neutral-400 py-1 italic">
                      Повестка пока не сформирована.
                    </div>
                  ) : (
                    meetingDraft.agenda.map((ag, idx) => (
                      <div key={idx} className="truncate">• {ag}</div>
                    ))
                  )}
                </div>
              </div>

              {/* Collision warning if any */}
              {collision.hasConflict && (
                <div className="p-2.5 rounded bg-rose-50 dark:bg-rose-950/30 border border-rose-300 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                  <span>{collision.reason}</span>
                </div>
              )}
            </div>

            {/* Primary Action Button */}
            <div className="pt-3 border-t border-neutral-100 dark:border-[#202430] space-y-2">
              <button
                onClick={handleConfirmCreation}
                disabled={isSubmitting || collision.hasConflict}
                className="w-full py-2.5 px-4 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Создание и рассылка...' : 'Подтвердить создание встречи'}</span>
              </button>
              <p className="text-[10px] text-center text-neutral-400 leading-tight">
                Требование сценария: событие создается только после явного подтверждения
              </p>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* INVITATION SENT CONFIRMATION MODAL / TRAY                                 */}
        {/* ========================================================================= */}
        {showInviteModal && (
          <div className="p-5 rounded-lg bg-emerald-500/[0.08] dark:bg-emerald-500/[0.12] border border-emerald-500/30 space-y-3 animate-in fade-in duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MailCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <h3 className="text-xs font-bold text-emerald-950 dark:text-emerald-200 uppercase tracking-wide">
                  Приглашения разосланы участникам
                </h3>
              </div>
              <button
                onClick={() => setShowInviteModal(false)}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 text-xs">
              {meetingDraft.participants.map((p, idx) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-white dark:bg-[#13151b] border border-emerald-500/20 flex items-center justify-between"
                >
                  <span className="font-medium text-neutral-800 dark:text-neutral-200 text-[11px] truncate">{p}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-mono font-semibold shrink-0">
                    <Check className="w-3 h-3" />
                    Доставлено
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-2 text-xs flex-wrap gap-2">
              <span className="text-[11px] text-neutral-600 dark:text-neutral-300">
                Событие зафиксировано в корпоративном календаре на {selectedDate} {activeSlot ? activeSlot.startTime : customStartTime}.
              </span>
              <button
                onClick={() => {
                  const m = scheduledMeetings[0];
                  if (m) downloadICS(m);
                }}
                className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-100/80 dark:bg-emerald-950/40 hover:bg-emerald-200 border border-emerald-500/30 rounded transition-colors"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Скачать .ics файл для Outlook / Google Calendar</span>
              </button>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* REGISTRY OF SCHEDULED MEETINGS (PERSISTED IN POSTGRESQL)                   */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
            <div>
              <h3 className="text-xs font-bold text-neutral-950 dark:text-white tracking-wide">
                Реестр согласованных встреч в календаре
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                События, сохраненные в базе данных PostgreSQL после явного подтверждения
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              {scheduledMeetings.length} событий
            </span>
          </div>

          {scheduledMeetings.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Запланированных встреч пока нет. Выберите свободный слот и подтвердите создание встречи.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {scheduledMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="p-4 rounded-lg border border-neutral-200 dark:border-[#252936] bg-neutral-50/50 dark:bg-[#161822] space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-1">
                        {meeting.title}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.5 rounded shrink-0 font-semibold ${
                          meeting.status === 'scheduled'
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20'
                            : 'bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
                        }`}
                      >
                        {meeting.status === 'scheduled' ? 'Запланировано' : 'Завершено'}
                      </span>
                    </div>

                    <div className="text-[11px] font-mono text-neutral-500 dark:text-neutral-400 flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-neutral-400" />
                        {meeting.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-neutral-400" />
                        {meeting.time}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-neutral-400" />
                        Переговорная 1
                      </span>
                    </div>
                  </div>

                  {meeting.agenda && meeting.agenda.length > 0 && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-300 bg-white dark:bg-[#111318] p-2.5 rounded border border-neutral-100 dark:border-[#1e222e] line-clamp-2">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">Повестка: </span>
                      {meeting.agenda.join('; ')}
                    </div>
                  )}

                  <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-100 dark:border-[#1e222e]">
                    Участники: {(meeting.participants || []).join(', ')}
                  </div>

                  {/* Actions on Scheduled Meeting */}
                  <div className="flex items-center justify-between pt-2 border-t border-neutral-200/80 dark:border-[#222632] gap-2">
                    <button
                      onClick={() => handleStartMeetingNow(meeting)}
                      className="flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors shadow-sm"
                      title="Начать встречу и перейти к расшифровке/протоколу"
                    >
                      <Play className="w-3 h-3" />
                      <span>Начать совещание</span>
                    </button>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => downloadICS(meeting)}
                        title="Скачать файл календаря (.ics)"
                        className="p-1.5 text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white bg-white dark:bg-[#1a1d25] border border-neutral-200 dark:border-[#282d3a] rounded transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleCancelMeeting(meeting.id)}
                        title="Отменить встречу и освободить слот"
                        className="p-1.5 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-neutral-200 dark:border-[#282d3a] rounded transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
