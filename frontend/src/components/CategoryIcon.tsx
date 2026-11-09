import {
  Car,
  CircleDollarSign,
  Gamepad2,
  GraduationCap,
  HeartPulse,
  House,
  Landmark,
  ShoppingBag,
  Tag,
  Utensils,
  WalletCards,
} from "lucide-react";
import type { ComponentType } from "react";

const icons: Record<string, ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Utensils,
  Car,
  Gamepad2,
  House,
  CircleDollarSign,
  WalletCards,
  Landmark,
  ShoppingBag,
  HeartPulse,
  GraduationCap,
};

export function CategoryIcon({ icon, size = 17 }: { icon: string; size?: number }) {
  const Icon = icons[icon] ?? Tag;
  return <Icon size={size} strokeWidth={2} />;
}
