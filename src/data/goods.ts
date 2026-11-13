// Things the farm sells that do not grow in the vegetable bed: rice and orchard fruit.

export type GoodId = 'rice' | 'banana' | 'mango' | 'longan' | 'orange';

export interface GoodDef {
  name: string;
  unit: string; // Thai counting word
  price: number; // paid per unit by the shipping crate
}

export const GOODS: Record<GoodId, GoodDef> = {
  rice: { name: 'ข้าวเปลือก', unit: 'ถัง', price: 45 },
  banana: { name: 'กล้วยน้ำว้า', unit: 'หวี', price: 30 },
  mango: { name: 'มะม่วงน้ำดอกไม้', unit: 'ผล', price: 55 },
  longan: { name: 'ลำไย', unit: 'พวง', price: 60 },
  orange: { name: 'ส้มสายน้ำผึ้ง', unit: 'ผล', price: 58 },
};

export const GOOD_IDS = Object.keys(GOODS) as GoodId[];
