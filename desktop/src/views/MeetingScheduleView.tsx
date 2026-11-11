import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
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
  ArrowLeft
} from 'lucide-react';

export const MeetingScheduleView: React.FC = () => {
  const {
    meetingDraft,
    calendarSlots,
    scheduleMeeting,
    scheduledMeetings,
    setActiveTab,
    logAudit,
    showToast
  } = useApp();

  const [selectedSlotId, setSelectedSlotId] = useState<string>(calendarSlots[0]?.id || 'slot-1');
  const [selectedDate, setSelectedDate] = useState<string>('2026-11-12');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const activeSlot = calendarSlots.find((s) => s.id === selectedSlotId) || calendarSlots[0];

  const handleConfirmCreation = async () => {
    if (!activeSlot) {
      showToast('Выберите слот', 'Необходимо выбрать свободное окно в календаре', 'warning');
      return;
    }

    setIsSubmitting(true);
    try {
      await scheduleMeeting({
        title: meetingDraft.topic,
        date: activeSlot.date || selectedDate,
        time: `${activeSlot.startTime} - ${activeSlot.endTime}`,
        durationMinutes: 60,
        participants: meetingDraft.participants,
        agenda: meetingDraft.agenda
      });

      logAudit(
        'CREATE_MEETING_CONFIRMED',
        `Встреча: ${meetingDraft.topic}`,
        'SUCCESS',
        `Пользователь явно подтвердил создание встречи: «${meetingDraft.topic}» на ${activeSlot.date} ${activeSlot.startTime}. Приглашения разосланы.`
      );

      showToast(
        'Встреча успешно создана',
        `Событие зафиксировано в календаре, участникам отправлены приглашения`,
        'success'
      );
    } catch {
      showToast('Ошибка создания', 'Не удалось сохранить встречу на сервере', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

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
              Подбор свободного времени в календаре, создание события и отправка приглашений
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
        {/* COMPLIANCE CALLOUT                                                        */}
        {/* ========================================================================= */}
        <div className="p-4 rounded-lg bg-amber-500/[0.07] dark:bg-amber-500/[0.1] border border-amber-500/30 text-xs flex items-start gap-3">
          <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-amber-950 dark:text-amber-200">
              Контроль перед отправкой приглашений
            </div>
            <div className="text-neutral-600 dark:text-neutral-300 text-[11px] leading-relaxed">
              Система автоматически находит свободные окна всех участников в календаре, но событие в календаре и приглашения создаются <strong>исключительно после вашего прямого нажатия кнопки «Подтвердить создание встречи»</strong>.
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2-COLUMN LAYOUT: TEST CALENDAR (LEFT) vs CONFIRMATION CARD (RIGHT)        */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* LEFT: TEST CALENDAR SLOTS (7 COLS) */}
          <div className="lg:col-span-7 space-y-4 bg-white dark:bg-[#13151b] p-5 rounded-lg border border-neutral-200 dark:border-[#212530]">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-sky-500" />
                <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                  Тестовый календарь свободных окон
                </h3>
              </div>
              <span className="text-[11px] text-neutral-400 font-mono">
                Участники: {meetingDraft.participants.length} чел.
              </span>
            </div>

            {/* Date Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs">
              {[
                { date: '2026-11-12', label: '12 ноя (Ср)', note: 'Сегодня' },
                { date: '2026-11-13', label: '13 ноя (Чт)', note: 'Свободно' },
                { date: '2026-11-14', label: '14 ноя (Пт)', note: 'Загружен' },
                { date: '2026-11-17', label: '17 ноя (Пн)', note: 'Свободно' }
              ].map((d) => (
                <button
                  key={d.date}
                  onClick={() => setSelectedDate(d.date)}
                  className={`px-3 py-1.5 rounded-md border text-xs font-medium transition-all ${
                    selectedDate === d.date
                      ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-950 border-neutral-900 dark:border-white shadow-sm'
                      : 'bg-neutral-50 dark:bg-[#171922] text-neutral-700 dark:text-neutral-300 border-neutral-200 dark:border-[#262b3a] hover:bg-neutral-100 dark:hover:bg-[#1f232e]'
                  }`}
                >
                  <div>{d.label}</div>
                  <div className="text-[10px] text-neutral-400 font-mono">{d.note}</div>
                </button>
              ))}
            </div>

            {/* Slot Cards List */}
            <div className="space-y-2.5 pt-1">
              {(calendarSlots.length > 0 ? calendarSlots : [
                { id: 'slot-1', date: selectedDate, startTime: '10:00', endTime: '11:00', isAvailable: false, participantsFree: ['Смирнов А.В.'] },
                { id: 'slot-2', date: selectedDate, startTime: '11:30', endTime: '12:30', isAvailable: true, participantsFree: ['Смирнов А.В.', 'Иванов И.С.', 'Ковалева Е.Д.'] },
                { id: 'slot-3', date: selectedDate, startTime: '14:00', endTime: '15:00', isAvailable: true, participantsFree: ['Смирнов А.В.', 'Иванов И.С.', 'Ковалева Е.Д.'] },
                { id: 'slot-4', date: selectedDate, startTime: '15:30', endTime: '16:30', isAvailable: true, participantsFree: ['Смирнов А.В.', 'Иванов И.С.'] },
                { id: 'slot-5', date: selectedDate, startTime: '17:00', endTime: '18:00', isAvailable: false, participantsFree: ['Ковалева Е.Д.'] }
              ]).map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const isOptimal = slot.isAvailable && slot.startTime === '14:00';

                return (
                  <div
                    key={slot.id}
                    onClick={() => slot.isAvailable && setSelectedSlotId(slot.id)}
                    className={`p-3.5 rounded-lg border transition-all ${
                      !slot.isAvailable
                        ? 'opacity-50 cursor-not-allowed bg-neutral-50 dark:bg-[#14161d] border-neutral-200 dark:border-[#222530]'
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
                            ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                            : 'bg-rose-500/10 text-rose-700 dark:text-rose-400'
                        }`}
                      >
                        {slot.isAvailable ? 'Свободно для всех' : 'Конфликт занятости'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-neutral-500 dark:text-neutral-400 pt-2 mt-2 border-t border-neutral-100 dark:border-[#1d2028]">
                      <span>Доступны: {slot.participantsFree.join(', ')}</span>
                      <span className="font-mono">{isSelected ? '✓ Выбран для встречи' : 'Нажмите для выбора'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT: CONFIRMATION & EVENT PREVIEW (5 COLS) */}
          <div className="lg:col-span-5 space-y-4 bg-white dark:bg-[#13151b] p-5 rounded-lg border border-neutral-200 dark:border-[#212530]">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                  Карточка подтверждения встречи
                </h3>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <div className="text-[10px] font-mono text-neutral-400">Тема события:</div>
                <div className="font-bold text-neutral-950 dark:text-white text-sm mt-0.5 leading-snug">
                  {meetingDraft.topic}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 p-2.5 rounded bg-neutral-50 dark:bg-[#171922] border border-neutral-200/80 dark:border-[#262b3a]">
                <div>
                  <div className="text-[10px] font-mono text-neutral-400">Дата встречи:</div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100">{activeSlot?.date || selectedDate}</div>
                </div>
                <div>
                  <div className="text-[10px] font-mono text-neutral-400">Время и слот:</div>
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 font-mono">
                    {activeSlot?.startTime} – {activeSlot?.endTime} (60 мин)
                  </div>
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-neutral-400">Приглашенные участники ({meetingDraft.participants.length}):</div>
                <div className="space-y-1 mt-1">
                  {meetingDraft.participants.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-1.5 text-neutral-800 dark:text-neutral-200 text-xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-sky-500" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-neutral-400">Повестка ({meetingDraft.agenda.length} пунктов):</div>
                <div className="space-y-1 mt-1 max-h-36 overflow-y-auto pr-1">
                  {meetingDraft.agenda.map((ag, idx) => (
                    <div key={idx} className="text-[11px] text-neutral-600 dark:text-neutral-300 leading-tight">
                      {ag}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Primary Action Button */}
            <div className="pt-3 border-t border-neutral-100 dark:border-[#202430]">
              <button
                onClick={handleConfirmCreation}
                disabled={isSubmitting || !activeSlot?.isAvailable}
                className="w-full py-2.5 px-4 rounded-md text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSubmitting ? 'Создание и рассылка...' : 'Подтвердить создание встречи'}</span>
              </button>
              <div className="text-[10px] text-center text-neutral-400 mt-2">
                Событие записывается в PostgreSQL (meetings), участникам высылается приглашение.
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* REGISTRY OF SCHEDULED MEETINGS                                            */}
        {/* ========================================================================= */}
        <div className="p-5 rounded-lg bg-white dark:bg-[#13151b] border border-neutral-200 dark:border-[#212530] space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-[#202430]">
            <div>
              <h3 className="text-xs font-bold text-neutral-950 dark:text-white uppercase tracking-wider font-mono">
                Реестр согласованных встреч в календаре
              </h3>
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                События, созданные после явного подтверждения пользователя
              </p>
            </div>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-sky-500/10 text-sky-700 dark:text-sky-300 border border-sky-500/20">
              {scheduledMeetings.length} событий
            </span>
          </div>

          {scheduledMeetings.length === 0 ? (
            <div className="py-8 text-center text-xs text-neutral-400">
              Запланированных встреч пока нет. Выберите слот и нажмите «Подтвердить создание встречи».
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
              {scheduledMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="p-3.5 rounded-lg border border-neutral-200 dark:border-[#252936] bg-neutral-50/50 dark:bg-[#161822] space-y-2 flex flex-col justify-between"
                >
                  <div className="space-y-1">
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
                    </div>
                  </div>

                  {meeting.agenda && meeting.agenda.length > 0 && (
                    <div className="text-[11px] text-neutral-600 dark:text-neutral-300 bg-white dark:bg-[#111318] p-2 rounded border border-neutral-100 dark:border-[#1e222e] line-clamp-2">
                      <span className="font-semibold text-neutral-800 dark:text-neutral-200">Повестка: </span>
                      {meeting.agenda.join('; ')}
                    </div>
                  )}

                  <div className="text-[10px] text-neutral-400 pt-1 border-t border-neutral-100 dark:border-[#1e222e]">
                    Участники: {(meeting.participants || []).join(', ')}
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
