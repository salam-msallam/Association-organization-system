export const ZakatType = {
  MONEY: 'MONEY',
  GOLD: 'GOLD',
  SILVER: 'SILVER',
} as const;

export type ZakatType = (typeof ZakatType)[keyof typeof ZakatType];
