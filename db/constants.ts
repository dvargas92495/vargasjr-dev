export const InboxTypes = ["FORM", "EMAIL", "SMS", "SLACK", "CHAT_SESSION", "NONE"] as const;
export const InboxMessageOperationTypes = ["READ", "ARCHIVED"] as const;

export const AppTypes = [
  "TWITTER",
  "NOTION", 
  "DEVIN",
  "CAPITAL_ONE",
  "MERCURY",
  "SLACK",
  "ROAM_RESEARCH",
  "GOOGLE",
] as const;

export type AppType = typeof AppTypes[number];
