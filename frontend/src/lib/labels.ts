// Maps the n8n/LLM enum-ish values to Ukrainian UI labels (design wording).

export const riskLevelLabel: Record<string, string> = {
  high: 'ВИСОКИЙ',
  medium: 'СЕРЕДНІЙ',
  low: 'НИЗЬКИЙ',
};

export const urgencyLabel: Record<string, string> = {
  immediate: 'Негайно',
  this_week: 'Цього тижня',
  monitor: 'Спостереження',
};

// student_state: short caption shown under the big state word (design).
export const studentStateCaption: Record<string, string> = {
  overwhelmed: 'Перевантажений матеріалом',
  disengaged: 'Втратив залученість',
  struggling: 'Має труднощі з матеріалом',
  distracted: 'Розсіяна увага',
  on_track: 'Рухається за планом',
};

export const recommendedActionLabel: Record<string, string> = {
  mentor_call: 'Особистий дзвінок з ментором',
  escalation_to_manager: 'Ескалація до менеджера',
  send_message: 'Написати студенту',
  monitor: 'Тримати на спостереженні',
  no_action: 'Дія не потрібна',
};

export function label(map: Record<string, string>, key: string | null | undefined): string {
  if (!key) return '—';
  return map[key] ?? key;
}
