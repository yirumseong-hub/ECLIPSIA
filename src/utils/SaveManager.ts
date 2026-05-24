const SAVE_KEYS = {
  GOLD:           'eclipsia_gold',
  META_UPGRADES:  'eclipsia_meta_upgrades',
  UNLOCKED_CHARS: 'eclipsia_unlocked_chars',
} as const;

export const SaveManager = {
  getGold(): number {
    return parseInt(localStorage.getItem(SAVE_KEYS.GOLD) ?? '0', 10);
  },

  setGold(amount: number): void {
    localStorage.setItem(SAVE_KEYS.GOLD, String(amount));
  },

  addGold(amount: number): void {
    this.setGold(this.getGold() + amount);
  },

  getMetaUpgrades(): Record<string, number> {
    const raw = localStorage.getItem(SAVE_KEYS.META_UPGRADES);
    return raw ? JSON.parse(raw) : {};
  },

  setMetaUpgrades(data: Record<string, number>): void {
    localStorage.setItem(SAVE_KEYS.META_UPGRADES, JSON.stringify(data));
  },

  getUnlockedChars(): string[] {
    const raw = localStorage.getItem(SAVE_KEYS.UNLOCKED_CHARS);
    return raw ? JSON.parse(raw) : ['ara', 'kael', 'sera'];
  },

  reset(): void {
    Object.values(SAVE_KEYS).forEach(k => localStorage.removeItem(k));
  },
};