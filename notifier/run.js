import { planReminders } from '../web/core/alerts.js';
import { buildStatuses, estimateKm } from '../web/core/schedule.js';
import { formatMessage } from './format.js';

const markSent = (state, next, kind) => {
  if (kind === 'soon' || kind === 'watch') return { ...state, sent: next.sent };
  if (kind === 'overdue') return { ...state, lastDigest: next.lastDigest };
  return { ...state, lastAsk: next.lastAsk };
};

// Saves after each message, so a later failure cannot cause a repeat tomorrow.
export const runReminders = async ({ data, state, today, siteUrl, send, save = async () => {} }) => {
  const estimate = estimateKm(data, today);
  const { messages, nextState } = planReminders({
    rows: buildStatuses(data, today),
    today,
    lastReadingDate: estimate.last?.date ?? null,
    estimateKm: estimate.km,
    state,
  });
  let progress = state;
  for (const message of messages) {
    await send(formatMessage(message, siteUrl));
    progress = markSent(progress, nextState, message.kind);
    await save(progress);
  }
  await save(nextState);
  return nextState;
};
