export const InboxTypes = [
  "FORM",
  "EMAIL",
  "SMS",
  "SLACK",
  "CHAT_SESSION",
  "NONE",
] as const;
export const InboxMessageOperationTypes = [
  "READ",
  "ARCHIVED",
  "UNREAD",
] as const;

export const AppTypes = [
  "TWITTER",
  "NOTION",
  "DEVIN",
  "CAPITAL_ONE",
  "MERCURY",
  "SLACK",
  "ROAM_RESEARCH",
  "GOOGLE",
  "TWILIO",
  "RECALL",
] as const;

export type AppType = (typeof AppTypes)[number];

export const OutboxRecipientTypes = ["TO", "CC", "BCC"] as const;

export const ContactStatuses = [
  "LEAD",
  "CLIENT",
  "PROSPECT",
  "INACTIVE",
] as const;

export type ContactStatus = (typeof ContactStatuses)[number];
